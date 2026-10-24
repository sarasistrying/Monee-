import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, TextInput } from '../ui';
import { C, GRADIENT, styles } from '../styles';
import { EXPENSE_CATS } from '../constants';
import { formatRp, newId, parseAmount } from '../utils';
import { ACCOUNT_KINDS, DEFAULT_ACCOUNTS, MAX_ACCOUNTS } from '../money';
import { friendlyAuthError } from './AuthScreen';
import { AccountIcon, CategoryIcon, Export, Plus, PushPin, SignOut, X } from '../icons';
import { Chip } from '../components';
import Avatar from '../Avatar';
import { pickSmallImage } from '../images';

// The setup tutorial: each step points at one part of this screen
const STEPS = [
  {
    key: 'accounts',
    title: 'Name your accounts',
    text: 'Type the names of the e-money apps you use, like GoPay or OVO. Add a bank or cash too if you use them. Only the names, no account numbers needed.',
  },
  {
    key: 'main',
    title: 'Pick your main account',
    text: 'Tap the pin next to the account you use most. Home shows how much you can spend from it each day. You can change it any time.',
  },
  {
    key: 'budget',
    title: 'Set a monthly budget',
    text: 'How much do you want to spend in a month? This is optional, so you can leave it empty and set it later.',
  },
];

const NAME_HINTS = ['e.g. GoPay', 'e.g. OVO', 'e.g. DANA', 'e.g. BCA', 'e.g. ShopeePay'];

