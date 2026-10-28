// AI receipt reader
//
// The app no longer talks to Gemini directly. It sends the picture to YOUR scanner server
// (the "monee-scan" Cloudflare Worker), which holds the Gemini key secretly and checks
// that the person is logged in. So no secret key is inside the app any more.
//
// Set the server's address in .env:
//   EXPO_PUBLIC_SCAN_URL=https://monee-scan.your-name.workers.dev
import { auth } from './firebase';
import { EXPENSE_CATS, WALLETS } from './constants';

const SCAN_URL = (process.env.EXPO_PUBLIC_SCAN_URL || '').replace(/\/+$/, '');

// Sends the picture to the scanner and returns { store, date, total, category, wallet, paidWith, items }
export async function readReceiptWithAI(base64, mimeType = 'image/jpeg') {
  if (!SCAN_URL) {
    throw new Error(
      'The scanner isn’t set up yet. Add EXPO_PUBLIC_SCAN_URL to your .env file, then restart with "npx expo start -c".'
    );
  }
  const user = auth?.currentUser;
  if (!user) throw new Error('Please log in to scan receipts.');

  // A short-lived login token that proves to the server who you are (Firebase refreshes it automatically)
  const token = await user.getIdToken();

  let res;
  try {
    res = await fetch(`${SCAN_URL}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ image: base64, mimeType }),
    });
  } catch (e) {
    throw new Error('Couldn’t reach the scanner. Check your internet connection and try again.');
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `The scanner returned an error (${res.status}).`);

  const data = body.data || {};
  if (!data.is_receipt) throw new Error('That doesn’t look like a receipt. Try another picture.');

  const items = (data.items || [])
    .map((i) => ({ name: String(i.name || '').trim(), price: Math.round(Number(i.price) || 0) }))
    .filter((i) => i.name || i.price);
  const total = Math.round(Number(data.total) || 0) || items.reduce((s, i) => s + i.price, 0);

  // Only use the receipt's date if it's real and not in the future
  let date = new Date();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(data.date || '') ? new Date(`${data.date}T12:00:00`) : null;
  if (parsed && !isNaN(parsed) && parsed <= new Date()) date = parsed;

  return {
    store: String(data.store || '').trim(),
    total,
    category: EXPENSE_CATS.some((c) => c.key === data.category) ? data.category : 'Other',
    wallet: WALLETS.some((w) => w.key === data.wallet) ? data.wallet : 'Cash',
    paidWith: String(data.paid_with || '').trim(),
    items,
    date: date.toISOString(),
  };
}
