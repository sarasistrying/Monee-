// Small helper functions: money, dates and the spreadsheet export
import { Platform, Share } from 'react-native';
import { showAlert } from './dialog';
import { EXPENSE_CATS, INCOME_CATS, MONTHS } from './constants';

// 25000 -> "Rp 25.000",  -5000 -> "−Rp 5.000"
export const formatRp = (n) => {
  const v = Math.round(Math.abs(n || 0));
  return (n < 0 ? '−' : '') + 'Rp ' + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// 1250000 -> "1.3jt", 350000 -> "350rb"  (for small chart labels)
export const formatShort = (n) => {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'jt';
  if (n >= 1e3) return Math.round(n / 1e3) + 'rb';
  return String(Math.round(n));
};

// "25.000" / "25000" / "Rp25,000" -> 25000
export const parseAmount = (s) => Number(String(s ?? '').replace(/[^0-9]/g, '')) || 0;

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const pad = (n) => String(n).padStart(2, '0');
export const fmtDate = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
export const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const inMonth = (iso, y, m) => {
  const d = new Date(iso);
  return d.getFullYear() === y && d.getMonth() === m;
};
export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
export const shiftMonth = ({ y, m }, delta) => {
  const d = new Date(y, m + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
};
export const dayLabel = (d) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return fmtDate(d);
};

export const catEmoji = (key) =>
  ([...EXPENSE_CATS, ...INCOME_CATS].find((c) => c.key === key) || { emoji: '📦' }).emoji;

// Builds a CSV spreadsheet and opens the share menu
export async function exportCsv(transactions, accounts = []) {
  if (!transactions.length) {
    showAlert('Nothing to export yet', 'Add a few entries first.');
    return;
  }
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Date', 'Type', 'Category', 'Account', 'Store', 'Note', 'Items', 'Amount (Rp)'];
  const rows = transactions.map((t) => [
    isoDay(new Date(t.date)),
    t.type === 'income' ? 'Money in' : 'Money out',
    t.category,
    accounts.find((a) => a.id === t.accountId)?.name || t.wallet,
    t.store,
    t.note,
    (t.items || []).map((i) => `${i.name} (${i.price})`).join(' | '),
    t.type === 'income' ? t.amount : -t.amount,
  ]);
  const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');

  // On the website: download the file straight away
  if (Platform.OS === 'web') {
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }); // \uFEFF helps Excel read the Rp symbols
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `monee-export-${isoDay(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    return;
  }

  try {
    // Loaded only on phones (these packages don't work in a browser)
    const Sharing = require('expo-sharing');
    const { File, Paths } = require('expo-file-system');
    const file = new File(Paths.cache, `monee-export-${isoDay(new Date())}.csv`);
    if (file.exists) file.delete();
    file.create();
    file.write(csv);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Monee data',
        UTI: 'public.comma-separated-values-text',
      });
      return;
    }
  } catch (e) {
    console.warn('File export failed, sharing as text instead', e);
  }
  await Share.share({ message: csv });
}
