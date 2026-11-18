// Monee IDs: short codes like "7K4Q2X" that friends can share to find each other.
//
// Firebase already gives every account an ID (the uid), but it's 28 random characters,
// way too long to type. So each person also gets a short Monee ID, saved in two places:
//   users/{uid}.moneeId   ← "this is my code"
//   codes/{CODE}          ← { uid, name }: lets a friend look you up by your code
//
// The security rules let anyone logged in look up ONE code they already know,
// but nobody can list all codes, so you can't browse other people.
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// No 0/O, 1/I/L, so codes are easy to read out loud
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 6;

const randomCode = () =>
  Array.from({ length: LENGTH }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

// "7k4 q2x" → "7K4Q2X". Returns '' if it can't be a valid code.
export function cleanCode(text) {
  const c = String(text || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^MONEE/, '');
  return c.length === LENGTH && [...c].every((ch) => ALPHABET.includes(ch)) ? c : '';
}

// Gives this person a Monee ID if they don't have one yet, and keeps the name on it up to date
export async function ensureMoneeId(uid, currentCode, name) {
  if (currentCode) {
    // Keep the name friends see when they look you up in sync with your profile
    await setDoc(doc(db, 'codes', currentCode), { uid, name: name || '' }, { merge: true });
    return currentCode;
  }
  // Pick a random code. If it's taken (very rare), the rules refuse it and we try another one.
  for (let tries = 0; tries < 6; tries++) {
    const code = randomCode();
    try {
      await setDoc(doc(db, 'codes', code), { uid, name: name || '' });
      await setDoc(doc(db, 'users', uid), { moneeId: code }, { merge: true });
      return code;
    } catch (e) {
      if (e?.code !== 'permission-denied') throw e;
    }
  }
  throw new Error('Couldn’t make a Monee ID. Try again later.');
}

// Finds a friend by their code. Returns { uid, name } or null.
export async function findByCode(text) {
  const code = cleanCode(text);
  if (!code) return null;
  const snap = await getDoc(doc(db, 'codes', code));
  return snap.exists() ? { uid: snap.data().uid, name: snap.data().name || 'Your friend', code } : null;
}
