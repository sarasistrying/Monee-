// The "accounts" system: where your money actually is (GoPay, OVO, BCA, cash…)
//
// Each account looks like: { id, name: 'GoPay', kind: 'ewallet' | 'bank' | 'cash' }
// Each entry (transaction) has an accountId saying which account it came from / went into.
// Each goal has an accountId saying which account its savings are kept in.

export const ACCOUNT_KINDS = [
  { key: 'ewallet', label: 'E-money' },
  { key: 'bank', label: 'Bank' },
  { key: 'cash', label: 'Cash' },
];
const KIND_KEYS = ACCOUNT_KINDS.map((k) => k.key);

export const MAX_ACCOUNTS = 5;

// Used until you set up your own accounts
export const DEFAULT_ACCOUNTS = [{ id: 'cash', name: 'Cash', kind: 'cash' }];

export const kindLabel = (kind) => (ACCOUNT_KINDS.find((k) => k.key === kind) || ACCOUNT_KINDS[0]).label;

export function normalizeAccounts(list) {
  const accounts = (Array.isArray(list) ? list : [])
    .filter((a) => a && a.id && String(a.name || '').trim())
    .map((a) => ({
      id: String(a.id),
      name: String(a.name).trim(),
      kind: KIND_KEYS.includes(a.kind) ? a.kind : 'ewallet',
    }));
  return accounts.length ? accounts : DEFAULT_ACCOUNTS;
}

// Entries saved before accounts existed only say 'Cash', 'E-wallet' or 'Bank'.
// This finds the best matching account for them.
export function legacyAccountId(wallet, accounts, mainId) {
  const firstOfKind = (k) => accounts.find((a) => a.kind === k)?.id;
  if (wallet === 'Cash') return firstOfKind('cash') || mainId;
  if (wallet === 'E-wallet') return firstOfKind('ewallet') || mainId;
  if (wallet === 'Bank') return firstOfKind('bank') || mainId;
  return mainId;
}

// Takes the raw data from the database and makes sure every entry and goal points to a real account.
// sharedGoals = goals you save for together with friends, invites = shared goals you were invited to.
export function resolveData({
  uid,
  moneeId,
  profile,
  budgets,
  accounts: rawAccounts,
  mainAccountId,
  onboarded,
  transactions,
  goals,
  sharedGoals = [],
  invites = [],
}) {
  const accounts = normalizeAccounts(rawAccounts);
  const ids = new Set(accounts.map((a) => a.id));
  const mainId = ids.has(mainAccountId) ? mainAccountId : accounts[0].id;
  return {
    uid,
    moneeId: moneeId || null,
    profile,
    budgets,
    accounts,
    mainAccountId: mainId,
    onboarded: !!onboarded,
    transactions: transactions.map((t) =>
      ids.has(t.accountId) ? t : { ...t, accountId: legacyAccountId(t.wallet, accounts, mainId) }
    ),
    goals: goals.map((g) => (ids.has(g.accountId) ? g : { ...g, accountId: mainId })),
    // For shared goals, "myAccountId" is which of YOUR accounts your part is kept in
    sharedGoals: sharedGoals.map((g) => {
      const mine = g.accounts?.[uid];
      return { ...g, myAccountId: ids.has(mine) ? mine : mainId };
    }),
    invites,
  };
}

// How much each person has put into a shared goal, and the total
export const myShare = (goal, uid) => Number(goal.contributions?.[uid]) || 0;
export const sharedTotal = (goal) =>
  Object.values(goal.contributions || {}).reduce((s, v) => s + (Number(v) || 0), 0);

