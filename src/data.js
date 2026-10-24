// Everything about saving and loading data in Firestore
//
// How the data is organised in the database:
//   users/{userId}                      ← profile (name, monthly budget) + category budgets
//   users/{userId}/transactions/{txId}  ← one document per entry
//   users/{userId}/goals/{goalId}       ← one document per goal
//
// The security rules (firestore.rules) make sure each person can only open their own users/{userId}.
import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { EmailAuthProvider, deleteUser, reauthenticateWithCredential } from 'firebase/auth';
import { db } from './firebase';
import { DEFAULT_PROFILE, LEGACY_GOAL_EMOJI, LEGACY_STORAGE_KEY, TX_DEFAULTS } from './constants';
import { newId } from './utils';
import { resolveData } from './money';

const userDoc = (uid) => doc(db, 'users', uid);
const txCol = (uid) => collection(db, 'users', uid, 'transactions');
const goalCol = (uid) => collection(db, 'users', uid, 'goals');
const cacheKey = (uid) => `monee-cache-${uid}`;
const legacyHandledKey = (uid) => `monee-legacy-handled-${uid}`;

const withoutId = ({ id, ...rest }) => rest;

const cleanTx = (t) => {
  const tx = { ...TX_DEFAULTS, ...t };
  if (tx.category === 'Income') tx.category = 'Allowance'; // name used by the very first version
  tx.amount = Number(tx.amount) || 0;
  return tx;
};
const cleanGoal = (g) => ({
  deadline: null,
  saved: 0,
  createdAt: 0,
  ...g,
  icon: g.icon || LEGACY_GOAL_EMOJI[g.emoji] || 'target',
});

// Writes many changes in groups (Firestore allows up to 500 per batch)
async function commitInChunks(writes) {
  for (let i = 0; i < writes.length; i += 450) {
    const batch = writeBatch(db);
    writes.slice(i, i + 450).forEach((w) => w(batch));
    await batch.commit();
  }
}

// Called once when someone signs up
export async function createUserProfile(uid, name) {
  await setDoc(
    userDoc(uid),
    { profile: { ...DEFAULT_PROFILE, name }, budgets: {}, createdAt: serverTimestamp() },
    { merge: true }
  );
}

/* ---------- The main hook: live data for one user ---------- */

export function useMoneeData(uid) {
  const [data, setData] = useState(null); // null = still loading
  const [syncing, setSyncing] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const parts = {};
    const pending = {};

    // 1. Show the last saved copy straight away (works offline too)
    AsyncStorage.getItem(cacheKey(uid))
      .then((raw) => {
        // resolveData also upgrades copies saved by older versions (before accounts existed)
        if (alive && raw) setData((d) => d ?? resolveData(JSON.parse(raw)));
      })
      .catch(() => {});

    // 2. Listen to the database. These run again every time something changes, even from another phone.
    const publish = () => {
      if (!alive || !parts.user || !parts.transactions || !parts.goals) return;
      // resolveData links every entry and goal to one of your accounts (see money.js)
      const next = resolveData({
        ...parts.user,
        transactions: parts.transactions,
        goals: parts.goals,
      });
      setData(next);
      setError(null);
      setSyncing(Object.values(pending).some(Boolean));
      AsyncStorage.setItem(cacheKey(uid), JSON.stringify(next)).catch(() => {});
    };
    const onErr = (e) => {
      console.warn('Firestore error:', e.code, e.message);
      if (alive) setError(e);
    };
    const opts = { includeMetadataChanges: true };
    const notSynced = (snap) => snap.metadata.hasPendingWrites || snap.metadata.fromCache;

    const unsubs = [
      onSnapshot(
        userDoc(uid),
        opts,
        (snap) => {
          const v = snap.data() || {};
          parts.user = {
            profile: { ...DEFAULT_PROFILE, ...(v.profile || {}) },
            budgets: v.budgets || {},
            accounts: v.accounts || [],
            mainAccountId: v.mainAccountId || null,
            onboarded: !!v.onboarded,
          };
          pending.user = notSynced(snap);
          publish();
        },
        onErr
      ),
      onSnapshot(
        txCol(uid),
        opts,
        (snap) => {
          parts.transactions = snap.docs
            .map((d) => cleanTx({ ...d.data(), id: d.id }))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
          pending.tx = notSynced(snap);
          publish();
        },
        onErr
      ),
      onSnapshot(
        goalCol(uid),
        opts,
        (snap) => {
          parts.goals = snap.docs
            .map((d) => cleanGoal({ ...d.data(), id: d.id }))
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
          pending.goals = notSynced(snap);
          publish();
        },
        onErr
      ),
    ];

    return () => {
      alive = false;
      unsubs.forEach((u) => u());
    };
  }, [uid]);

  // 3. Actions that change data. We don't wait for them: Firestore shows the change instantly
  //    and uploads it in the background (it also waits if you're offline).
  const actions = useMemo(() => {
    const fail = (e) => {
      console.warn(e);
      Alert.alert('Couldn’t save to the cloud', e.message);
    };
    return {
      saveTx: (tx) => setDoc(doc(txCol(uid), tx.id), withoutId(cleanTx(tx))).catch(fail),
      deleteTx: (id) => deleteDoc(doc(txCol(uid), id)).catch(fail),
      addGoal: (g) => setDoc(doc(goalCol(uid), g.id), withoutId(cleanGoal(g))).catch(fail),
      setGoalSaved: (id, saved) => updateDoc(doc(goalCol(uid), id), { saved }).catch(fail),
      deleteGoal: (id) => deleteDoc(doc(goalCol(uid), id)).catch(fail),
      // image is a small "data:image/jpeg;base64,…" text (see images.js), or null to remove it
      setGoalImage: (id, image) => updateDoc(doc(goalCol(uid), id), { image: image || null }).catch(fail),
      setProfilePhoto: (photo) =>
        setDoc(userDoc(uid), { profile: { photo: photo || null } }, { merge: true }).catch(fail),
      // Saves any of: profile, budgets, accounts, mainAccountId, onboarded
      saveSettings: (fields) => setDoc(userDoc(uid), fields, { merge: true }).catch(fail),
      setMainAccount: (id) => setDoc(userDoc(uid), { mainAccountId: id }, { merge: true }).catch(fail),
      wipeEntries: () => wipeUserData(uid, { removeUserDoc: false }).catch(fail),
    };
  }, [uid]);

  return { data, syncing, error, actions };
}

