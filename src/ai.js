// AI receipt reader (Google Gemini)
import { EXPENSE_CATS, WALLETS } from './constants';

// The key comes from the .env file in your project folder:
//   EXPO_PUBLIC_GEMINI_API_KEY=your-key-here
// ⚠️ For testing only. Before sharing the app, move this call to a backend.
const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.5-flash-lite'; // swap to 'gemini-3.8-flash' if it struggles

const RECEIPT_PROMPT = `You read shopping receipts for an Indonesian money-tracking app.
The picture is either a photo of a paper receipt or a screenshot of a digital one
(GoPay, OVO, DANA, ShopeePay, Tokopedia, GrabFood, bank transfer, etc.).

Rules:
- All money is Indonesian Rupiah. Return plain integers: "Rp25.000" or "25,000" -> 25000.
- "total" is the final amount actually paid, after discounts, tax and service.
- "items" are the purchased products only. Skip subtotal, tax (PPN), discount, change (kembali) and payment lines.
  If a line has a quantity, "price" is the line total for that item.
- "date" is the purchase date as YYYY-MM-DD, or "" if you can't see it.
- "category" is the single best fit from the allowed list.
- "wallet": "E-wallet" for GoPay/OVO/DANA/ShopeePay/QRIS, "Bank" for debit/credit card or transfer, otherwise "Cash".
- "paid_with": the payment method name exactly as printed (e.g. "GoPay", "OVO", "BCA Debit", "Tunai"), or "" if not shown.
- If the picture is not a receipt, set is_receipt to false and leave the rest empty.`;

const RECEIPT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    is_receipt: { type: 'BOOLEAN' },
    store: { type: 'STRING' },
    date: { type: 'STRING' },
    total: { type: 'INTEGER' },
    category: { type: 'STRING', enum: EXPENSE_CATS.map((c) => c.key) },
    wallet: { type: 'STRING', enum: WALLETS.map((w) => w.key) },
    paid_with: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { name: { type: 'STRING' }, price: { type: 'INTEGER' } },
        required: ['name', 'price'],
      },
    },
  },
  required: ['is_receipt', 'store', 'date', 'total', 'category', 'wallet', 'paid_with', 'items'],
};

// Sends the picture to Gemini and returns { store, date, total, category, wallet, paidWith, items }
export async function readReceiptWithAI(base64, mimeType = 'image/jpeg') {
  if (!GEMINI_KEY) {
    throw new Error(
      'No API key found. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env file, then restart with "npx expo start -c".'
    );
  }

  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mimeType, data: base64 } },
                { text: RECEIPT_PROMPT },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RECEIPT_SCHEMA,
            temperature: 0,
          },
        }),
      }
    );
  } catch (e) {
    throw new Error('Couldn’t reach the AI. Check your internet connection and try again.');
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 429) throw new Error('You’ve hit the free scan limit for now. Wait a minute (or until tomorrow) and try again.');
    if (res.status === 400 || res.status === 403) {
      throw new Error(`The AI rejected the request: ${json?.error?.message || 'check that your API key is correct.'}`);
    }
    throw new Error(json?.error?.message || `The AI returned an error (${res.status}).`);
  }

  const text = (json?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  let data;
  try {
    data = JSON.parse(text.replace(/^```(json)?|```$/g, '').trim());
  } catch (e) {
    throw new Error('The AI’s answer couldn’t be read. Try a clearer picture.');
  }
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