// How much is in each account.
//   balance   = everything in − everything out
//   saved     = money set aside for goals in this account
//   available = balance − saved  (what you can actually spend)
export function accountBalances(data) {
  const byId = {};
  data.accounts.forEach((a) => (byId[a.id] = { balance: 0, saved: 0, available: 0 }));
  for (const t of data.transactions) {
    const b = byId[t.accountId];
    if (b) b.balance += t.type === 'income' ? t.amount : -t.amount;
  }
  for (const g of data.goals) {
    const b = byId[g.accountId];
    if (b) b.saved += g.saved;
  }
  // Your part of shared goals is set aside too (only your part: friends' money is in their own accounts)
  for (const g of data.sharedGoals || []) {
    const b = byId[g.myAccountId];
    if (b) b.saved += myShare(g, data.uid);
  }
  let total = 0;
  Object.values(byId).forEach((b) => {
    b.available = b.balance - b.saved;
    total += b.available;
  });
  return { byId, total };
}

export const accountName = (accounts, id) => accounts.find((a) => a.id === id)?.name || 'Account';

// For the AI scanner: finds the account that matches what's printed on the receipt
// (e.g. "Paid with GoPay" → your account named "GoPay")
export function matchAccount(accounts, mainId, { paymentText, wallet }) {
  const text = String(paymentText || '').toLowerCase();
  if (text) {
    const hit = accounts.find((a) => {
      const n = a.name.toLowerCase();
      return n.length >= 2 && (text.includes(n) || (text.length >= 3 && n.includes(text)));
    });
    if (hit) return hit.id;
  }
  return legacyAccountId(wallet, accounts, mainId);
}

/* ---------- Streak: days in a row you stayed within your daily amount ---------- */
//
// Home's daily amount for a day is:
//     (money in your main account at the start of that day + money that came in that day) ÷ days left in the month
// A day keeps the streak going if you spent no more than that (spending nothing counts too).
// Going over resets it to 0.
//
// We work it out again from your history every time, so it's always right even if you skip opening the app.
// (For past days we can't know how much was set aside for goals back then, so goals are left out of past days.
//  Today uses exactly the same number as Home.)
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function dailyStreak(data, now = new Date()) {
  const mainId = data.mainAccountId;
  const mine = data.transactions.filter((t) => t.accountId === mainId);
  if (!mine.length) return { current: 0, best: 0, todayOk: true };

  // Add up each day's money in and money out
  const perDay = {};
  let first = null;
  for (const t of mine) {
    const d = new Date(t.date);
    if (d > now) continue;
    const k = dayKey(d);
    perDay[k] = perDay[k] || { inc: 0, out: 0 };
    if (t.type === 'income') perDay[k].inc += t.amount;
    else perDay[k].out += t.amount;
    if (!first || d < first) first = d;
  }
  if (!first) return { current: 0, best: 0, todayOk: true };

  // What's set aside for goals in the main account right now (used for today only)
  const savedNow = accountBalances(data).byId[mainId]?.saved || 0;

  const day = new Date(first.getFullYear(), first.getMonth(), first.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Don't go back more than ~13 months, to keep it fast
  const oldest = new Date(today);
  oldest.setDate(oldest.getDate() - 400);
  let balanceBefore = 0; // main account balance at the start of `day`
  if (day < oldest) {
    for (const t of mine) {
      if (new Date(t.date) < oldest) balanceBefore += t.type === 'income' ? t.amount : -t.amount;
    }
    day.setTime(oldest.getTime());
  }

  let run = 0;
  let best = 0;
  let todayOk = true;
  while (day <= today) {
    const { inc = 0, out = 0 } = perDay[dayKey(day)] || {};
    const isToday = day.getTime() === today.getTime();
    const daysLeft = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate() - day.getDate() + 1;
    const available = balanceBefore + inc - (isToday ? savedNow : 0);
    const allowance = Math.max(0, Math.floor(available / daysLeft));
    const ok = out <= allowance;
    if (isToday) {
      todayOk = ok;
      // Today isn't over yet: it adds to the streak while you're still under, and breaks it if you go over
      run = ok ? run + 1 : 0;
    } else {
      run = ok ? run + 1 : 0;
    }
    best = Math.max(best, run);
    balanceBefore += inc - out;
    day.setDate(day.getDate() + 1);
  }
  return { current: run, best, todayOk };
}
