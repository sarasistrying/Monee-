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

// Takes the raw data from the database and makes sure every entry and goal points to a real account
export function resolveData({ profile, budgets, accounts: rawAccounts, mainAccountId, onboarded, transactions, goals }) {
  const accounts = normalizeAccounts(rawAccounts);
  const ids = new Set(accounts.map((a) => a.id));
  const mainId = ids.has(mainAccountId) ? mainAccountId : accounts[0].id;
  return {
    profile,
    budgets,
    accounts,
    mainAccountId: mainId,
    onboarded: !!onboarded,
    transactions: transactions.map((t) =>
      ids.has(t.accountId) ? t : { ...t, accountId: legacyAccountId(t.wallet, accounts, mainId) }
    ),
    goals: goals.map((g) => (ids.has(g.accountId) ? g : { ...g, accountId: mainId })),
  };
}

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