/* ---------- Deleting ---------- */

async function wipeUserData(uid, { removeUserDoc }) {
  const [txSnap, goalSnap] = await Promise.all([getDocs(txCol(uid)), getDocs(goalCol(uid))]);
  const writes = [...txSnap.docs, ...goalSnap.docs].map((d) => (b) => b.delete(d.ref));
  // Your settings (name, budgets, accounts) stay unless the whole account is being deleted
  if (removeUserDoc) writes.push((b) => b.delete(userDoc(uid)));
  await commitInChunks(writes);
}

// Deletes the account and all its data. Firebase asks for the password again first, for safety.
export async function deleteAccountAndData(user, password) {
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
  await wipeUserData(user.uid, { removeUserDoc: true });
  await AsyncStorage.multiRemove([cacheKey(user.uid), legacyHandledKey(user.uid)]).catch(() => {});
  await deleteUser(user);
}

/* ---------- Moving data from the old (phone-only) version ---------- */

// Returns the old phone-only data if there is some and this account hasn't been asked yet
export async function getLegacyData(uid) {
  try {
    if (await AsyncStorage.getItem(legacyHandledKey(uid))) return null;
    const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    const transactions = (d.transactions || []).map((t) => cleanTx({ id: newId(), ...t }));
    const goals = (d.goals || []).map((g, i) => cleanGoal({ id: newId(), createdAt: i, ...g }));
    if (!transactions.length && !goals.length) return null;
    return { transactions, goals, profile: d.profile || null, budgets: d.budgets || null };
  } catch (e) {
    return null;
  }
}

export async function importLegacyData(uid, legacy, currentProfile) {
  const writes = [
    ...legacy.transactions.map((t) => (b) => b.set(doc(txCol(uid), t.id), withoutId(t))),
    ...legacy.goals.map((g) => (b) => b.set(doc(goalCol(uid), g.id), withoutId(g))),
  ];
  // Bring over the old budgets too, but keep the name from sign-up
  const profile = { ...currentProfile };
  if (!profile.monthlyBudget && legacy.profile?.monthlyBudget) profile.monthlyBudget = legacy.profile.monthlyBudget;
  writes.push((b) => b.set(userDoc(uid), { profile, budgets: legacy.budgets || {} }, { merge: true }));
  await commitInChunks(writes);
  await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
  await AsyncStorage.setItem(legacyHandledKey(uid), '1');
}

export async function skipLegacyData(uid) {
  await AsyncStorage.setItem(legacyHandledKey(uid), '1').catch(() => {});
}
