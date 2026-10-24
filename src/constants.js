// Lists and settings used all over the app

export const EXPENSE_CATS = [
  { key: 'Food', emoji: '🍜' },
  { key: 'Drinks', emoji: '🧋' },
  { key: 'Transport', emoji: '🛵' },
  { key: 'School', emoji: '📚' },
  { key: 'Fun', emoji: '🎮' },
  { key: 'Shopping', emoji: '🛍️' },
  { key: 'Data & Top-up', emoji: '📱' },
  { key: 'Gifts', emoji: '🎁' },
  { key: 'Other', emoji: '📦' },
];

export const INCOME_CATS = [
  { key: 'Allowance', emoji: '💵' },
  { key: 'Gift money', emoji: '🧧' },
  { key: 'Part-time', emoji: '💼' },
  { key: 'Selling stuff', emoji: '🏷️' },
  { key: 'Other income', emoji: '✨' },
];

export const WALLETS = [
  { key: 'Cash', emoji: '💵' },
  { key: 'E-wallet', emoji: '📲' },
  { key: 'Bank', emoji: '🏦' },
];

// Icons you can pick for a goal (drawn in src/icons.js)
export const GOAL_ICON_KEYS = ['target', 'savings', 'headphones', 'sneaker', 'phone', 'game', 'laptop', 'travel', 'gift'];

// Goals made before icons existed stored an emoji; this turns them into the matching icon
export const LEGACY_GOAL_EMOJI = {
  '🎯': 'target',
  '🎧': 'headphones',
  '👟': 'sneaker',
  '📱': 'phone',
  '🎮': 'game',
  '💻': 'laptop',
  '✈️': 'travel',
  '🎁': 'gift',
};

export const DEADLINES = [
  { label: 'No deadline', months: 0 },
  { label: '1 month', months: 1 },
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
];

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Where the old (before accounts) version saved data on the phone
export const LEGACY_STORAGE_KEY = 'moneyapp-data-v1';

export const DEFAULT_PROFILE = { name: '', monthlyBudget: 0, photo: null };

// Every transaction has these fields, so old or partial data never breaks the app
export const TX_DEFAULTS = {
  type: 'expense',
  amount: 0,
  category: 'Other',
  wallet: 'Cash',
  store: '',
  note: '',
  items: [],
  receiptUri: null,
  date: new Date(0).toISOString(),
};