export default function SettingsScreen({
  data,
  user,
  actions,
  tutorial = false,
  onExport,
  onLogout,
  onDeleteAccount,
  onClose,
}) {
  // ---------- Edits are kept here and saved when you leave the screen ----------
  const [name, setName] = useState(data.profile.name || '');
  const [monthly, setMonthly] = useState(data.profile.monthlyBudget ? String(data.profile.monthlyBudget) : '');
  const [budgets, setBudgets] = useState(() => {
    const b = {};
    EXPENSE_CATS.forEach((c) => (b[c.key] = data.budgets[c.key] ? String(data.budgets[c.key]) : ''));
    return b;
  });

  // Accounts. A brand-new user gets two empty e-money slots + Cash to fill in.
  const neverSetUp = !data.onboarded && data.accounts.length === 1 && data.accounts[0].id === DEFAULT_ACCOUNTS[0].id;
  const [accounts, setAccounts] = useState(() =>
    neverSetUp
      ? [
          { id: newId(), name: '', kind: 'ewallet' },
          { id: newId(), name: '', kind: 'ewallet' },
          { ...DEFAULT_ACCOUNTS[0] },
        ]
      : data.accounts.map((a) => ({ ...a }))
  );
  const [mainId, setMainId] = useState(() => (neverSetUp ? null : data.mainAccountId));

  const [step, setStep] = useState(tutorial ? 0 : -1);
  const [stepError, setStepError] = useState('');

  const [showDelete, setShowDelete] = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ---------- Scrolling to the right part during the tutorial ----------
  const scrollRef = useRef(null);
  const sectionY = useRef({});
  const remember = (key) => (e) => (sectionY.current[key] = e.nativeEvent.layout.y);
  useEffect(() => {
    if (step < 0) return;
    const key = STEPS[step].key === 'budget' ? 'you' : 'accounts';
    const y = sectionY.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  }, [step]);

  // ---------- Saving ----------
  const cleanAccounts = () => {
    const list = accounts
      .map((a) => ({ id: a.id, name: a.name.trim(), kind: a.kind }))
      .filter((a) => a.name);
    return list.length ? list : DEFAULT_ACCOUNTS;
  };

  const latest = useRef();
  latest.current = { name, monthly, budgets, accounts, mainId };
  const skipSave = useRef(false);

  const saveNow = (extra = {}) => {
    const { name: n, monthly: mo, budgets: b } = latest.current;
    const profile = { name: n.trim(), monthlyBudget: parseAmount(mo) };
    const nums = {};
    Object.entries(b).forEach(([k, v]) => (nums[k] = parseAmount(v)));
    const accs = cleanAccounts();
    const main = accs.some((a) => a.id === latest.current.mainId) ? latest.current.mainId : accs[0].id;

    const changed =
      Object.keys(extra).length > 0 ||
      profile.name !== (data.profile.name || '') ||
      profile.monthlyBudget !== (data.profile.monthlyBudget || 0) ||
      EXPENSE_CATS.some((c) => nums[c.key] !== (data.budgets[c.key] || 0)) ||
      JSON.stringify(accs) !== JSON.stringify(data.accounts) ||
      main !== data.mainAccountId;

    return changed
      ? actions.saveSettings({ profile, budgets: nums, accounts: accs, mainAccountId: main, ...extra })
      : Promise.resolve();
  };

  useEffect(
    () => () => {
      if (!skipSave.current) saveNow();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ---------- Account editing ----------
  const usage = (id) =>
    data.transactions.filter((t) => t.accountId === id).length + data.goals.filter((g) => g.accountId === id).length;

  const updateAccount = (id, field, value) =>
    setAccounts((list) => list.map((a) => (a.id === id ? { ...a, [field]: value } : a)));

  const removeAccount = (acc) => {
    const used = usage(acc.id);
    if (used > 0) {
      Alert.alert(
        `Can’t remove ${acc.name || 'this account'} yet`,
        `It still has ${used} entr${used === 1 ? 'y' : 'ies'} or goals in it. Move them to another account first (tap an entry to edit it), then try again.`
      );
      return;
    }
    if (accounts.length <= 1) {
      Alert.alert('You need at least one account');
      return;
    }
    setAccounts((list) => list.filter((a) => a.id !== acc.id));
    if (mainId === acc.id) setMainId(null);
  };

  const addAccount = () => {
    if (accounts.length >= MAX_ACCOUNTS) return;
    setAccounts((list) => [...list, { id: newId(), name: '', kind: 'ewallet' }]);
  };

  // ---------- Tutorial buttons ----------
  const next = () => {
    setStepError('');
    if (STEPS[step].key === 'accounts' && !accounts.some((a) => a.name.trim())) {
      setStepError('Give at least one account a name.');
      return;
    }
    if (STEPS[step].key === 'main') {
      const named = accounts.filter((a) => a.name.trim());
      if (!named.some((a) => a.id === mainId)) setMainId(named[0]?.id || null);
    }
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  };

  const finish = async () => {
    skipSave.current = true;
    saveNow({ onboarded: true });
    onClose();
  };

  const skipTutorial = () =>
    Alert.alert('Skip setup?', 'You can set up your accounts and budget here in Settings any time.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Skip', onPress: finish },
    ]);

  // ---------- Account settings (log out / delete) ----------
  const logout = async () => {
    await Promise.race([saveNow(), new Promise((r) => setTimeout(r, 3000))]);
    skipSave.current = true;
    onLogout();
  };

  const confirmLogout = () =>
    Alert.alert('Log out?', 'Your data stays safe in your account. Log in again any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);

  const confirmWipe = () =>
    Alert.alert(
      'Delete all entries and goals?',
      'Your settings and accounts stay, but every entry and goal is erased. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => {
            saveNow();
            skipSave.current = true;
            actions.wipeEntries();
            onClose();
          },
        },
      ]
    );

  const deleteAccount = async () => {
    if (!password) return setDeleteError('Type your password to confirm.');
    setDeleting(true);
    setDeleteError('');
    try {
      skipSave.current = true;
      await onDeleteAccount(password);
    } catch (e) {
      skipSave.current = false;
      setDeleteError(friendlyAuthError(e));
      setDeleting(false);
    }
  };

  const inTutorial = step >= 0;
  const focus = inTutorial ? STEPS[step].key : null;

  return (
    <View style={{ flex: 1 }}>
      {/* ---------- Tutorial guide (stays at the top while you scroll) ---------- */}
      {inTutorial && (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.guide}>
            <View style={styles.spaceBetween}>
              <Text style={styles.guideStep}>
                STEP {step + 1} OF {STEPS.length}
              </Text>
              <TouchableOpacity onPress={skipTutorial}>
                <Text style={{ color: C.sky, fontSize: 13 }}>Skip</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.guideTitle}>{STEPS[step].title}</Text>
            <Text style={styles.guideText}>{STEPS[step].text}</Text>
            {!!stepError && <Text style={[styles.guideText, { color: '#FFB3AE' }]}>{stepError}</Text>}
            <View style={[styles.row, { flexWrap: 'nowrap' }]}>
              {step > 0 && (
                <TouchableOpacity
                  style={[styles.guideBtn, { flex: 1, backgroundColor: 'rgba(255,255,255,0.2)' }]}
                  onPress={() => setStep(step - 1)}
                >
                  <Text style={[styles.guideBtnText, { color: '#fff' }]}>Back</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.guideBtn, { flex: 2 }]} onPress={next}>
                <Text style={styles.guideBtnText}>{step === STEPS.length - 1 ? 'Finish' : 'Next'}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}

      <ScrollView ref={scrollRef} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        {!inTutorial && (
          <View style={styles.spaceBetween}>
            <Text style={styles.title}>Settings</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.link}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ---------- Accounts ---------- */}
        <View
          onLayout={remember('accounts')}
          style={[styles.card, (focus === 'accounts' || focus === 'main') && styles.highlight]}
        >
          <Text style={styles.cardTitle}>Your accounts</Text>
          <Text style={[styles.muted, { marginBottom: 4 }]}>
            Where your money is kept. The pinned one is your main account.
          </Text>

          {accounts.map((a, i) => {
            const isMain = a.id === mainId;
            return (
              <View key={a.id} style={styles.accountEditRow}>
                <View style={styles.rowCenter}>
                  <View style={[styles.iconTile, { backgroundColor: C.skySoft }]}>
                    <AccountIcon kind={a.kind} size={20} />
                  </View>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0, paddingVertical: 10 }]}
                    placeholder={a.kind === 'cash' ? 'Cash' : NAME_HINTS[i % NAME_HINTS.length]}
                    placeholderTextColor={C.muted}
                    value={a.name}
                    onChangeText={(v) => updateAccount(a.id, 'name', v)}
                    maxLength={20}
                  />
                  <TouchableOpacity
                    onPress={() => setMainId(a.id)}
                    style={{ padding: 6 }}
                    accessibilityLabel={`Make ${a.name || 'this'} the main account`}
                  >
                    <PushPin size={22} color={isMain ? C.teal : C.border} weight={isMain ? 'fill' : 'regular'} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeAccount(a)} style={{ padding: 6 }} accessibilityLabel="Remove">
                    <X size={18} color={C.muted} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.wrap, { marginLeft: 48 }]}>
                  {ACCOUNT_KINDS.map((k) => (
                    <Chip
                      key={k.key}
                      label={k.label}
                      active={a.kind === k.key}
                      onPress={() => updateAccount(a.id, 'kind', k.key)}
                      style={{ paddingVertical: 5, paddingHorizontal: 10 }}
                    />
                  ))}
                </View>
              </View>
            );
          })}

          {accounts.length < MAX_ACCOUNTS && (
            <TouchableOpacity onPress={addAccount} style={[styles.rowCenter, { paddingTop: 12 }]}>
              <Plus size={16} color={C.teal} weight="bold" />
              <Text style={styles.link}>Add account</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ---------- You ---------- */}
        <View onLayout={remember('you')} style={[styles.card, focus === 'budget' && styles.highlight]}>
          <Text style={styles.cardTitle}>You</Text>

          <View style={[styles.rowCenter, { gap: 14, marginTop: 6 }]}>
            <Avatar name={name} photo={data.profile.photo} size={60} />
            <View style={{ gap: 6 }}>
              <TouchableOpacity
                onPress={async () => {
                  const img = await pickSmallImage({ aspect: [1, 1], width: 320 });
                  if (img) actions.setProfilePhoto(img);
                }}
              >
                <Text style={styles.link}>{data.profile.photo ? 'Change photo' : 'Add a profile photo'}</Text>
              </TouchableOpacity>
              {!!data.profile.photo && (
                <TouchableOpacity onPress={() => actions.setProfilePhoto(null)}>
                  <Text style={[styles.link, { color: C.muted, fontSize: 13 }]}>Remove photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.label}>Your name</Text>
          <TextInput
            style={styles.input}
            placeholder="What should Monee call you?"
            placeholderTextColor={C.muted}
            value={name}
            onChangeText={setName}
          />
          <Text style={styles.label}>Monthly spending budget (Rp)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 1000000"
            placeholderTextColor={C.muted}
            keyboardType="number-pad"
            value={monthly}
            onChangeText={setMonthly}
          />
          {parseAmount(monthly) > 0 && <Text style={styles.muted}>= {formatRp(parseAmount(monthly))} per month</Text>}
        </View>

        {/* Everything below is hidden during the tutorial to keep it simple */}
        {!inTutorial && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Category budgets</Text>
              <Text style={[styles.muted, { marginBottom: 8 }]}>
                Optional. Monee warns you when you reach 80% of a category’s budget.
              </Text>
              {EXPENSE_CATS.map((c) => (
                <View key={c.key} style={styles.budgetRow}>
                  <View style={[styles.rowCenter, { flex: 1 }]}>
                    <CategoryIcon name={c.key} size={18} />
                    <Text style={styles.text}>{c.key}</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.budgetInput]}
                    placeholder="No limit"
                    placeholderTextColor={C.muted}
                    keyboardType="number-pad"
                    value={budgets[c.key]}
                    onChangeText={(v) => setBudgets((b) => ({ ...b, [c.key]: v }))}
                  />
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Spreadsheet export</Text>
              <Text style={[styles.muted, { marginBottom: 4 }]}>
                Saves all your entries as a CSV file you can open in Google Sheets or Excel.
              </Text>
              <TouchableOpacity style={styles.button} onPress={onExport}>
                <View style={styles.btnContent}>
                  <Export size={18} color="#fff" weight="bold" />
                  <Text style={styles.buttonText}>Export to spreadsheet</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Login</Text>
              <Text style={styles.muted}>Logged in as</Text>
              <Text style={styles.text}>{user.email}</Text>
              <Text style={[styles.muted, { marginTop: 8 }]}>
                Your entries and goals are saved online, so they show up on any phone you log in on.
              </Text>
              <TouchableOpacity style={[styles.button, styles.buttonOutline]} onPress={confirmLogout}>
                <View style={styles.btnContent}>
                  <SignOut size={18} color={C.navy} weight="bold" />
                  <Text style={[styles.buttonText, { color: C.navy }]}>Log out</Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.button, styles.buttonDanger, { marginTop: 0 }]} onPress={confirmWipe}>
              <Text style={[styles.buttonText, { color: C.out }]}>Delete all entries and goals</Text>
            </TouchableOpacity>

            {!showDelete ? (
              <TouchableOpacity onPress={() => setShowDelete(true)} style={{ alignSelf: 'center', marginTop: 18 }}>
                <Text style={[styles.link, { color: C.out }]}>Delete my Monee account</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.card, styles.warning, { marginTop: 12 }]}>
                <Text style={styles.cardTitle}>Delete your Monee account?</Text>
                <Text style={styles.text}>
                  This erases your login and everything in it, for good. Type your password to confirm.
                </Text>
                <TextInput
                  style={[styles.input, { marginTop: 10 }]}
                  placeholder="Your password"
                  placeholderTextColor={C.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
                {!!deleteError && <Text style={styles.errorText}>{deleteError}</Text>}
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: C.out }, deleting && { opacity: 0.7 }]}
                  onPress={deleteAccount}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Delete my account forever</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowDelete(false);
                    setPassword('');
                    setDeleteError('');
                  }}
                  style={{ alignSelf: 'center', marginTop: 12 }}
                >
                  <Text style={styles.link}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
