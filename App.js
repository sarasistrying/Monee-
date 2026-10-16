import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

/* =========================================================
   1. COLOURS, CATEGORIES & SETTINGS
   ========================================================= */

const C = {
  navy: '#1E3260',
  teal: '#3A7F99',
  sky: '#89BBD6',
  yellow: '#F9DC7E',
  bg: '#F2F6F9',
  card: '#FFFFFF',
  text: '#1A2540',
  muted: '#6B7A90',
  border: '#E1E8EF',
  skySoft: '#E3EFF6',
  yellowSoft: '#FDF3D2',
  in: '#2E8B6E',
  out: '#D9534F',
};

const EXPENSE_CATS = [
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

const INCOME_CATS = [
  { key: 'Allowance', emoji: '💵' },
  { key: 'Gift money', emoji: '🧧' },
  { key: 'Part-time', emoji: '💼' },
  { key: 'Selling stuff', emoji: '🏷️' },
  { key: 'Other income', emoji: '✨' },
];

const WALLETS = [
  { key: 'Cash', emoji: '💵' },
  { key: 'E-wallet', emoji: '📲' },
  { key: 'Bank', emoji: '🏦' },
];

const GOAL_EMOJIS = ['🎯', '🎧', '👟', '📱', '🎮', '💻', '✈️', '🎁'];

const DEADLINES = [
  { label: 'No deadline', months: 0 },
  { label: '1 month', months: 1 },
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
];

// Same key as version 1, so the test data you already entered is kept
const STORAGE_KEY = 'moneyapp-data-v1';

const DEFAULT_DATA = {
  profile: { name: '', monthlyBudget: 0 },
  transactions: [],
  goals: [],
  budgets: {}, // e.g. { Food: 300000 }
};

/* =========================================================
   2. HELPERS (money, dates, saving)
   ========================================================= */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// 25000 -> "Rp 25.000",  -5000 -> "−Rp 5.000"
const formatRp = (n) => {
  const v = Math.round(Math.abs(n || 0));
  return (n < 0 ? '−' : '') + 'Rp ' + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// 1250000 -> "1.3jt", 350000 -> "350rb"  (for small chart labels)
const formatShort = (n) => {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'jt';
  if (n >= 1e3) return Math.round(n / 1e3) + 'rb';
  return String(Math.round(n));
};

// "25.000" / "25000" / "Rp25,000" -> 25000
const parseAmount = (s) => Number(String(s ?? '').replace(/[^0-9]/g, '')) || 0;

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const inMonth = (iso, y, m) => {
  const d = new Date(iso);
  return d.getFullYear() === y && d.getMonth() === m;
};
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const shiftMonth = ({ y, m }, delta) => {
  const d = new Date(y, m + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
};
const dayLabel = (d) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return fmtDate(d);
};

const catEmoji = (key) =>
  ([...EXPENSE_CATS, ...INCOME_CATS].find((c) => c.key === key) || { emoji: '📦' }).emoji;

// Upgrades data saved by the first version of the app
function migrate(raw) {
  const d = { ...DEFAULT_DATA, ...raw };
  d.profile = { ...DEFAULT_DATA.profile, ...(raw.profile || {}) };
  d.budgets = raw.budgets || {};
  d.transactions = (raw.transactions || [])
    .map((t) => ({
      wallet: 'Cash',
      store: '',
      note: '',
      items: [],
      receiptUri: null,
      ...t,
      category: t.category === 'Income' ? 'Allowance' : t.category,
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  d.goals = (raw.goals || []).map((g) => ({ emoji: '🎯', deadline: null, ...g }));
  return d;
}

// Builds a CSV spreadsheet and opens the share menu
async function exportCsv(transactions) {
  if (!transactions.length) {
    Alert.alert('Nothing to export yet', 'Add a few entries first.');
    return;
  }
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Date', 'Type', 'Category', 'Wallet', 'Store', 'Note', 'Items', 'Amount (Rp)'];
  const rows = transactions.map((t) => [
    isoDay(new Date(t.date)),
    t.type === 'income' ? 'Money in' : 'Money out',
    t.category,
    t.wallet,
    t.store,
    t.note,
    (t.items || []).map((i) => `${i.name} (${i.price})`).join(' | '),
    t.type === 'income' ? t.amount : -t.amount,
  ]);
  const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');

  try {
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

/* =========================================================
   3. MAIN APP
   ========================================================= */

export default function App() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('home');
  const [addMode, setAddMode] = useState('manual');
  const [overlay, setOverlay] = useState(null); // { type: 'edit', tx } or { type: 'settings' }

  // Load saved data when the app opens
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setData(migrate(JSON.parse(raw)));
      } catch (e) {
        console.warn('Could not load data', e);
      }
      setLoaded(true);
    })();
  }, []);

  // Save every time data changes
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch((e) =>
      console.warn('Could not save data', e)
    );
  }, [data, loaded]);

  // ----- actions that change data -----
  const saveTx = (tx) =>
    setData((d) => {
      const exists = d.transactions.some((t) => t.id === tx.id);
      const list = exists
        ? d.transactions.map((t) => (t.id === tx.id ? tx : t))
        : [tx, ...d.transactions];
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      return { ...d, transactions: list };
    });

  const confirmDeleteTx = (id) =>
    Alert.alert('Delete this entry?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setData((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }));
          setOverlay(null);
        },
      },
    ]);

  const setGoals = (fn) => setData((d) => ({ ...d, goals: fn(d.goals) }));
  const setProfile = (p) => setData((d) => ({ ...d, profile: { ...d.profile, ...p } }));
  const setBudget = (cat, amount) =>
    setData((d) => ({ ...d, budgets: { ...d.budgets, [cat]: amount } }));

  const balance = useMemo(() => {
    let b = 0;
    for (const t of data.transactions) b += t.type === 'income' ? t.amount : -t.amount;
    return b - data.goals.reduce((s, g) => s + g.saved, 0);
  }, [data]);

  const goTab = (t, mode) => {
    if (mode) setAddMode(mode);
    setTab(t);
  };
  const openEdit = (tx) => setOverlay({ type: 'edit', tx });

  // ----- choose what to show -----
  let content;
  if (!loaded) {
    content = (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  } else if (overlay?.type === 'edit') {
    content = (
      <EditScreen
        tx={overlay.tx}
        onClose={() => setOverlay(null)}
        onSave={(t) => {
          saveTx(t);
          setOverlay(null);
        }}
        onDelete={() => confirmDeleteTx(overlay.tx.id)}
      />
    );
  } else if (overlay?.type === 'settings') {
    content = (
      <SettingsScreen
        data={data}
        setProfile={setProfile}
        setBudget={setBudget}
        onExport={() => exportCsv(data.transactions)}
        onReset={() => setData(DEFAULT_DATA)}
        onClose={() => setOverlay(null)}
      />
    );
  } else if (tab === 'home') {
    content = (
      <HomeScreen
        data={data}
        balance={balance}
        onEdit={openEdit}
        onSettings={() => setOverlay({ type: 'settings' })}
        goTab={goTab}
      />
    );
  } else if (tab === 'history') {
    content = <HistoryScreen transactions={data.transactions} onEdit={openEdit} />;
  } else if (tab === 'add') {
    content = (
      <AddScreen
        mode={addMode}
        setMode={setAddMode}
        onSave={(t) => {
          saveTx(t);
          setTab('home');
        }}
      />
    );
  } else if (tab === 'goals') {
    content = <GoalsScreen goals={data.goals} setGoals={setGoals} balance={balance} />;
  } else {
    content = <InsightsScreen data={data} />;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="light" />
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ flex: 1 }}>{content}</View>
          {!overlay && loaded && <TabBar tab={tab} setTab={setTab} />}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

/* =========================================================
   4. SMALL REUSABLE PIECES
   ========================================================= */

function Chip({ label, active, onPress, style }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive, style]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ProgressBar({ pct, color = C.teal, bg = C.skySoft }) {
  return (
    <View style={[styles.barBg, { backgroundColor: bg }]}>
      <View style={[styles.barFill, { width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }]} />
    </View>
  );
}

function MonthSwitcher({ cursor, setCursor }) {
  const now = new Date();
  const atCurrent = cursor.y === now.getFullYear() && cursor.m === now.getMonth();
  return (
    <View style={styles.monthSwitcher}>
      <TouchableOpacity onPress={() => setCursor(shiftMonth(cursor, -1))} style={styles.arrowBtn}>
        <Text style={styles.arrow}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.monthText}>
        {FULL_MONTHS[cursor.m]} {cursor.y}
      </Text>
      <TouchableOpacity
        disabled={atCurrent}
        onPress={() => setCursor(shiftMonth(cursor, 1))}
        style={[styles.arrowBtn, atCurrent && { opacity: 0.25 }]}
      >
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

function TxRow({ tx, onPress }) {
  const isIn = tx.type === 'income';
  return (
    <TouchableOpacity style={styles.txRow} onPress={onPress} activeOpacity={0.7}>
      {tx.receiptUri ? (
        <Image source={{ uri: tx.receiptUri }} style={styles.txIcon} />
      ) : (
        <View style={[styles.txIcon, { backgroundColor: isIn ? C.skySoft : C.yellowSoft }]}>
          <Text style={{ fontSize: 18 }}>{catEmoji(tx.category)}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.txTitle} numberOfLines={1}>
          {tx.store || tx.note || tx.category}
        </Text>
        <Text style={styles.muted} numberOfLines={1}>
          {tx.category} · {tx.wallet}
        </Text>
      </View>
      <Text style={[styles.txAmount, { color: isIn ? C.in : C.out }]}>
        {isIn ? '+' : '−'}
        {formatRp(tx.amount)}
      </Text>
    </TouchableOpacity>
  );
}

function SectionTitle({ children, right }) {
  return (
    <View style={[styles.spaceBetween, { marginTop: 8, marginBottom: 8 }]}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

/* =========================================================
   5. HOME
   ========================================================= */

function HomeScreen({ data, balance, onEdit, onSettings, goTab }) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const s = useMemo(() => {
    let monthIn = 0;
    let monthOut = 0;
    const wallets = {};
    WALLETS.forEach((w) => (wallets[w.key] = 0));
    const catSpent = {};
    for (const t of data.transactions) {
      const sign = t.type === 'income' ? 1 : -1;
      wallets[t.wallet] = (wallets[t.wallet] || 0) + sign * t.amount;
      if (inMonth(t.date, y, m)) {
        if (t.type === 'income') monthIn += t.amount;
        else {
          monthOut += t.amount;
          catSpent[t.category] = (catSpent[t.category] || 0) + t.amount;
        }
      }
    }
    return { monthIn, monthOut, wallets, catSpent };
  }, [data, y, m]);

  const budget = data.profile.monthlyBudget;
  const daysLeft = daysInMonth(y, m) - now.getDate() + 1;
  const left = budget - s.monthOut;
  const perDay = left > 0 ? left / daysLeft : 0;
  const warnings = EXPENSE_CATS.filter(
    (c) => data.budgets[c.key] > 0 && (s.catSpent[c.key] || 0) >= 0.8 * data.budgets[c.key]
  );
  const topGoal = data.goals.find((g) => g.saved < g.target);
  const recent = data.transactions.slice(0, 5);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      {/* Navy header */}
      <View style={styles.hero}>
        <View style={styles.spaceBetween}>
          <View>
            <Text style={styles.heroHello}>
              Hi{data.profile.name ? `, ${data.profile.name}` : ''} 👋
            </Text>
            <Text style={styles.heroSub}>
              {FULL_MONTHS[m]} {y}
            </Text>
          </View>
          <TouchableOpacity onPress={onSettings} style={styles.iconBtn}>
            <Text style={{ fontSize: 20 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.heroLabel}>Money you can spend</Text>
        <Text style={styles.heroBalance}>{formatRp(balance)}</Text>

        <View style={styles.heroRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>In this month</Text>
            <Text style={styles.heroStatValue}>+{formatRp(s.monthIn)}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Out this month</Text>
            <Text style={styles.heroStatValue}>−{formatRp(s.monthOut)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.screen}>
        {/* Wallets */}
        <View style={styles.row}>
          {WALLETS.map((w) => (
            <View key={w.key} style={[styles.card, styles.walletBox]}>
              <Text style={{ fontSize: 18 }}>{w.emoji}</Text>
              <Text style={styles.muted}>{w.key}</Text>
              <Text style={styles.walletValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatRp(s.wallets[w.key] || 0)}
              </Text>
            </View>
          ))}
        </View>

        {/* Quick add */}
        <View style={styles.row}>
          <TouchableOpacity style={[styles.button, { flex: 1 }]} onPress={() => goTab('add', 'manual')}>
            <Text style={styles.buttonText}>✏️ Add entry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonYellow, { flex: 1 }]}
            onPress={() => goTab('add', 'scan')}
          >
            <Text style={[styles.buttonText, { color: C.navy }]}>🧾 Scan receipt</Text>
          </TouchableOpacity>
        </View>

        {/* Monthly budget */}
        <View style={styles.card}>
          {budget > 0 ? (
            <>
              <View style={styles.spaceBetween}>
                <Text style={styles.cardTitle}>Monthly budget</Text>
                <Text style={styles.muted}>{daysLeft} days left</Text>
              </View>
              <ProgressBar
                pct={(s.monthOut / budget) * 100}
                color={left < 0 ? C.out : s.monthOut > budget * 0.8 ? '#E0A800' : C.teal}
              />
              <Text style={[styles.text, { marginTop: 8 }]}>
                {left >= 0
                  ? `${formatRp(left)} left of ${formatRp(budget)}`
                  : `Over budget by ${formatRp(-left)} 😬`}
              </Text>
              {left > 0 && (
                <View style={styles.tip}>
                  <Text style={styles.tipText}>
                    💡 You can spend about <Text style={{ fontWeight: '800' }}>{formatRp(perDay)}</Text> per
                    day to stay on track.
                  </Text>
                </View>
              )}
            </>
          ) : (
            <TouchableOpacity onPress={onSettings}>
              <Text style={styles.cardTitle}>Set a monthly budget</Text>
              <Text style={styles.muted}>
                Tell Monee how much you want to spend each month, and it’ll show how much you can spend
                per day. Tap to set it up →
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category warnings */}
        {warnings.map((c) => {
          const spent = s.catSpent[c.key] || 0;
          const over = spent > data.budgets[c.key];
          return (
            <View key={c.key} style={[styles.card, styles.warning]}>
              <Text style={styles.text}>
                {c.emoji} {over ? 'Over' : 'Almost at'} your {c.key} budget: {formatRp(spent)} of{' '}
                {formatRp(data.budgets[c.key])}
              </Text>
            </View>
          );
        })}

        {/* Top goal */}
        {topGoal && (
          <TouchableOpacity style={styles.card} onPress={() => goTab('goals')} activeOpacity={0.8}>
            <View style={styles.spaceBetween}>
              <Text style={styles.cardTitle}>
                {topGoal.emoji} {topGoal.name}
              </Text>
              <Text style={styles.muted}>{Math.round((topGoal.saved / topGoal.target) * 100)}%</Text>
            </View>
            <ProgressBar pct={(topGoal.saved / topGoal.target) * 100} color={C.yellow} bg={C.skySoft} />
            <Text style={[styles.muted, { marginTop: 6 }]}>
              {formatRp(topGoal.saved)} of {formatRp(topGoal.target)}
            </Text>
          </TouchableOpacity>
        )}

        {/* Recent */}
        <SectionTitle
          right={
            data.transactions.length > 5 ? (
              <TouchableOpacity onPress={() => goTab('history')}>
                <Text style={styles.link}>See all</Text>
              </TouchableOpacity>
            ) : null
          }
        >
          Recent
        </SectionTitle>
        <View style={styles.card}>
          {recent.length === 0 ? (
            <Text style={styles.muted}>Nothing here yet. Add your first entry above!</Text>
          ) : (
            recent.map((t) => <TxRow key={t.id} tx={t} onPress={() => onEdit(t)} />)
          )}
        </View>
      </View>
    </ScrollView>
  );
}

/* =========================================================
   6. ADD (manual + scan)
   ========================================================= */

function AddScreen({ mode, setMode, onSave }) {
  const [imageUri, setImageUri] = useState(null);

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera needed', 'Please allow camera access to scan paper receipts.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>New entry</Text>

      <View style={styles.segment}>
        {[
          { key: 'manual', label: '✏️ Type it in' },
          { key: 'scan', label: '🧾 Scan receipt' },
        ].map((o) => (
          <TouchableOpacity
            key={o.key}
            style={[styles.segmentBtn, mode === o.key && styles.segmentActive]}
            onPress={() => setMode(o.key)}
          >
            <Text style={[styles.segmentText, mode === o.key && styles.segmentTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'manual' ? (
        <TransactionForm onSave={onSave} submitLabel="Save entry" />
      ) : !imageUri ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add a receipt</Text>
          <Text style={[styles.muted, { marginBottom: 4 }]}>
            📷 Paper receipt → take a photo.{'\n'}🖼️ Digital receipt (GoPay, ShopeePay, online order…) →
            pick the screenshot from your gallery.
          </Text>
          <TouchableOpacity style={styles.button} onPress={takePhoto}>
            <Text style={styles.buttonText}>📷 Take photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.buttonOutline]} onPress={pickImage}>
            <Text style={[styles.buttonText, { color: C.navy }]}>🖼️ Choose from gallery</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Image source={{ uri: imageUri }} style={styles.receipt} resizeMode="contain" />
          <TouchableOpacity onPress={() => setImageUri(null)} style={{ alignSelf: 'center', marginBottom: 8 }}>
            <Text style={styles.link}>Use a different picture</Text>
          </TouchableOpacity>
          <View style={styles.tip}>
            <Text style={styles.tipText}>
              🤖 Automatic reading is coming soon. For now, type the store and items, and Monee adds them up for
              you.
            </Text>
          </View>
          <TransactionForm
            key={imageUri}
            receiptUri={imageUri}
            showItems
            submitLabel="Save receipt"
            onSave={(t) => {
              onSave(t);
              setImageUri(null);
            }}
          />
        </>
      )}
    </ScrollView>
  );
}

/* =========================================================
   7. THE ENTRY FORM (used by Add, Scan and Edit)
   ========================================================= */

function TransactionForm({ initial, receiptUri, showItems, onSave, onDelete, submitLabel = 'Save' }) {
  const [type, setType] = useState(initial?.type || 'expense');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [category, setCategory] = useState(initial?.category || 'Food');
  const [wallet, setWallet] = useState(initial?.wallet || 'Cash');
  const [note, setNote] = useState(initial?.note || '');
  const [store, setStore] = useState(initial?.store || '');
  const [date, setDate] = useState(initial ? new Date(initial.date) : new Date());
  const [items, setItems] = useState(
    (initial?.items || []).map((i) => ({ id: newId(), name: i.name, price: String(i.price) }))
  );

  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;
  const itemsTotal = items.reduce((sum, i) => sum + parseAmount(i.price), 0);
  const typed = parseAmount(amount);
  const isToday = sameDay(date, new Date());

  const switchType = (t) => {
    setType(t);
    const list = t === 'income' ? INCOME_CATS : EXPENSE_CATS;
    if (!list.some((c) => c.key === category)) setCategory(list[0].key);
  };

  const shiftDay = (n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    if (d > new Date()) return;
    setDate(d);
  };

  const updateItem = (id, field, value) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, [field]: value } : i)));

  const save = () => {
    const value = typed || itemsTotal;
    if (!value) {
      Alert.alert('Oops', 'Please enter an amount.');
      return;
    }
    onSave({
      id: initial?.id || newId(),
      type,
      amount: value,
      category,
      wallet,
      note: note.trim(),
      store: store.trim(),
      items: items
        .filter((i) => i.name.trim() || parseAmount(i.price))
        .map((i) => ({ name: i.name.trim() || 'Item', price: parseAmount(i.price) })),
      receiptUri: receiptUri || initial?.receiptUri || null,
      date: date.toISOString(),
    });
  };

  return (
    <View style={styles.card}>
      {/* Money out / in */}
      <View style={styles.segment}>
        {[
          { key: 'expense', label: 'Money out' },
          { key: 'income', label: 'Money in' },
        ].map((o) => (
          <TouchableOpacity
            key={o.key}
            style={[styles.segmentBtn, type === o.key && styles.segmentActive]}
            onPress={() => switchType(o.key)}
          >
            <Text style={[styles.segmentText, type === o.key && styles.segmentTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Store + items (for receipts) */}
      {showItems && type === 'expense' && (
        <>
          <Text style={styles.label}>Store</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Indomaret"
            placeholderTextColor={C.muted}
            value={store}
            onChangeText={setStore}
          />
          <Text style={styles.label}>Items on the receipt</Text>
          {items.map((i) => (
            <View key={i.id} style={styles.itemRow}>
              <TextInput
                style={[styles.input, { flex: 2, marginBottom: 0 }]}
                placeholder="Item"
                placeholderTextColor={C.muted}
                value={i.name}
                onChangeText={(v) => updateItem(i.id, 'name', v)}
              />
              <TextInput
                style={[styles.input, { flex: 1.3, marginBottom: 0 }]}
                placeholder="Price"
                placeholderTextColor={C.muted}
                keyboardType="number-pad"
                value={i.price}
                onChangeText={(v) => updateItem(i.id, 'price', v)}
              />
              <TouchableOpacity onPress={() => setItems((l) => l.filter((x) => x.id !== i.id))}>
                <Text style={styles.removeX}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            onPress={() => setItems((l) => [...l, { id: newId(), name: '', price: '' }])}
            style={styles.addItemBtn}
          >
            <Text style={styles.link}>+ Add item</Text>
          </TouchableOpacity>
          {itemsTotal > 0 && <Text style={styles.muted}>Items add up to {formatRp(itemsTotal)}</Text>}
        </>
      )}

      {/* Amount */}
      <Text style={styles.label}>Total amount (Rp)</Text>
      <TextInput
        style={[styles.input, styles.amountInput]}
        keyboardType="number-pad"
        placeholder={itemsTotal ? String(itemsTotal) : 'e.g. 25000'}
        placeholderTextColor={C.muted}
        value={amount}
        onChangeText={setAmount}
      />
      {typed > 0 && <Text style={styles.muted}>= {formatRp(typed)}</Text>}
      {!typed && itemsTotal > 0 && (
        <Text style={styles.muted}>Leave empty to use the items total ({formatRp(itemsTotal)})</Text>
      )}

      {/* Category */}
      <Text style={styles.label}>Category</Text>
      <View style={styles.wrap}>
        {cats.map((c) => (
          <Chip
            key={c.key}
            label={`${c.emoji} ${c.key}`}
            active={category === c.key}
            onPress={() => setCategory(c.key)}
          />
        ))}
      </View>

      {/* Wallet */}
      <Text style={styles.label}>{type === 'income' ? 'Goes into' : 'Paid with'}</Text>
      <View style={styles.wrap}>
        {WALLETS.map((w) => (
          <Chip
            key={w.key}
            label={`${w.emoji} ${w.key}`}
            active={wallet === w.key}
            onPress={() => setWallet(w.key)}
          />
        ))}
      </View>

      {/* Date */}
      <Text style={styles.label}>Date</Text>
      <View style={styles.dateRow}>
        <TouchableOpacity onPress={() => shiftDay(-1)} style={styles.arrowBtn}>
          <Text style={styles.arrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.dateText}>{dayLabel(date)}</Text>
        <TouchableOpacity
          onPress={() => shiftDay(1)}
          disabled={isToday}
          style={[styles.arrowBtn, isToday && { opacity: 0.25 }]}
        >
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Note */}
      <Text style={styles.label}>Note (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder={type === 'income' ? 'e.g. Weekly allowance' : 'e.g. Bakso with friends'}
        placeholderTextColor={C.muted}
        value={note}
        onChangeText={setNote}
      />

      <TouchableOpacity style={styles.button} onPress={save}>
        <Text style={styles.buttonText}>{submitLabel}</Text>
      </TouchableOpacity>
      {onDelete && (
        <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={onDelete}>
          <Text style={[styles.buttonText, { color: C.out }]}>Delete entry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function EditScreen({ tx, onSave, onDelete, onClose }) {
  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.spaceBetween}>
        <Text style={styles.title}>Edit entry</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.link}>Close</Text>
        </TouchableOpacity>
      </View>
      {tx.receiptUri && <Image source={{ uri: tx.receiptUri }} style={styles.receipt} resizeMode="contain" />}
      <TransactionForm
        initial={tx}
        showItems={(tx.items && tx.items.length > 0) || !!tx.receiptUri}
        onSave={onSave}
        onDelete={onDelete}
        submitLabel="Save changes"
      />
    </ScrollView>
  );
}

/* =========================================================
   8. HISTORY
   ========================================================= */

function HistoryScreen({ transactions, onEdit }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = transactions
      .filter((t) => inMonth(t.date, cursor.y, cursor.m))
      .filter((t) => filter === 'all' || t.type === filter)
      .filter(
        (t) =>
          !q ||
          [t.note, t.store, t.category, t.wallet, ...(t.items || []).map((i) => i.name)]
            .join(' ')
            .toLowerCase()
            .includes(q)
      );
    const map = new Map();
    for (const t of list) {
      const d = new Date(t.date);
      const key = isoDay(d);
      if (!map.has(key)) map.set(key, { key, label: dayLabel(d), items: [], net: 0 });
      const g = map.get(key);
      g.items.push(t);
      g.net += t.type === 'income' ? t.amount : -t.amount;
    }
    return [...map.values()];
  }, [transactions, cursor, filter, query]);

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>History</Text>
      <MonthSwitcher cursor={cursor} setCursor={setCursor} />

      <TextInput
        style={styles.input}
        placeholder="🔍 Search notes, stores, items…"
        placeholderTextColor={C.muted}
        value={query}
        onChangeText={setQuery}
      />
      <View style={[styles.row, { marginBottom: 12 }]}>
        <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Money out" active={filter === 'expense'} onPress={() => setFilter('expense')} />
        <Chip label="Money in" active={filter === 'income'} onPress={() => setFilter('income')} />
      </View>

      {groups.length === 0 && (
        <View style={styles.card}>
          <Text style={styles.muted}>No entries found for this month.</Text>
        </View>
      )}

      {groups.map((g) => (
        <View key={g.key} style={{ marginBottom: 12 }}>
          <View style={styles.spaceBetween}>
            <Text style={styles.dayLabel}>{g.label}</Text>
            <Text style={[styles.muted, { color: g.net >= 0 ? C.in : C.out }]}>
              {g.net >= 0 ? '+' : ''}
              {formatRp(g.net)}
            </Text>
          </View>
          <View style={styles.card}>
            {g.items.map((t) => (
              <TxRow key={t.id} tx={t} onPress={() => onEdit(t)} />
            ))}
          </View>
        </View>
      ))}
      {groups.length > 0 && <Text style={styles.hint}>Tap an entry to edit or delete it.</Text>}
    </ScrollView>
  );
}

/* =========================================================
   9. GOALS
   ========================================================= */

function GoalsScreen({ goals, setGoals, balance }) {
  const [showForm, setShowForm] = useState(goals.length === 0);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [months, setMonths] = useState(0);

  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);

  const addGoal = () => {
    const value = parseAmount(target);
    if (!name.trim() || !value) {
      Alert.alert('Oops', 'Give your goal a name and a target amount.');
      return;
    }
    let deadline = null;
    if (months) {
      const d = new Date();
      d.setMonth(d.getMonth() + months);
      deadline = d.toISOString();
    }
    setGoals((prev) => [
      ...prev,
      { id: newId(), name: name.trim(), target: value, saved: 0, emoji, deadline },
    ]);
    setName('');
    setTarget('');
    setEmoji('🎯');
    setMonths(0);
    setShowForm(false);
  };

  const changeSaved = (id, delta) => {
    if (delta > 0 && delta > balance) {
      Alert.alert(
        'Not enough money',
        `You only have ${formatRp(balance)} available. Add your income first, or put in a smaller amount.`
      );
      return;
    }
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, saved: Math.max(0, g.saved + delta) } : g))
    );
  };

  const deleteGoal = (goal) =>
    Alert.alert(
      `Delete "${goal.name}"?`,
      goal.saved > 0 ? `The ${formatRp(goal.saved)} saved in it goes back to your balance.` : '',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => setGoals((p) => p.filter((g) => g.id !== goal.id)) },
      ]
    );

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.spaceBetween}>
        <Text style={styles.title}>Goals</Text>
        {!showForm && (
          <TouchableOpacity onPress={() => setShowForm(true)}>
            <Text style={styles.link}>+ New goal</Text>
          </TouchableOpacity>
        )}
      </View>

      {goals.length > 0 && (
        <View style={[styles.card, { backgroundColor: C.navy, borderColor: C.navy }]}>
          <Text style={{ color: C.sky }}>Saved across all goals</Text>
          <Text style={{ color: C.yellow, fontSize: 24, fontWeight: '800', marginTop: 2 }}>
            {formatRp(totalSaved)}
          </Text>
        </View>
      )}

      {showForm && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>New goal</Text>
          <View style={[styles.wrap, { marginBottom: 8 }]}>
            {GOAL_EMOJIS.map((e) => (
              <TouchableOpacity
                key={e}
                onPress={() => setEmoji(e)}
                style={[styles.emojiPick, emoji === e && styles.emojiPickActive]}
              >
                <Text style={{ fontSize: 20 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="What are you saving for? e.g. New headphones"
            placeholderTextColor={C.muted}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Target amount, e.g. 500000"
            placeholderTextColor={C.muted}
            keyboardType="number-pad"
            value={target}
            onChangeText={setTarget}
          />
          {parseAmount(target) > 0 && <Text style={styles.muted}>= {formatRp(parseAmount(target))}</Text>}
          <Text style={styles.label}>When do you want it?</Text>
          <View style={styles.wrap}>
            {DEADLINES.map((d) => (
              <Chip key={d.label} label={d.label} active={months === d.months} onPress={() => setMonths(d.months)} />
            ))}
          </View>
          <TouchableOpacity style={styles.button} onPress={addGoal}>
            <Text style={styles.buttonText}>Create goal</Text>
          </TouchableOpacity>
          {goals.length > 0 && (
            <TouchableOpacity onPress={() => setShowForm(false)} style={{ alignSelf: 'center', marginTop: 10 }}>
              <Text style={styles.link}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {goals.map((g) => (
        <GoalCard key={g.id} goal={g} onChange={changeSaved} onDelete={() => deleteGoal(g)} />
      ))}
      {goals.length > 0 && <Text style={styles.hint}>Long-press a goal to delete it.</Text>}
    </ScrollView>
  );
}

function GoalCard({ goal, onChange, onDelete }) {
  const [amt, setAmt] = useState('');
  const pct = goal.target ? (goal.saved / goal.target) * 100 : 0;
  const done = goal.saved >= goal.target;

  let plan = null;
  if (!done && goal.deadline) {
    const msLeft = new Date(goal.deadline) - new Date();
    if (msLeft <= 0) plan = '⏰ The deadline passed, but you can still keep going!';
    else {
      const weeks = Math.max(1, Math.ceil(msLeft / (7 * 86400000)));
      const perWeek = Math.ceil((goal.target - goal.saved) / weeks);
      plan = `📅 Save ${formatRp(perWeek)} a week to reach it by ${fmtDate(new Date(goal.deadline))}`;
    }
  }

  const apply = (sign) => {
    const v = parseAmount(amt);
    if (!v) return;
    onChange(goal.id, sign * v);
    setAmt('');
  };

  return (
    <TouchableOpacity style={styles.card} onLongPress={onDelete} activeOpacity={0.95}>
      <View style={styles.spaceBetween}>
        <Text style={styles.cardTitle}>
          {goal.emoji} {goal.name}
        </Text>
        <Text style={[styles.muted, done && { color: C.in, fontWeight: '700' }]}>
          {done ? 'Reached! 🎉' : `${Math.round(pct)}%`}
        </Text>
      </View>
      <ProgressBar pct={pct} color={done ? C.in : C.yellow} />
      <Text style={[styles.text, { marginTop: 6 }]}>
        {formatRp(goal.saved)} <Text style={styles.muted}>of {formatRp(goal.target)}</Text>
      </Text>
      {plan && <Text style={[styles.muted, { marginTop: 4 }]}>{plan}</Text>}

      <View style={[styles.wrap, { marginTop: 10 }]}>
        {[10000, 50000, 100000].map((a) => (
          <Chip key={a} label={`+${formatShort(a)}`} active={false} onPress={() => onChange(goal.id, a)} />
        ))}
      </View>
      <View style={[styles.itemRow, { marginTop: 8 }]}>
        <TextInput
          style={[styles.input, { flex: 1, marginBottom: 0 }]}
          placeholder="Other amount"
          placeholderTextColor={C.muted}
          keyboardType="number-pad"
          value={amt}
          onChangeText={setAmt}
        />
        <TouchableOpacity style={styles.smallBtn} onPress={() => apply(1)}>
          <Text style={styles.smallBtnText}>Add</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.smallBtn, styles.smallBtnAlt]} onPress={() => apply(-1)}>
          <Text style={[styles.smallBtnText, { color: C.navy }]}>Take out</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

/* =========================================================
   10. INSIGHTS
   ========================================================= */

function InsightsScreen({ data }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const s = useMemo(() => {
    const { y, m } = cursor;
    let inc = 0;
    let out = 0;
    let biggest = null;
    const cats = {};
    const spendDays = new Set();
    for (const t of data.transactions) {
      if (!inMonth(t.date, y, m)) continue;
      if (t.type === 'income') inc += t.amount;
      else {
        out += t.amount;
        cats[t.category] = (cats[t.category] || 0) + t.amount;
        spendDays.add(new Date(t.date).getDate());
        if (!biggest || t.amount > biggest.amount) biggest = t;
      }
    }
    const today = new Date();
    const isCurrent = y === today.getFullYear() && m === today.getMonth();
    const daysCounted = isCurrent ? today.getDate() : daysInMonth(y, m);
    const noSpend = Math.max(0, daysCounted - spendDays.size);
    const avg = daysCounted ? out / daysCounted : 0;

    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const c = shiftMonth(cursor, -i);
      const total = data.transactions
        .filter((t) => t.type === 'expense' && inMonth(t.date, c.y, c.m))
        .reduce((a, t) => a + t.amount, 0);
      trend.push({ key: `${c.y}-${c.m}`, label: MONTHS[c.m], total, current: i === 0 });
    }
    const catList = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    return { inc, out, biggest, noSpend, avg, trend, catList };
  }, [data, cursor]);

  const maxTrend = Math.max(1, ...s.trend.map((t) => t.total));
  const net = s.inc - s.out;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Insights</Text>
      <MonthSwitcher cursor={cursor} setCursor={setCursor} />

      {/* Summary */}
      <View style={[styles.card, { backgroundColor: C.navy, borderColor: C.navy }]}>
        <View style={styles.spaceBetween}>
          <View>
            <Text style={{ color: C.sky }}>Money in</Text>
            <Text style={styles.summaryValue}>{formatRp(s.inc)}</Text>
          </View>
          <View>
            <Text style={{ color: C.sky }}>Money out</Text>
            <Text style={styles.summaryValue}>{formatRp(s.out)}</Text>
          </View>
        </View>
        <View style={styles.summaryDivider} />
        <Text style={{ color: C.sky }}>{net >= 0 ? 'You kept' : 'You spent more than you got by'}</Text>
        <Text style={{ color: C.yellow, fontSize: 24, fontWeight: '800' }}>{formatRp(Math.abs(net))}</Text>
      </View>

      {/* Stat tiles */}
      <View style={styles.row}>
        <View style={[styles.card, styles.statTile]}>
          <Text style={{ fontSize: 20 }}>📆</Text>
          <Text style={styles.statValue}>{formatRp(s.avg)}</Text>
          <Text style={styles.muted}>average per day</Text>
        </View>
        <View style={[styles.card, styles.statTile]}>
          <Text style={{ fontSize: 20 }}>🌱</Text>
          <Text style={styles.statValue}>{s.noSpend} days</Text>
          <Text style={styles.muted}>with no spending</Text>
        </View>
      </View>
      {s.biggest && (
        <View style={styles.card}>
          <Text style={styles.muted}>Biggest expense</Text>
          <Text style={styles.text}>
            {catEmoji(s.biggest.category)} {s.biggest.store || s.biggest.note || s.biggest.category} ·{' '}
            <Text style={{ color: C.out, fontWeight: '700' }}>{formatRp(s.biggest.amount)}</Text>
          </Text>
        </View>
      )}

      {/* Categories */}
      <SectionTitle>Where your money went</SectionTitle>
      <View style={styles.card}>
        {s.catList.length === 0 ? (
          <Text style={styles.muted}>No spending this month.</Text>
        ) : (
          s.catList.map(([cat, amt]) => {
            const budget = data.budgets[cat];
            return (
              <View key={cat} style={{ marginBottom: 12 }}>
                <View style={styles.spaceBetween}>
                  <Text style={styles.text}>
                    {catEmoji(cat)} {cat}
                  </Text>
                  <Text style={styles.text}>
                    {formatRp(amt)} <Text style={styles.muted}>({Math.round((amt / s.out) * 100)}%)</Text>
                  </Text>
                </View>
                <ProgressBar
                  pct={budget ? (amt / budget) * 100 : (amt / s.out) * 100}
                  color={budget && amt > budget ? C.out : C.teal}
                />
                {budget > 0 && (
                  <Text style={[styles.muted, { fontSize: 12, marginTop: 2 }]}>
                    Budget {formatRp(budget)}
                    {amt > budget ? ` · over by ${formatRp(amt - budget)}` : ''}
                  </Text>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* 6-month trend */}
      <SectionTitle>Spending, last 6 months</SectionTitle>
      <View style={styles.card}>
        <View style={styles.chart}>
          {s.trend.map((t) => (
            <View key={t.key} style={styles.chartCol}>
              <Text style={styles.chartValue}>{t.total ? formatShort(t.total) : ''}</Text>
              <View
                style={[
                  styles.chartBar,
                  {
                    height: Math.max(4, (t.total / maxTrend) * 110),
                    backgroundColor: t.current ? C.yellow : C.sky,
                  },
                ]}
              />
              <Text style={[styles.chartLabel, t.current && { color: C.navy, fontWeight: '800' }]}>{t.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

/* =========================================================
   11. SETTINGS
   ========================================================= */

function SettingsScreen({ data, setProfile, setBudget, onExport, onReset, onClose }) {
  const confirmReset = () =>
    Alert.alert('Delete ALL data?', 'Every entry, goal and setting will be erased. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete everything',
        style: 'destructive',
        onPress: () => {
          onReset();
          onClose();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.spaceBetween}>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.link}>Done</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>You</Text>
        <Text style={styles.label}>Your name</Text>
        <TextInput
          style={styles.input}
          placeholder="What should Monee call you?"
          placeholderTextColor={C.muted}
          value={data.profile.name}
          onChangeText={(v) => setProfile({ name: v })}
        />
        <Text style={styles.label}>Monthly spending budget (Rp)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 1000000"
          placeholderTextColor={C.muted}
          keyboardType="number-pad"
          value={data.profile.monthlyBudget ? String(data.profile.monthlyBudget) : ''}
          onChangeText={(v) => setProfile({ monthlyBudget: parseAmount(v) })}
        />
        {data.profile.monthlyBudget > 0 && (
          <Text style={styles.muted}>= {formatRp(data.profile.monthlyBudget)} per month</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Category budgets</Text>
        <Text style={[styles.muted, { marginBottom: 8 }]}>
          Optional. Monee warns you when you reach 80% of a category’s budget.
        </Text>
        {EXPENSE_CATS.map((c) => (
          <View key={c.key} style={styles.budgetRow}>
            <Text style={[styles.text, { flex: 1 }]}>
              {c.emoji} {c.key}
            </Text>
            <TextInput
              style={[styles.input, styles.budgetInput]}
              placeholder="No limit"
              placeholderTextColor={C.muted}
              keyboardType="number-pad"
              value={data.budgets[c.key] ? String(data.budgets[c.key]) : ''}
              onChangeText={(v) => setBudget(c.key, parseAmount(v))}
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
          <Text style={styles.buttonText}>📤 Export to spreadsheet</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={confirmReset}>
        <Text style={[styles.buttonText, { color: C.out }]}>Delete all data</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* =========================================================
   12. BOTTOM TAB BAR
   ========================================================= */

const TABS = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'history', label: 'History', icon: '📜' },
  { key: 'add', label: 'Add', icon: '+' },
  { key: 'goals', label: 'Goals', icon: '🎯' },
  { key: 'insights', label: 'Insights', icon: '📊' },
];

function TabBar({ tab, setTab }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((t) =>
        t.key === 'add' ? (
          <TouchableOpacity key={t.key} style={styles.tab} onPress={() => setTab('add')}>
            <View style={styles.addBtn}>
              <Text style={styles.addBtnText}>+</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
            <Text style={{ fontSize: 20, opacity: tab === t.key ? 1 : 0.45 }}>{t.icon}</Text>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );
}

/* =========================================================
   13. STYLES
   ========================================================= */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.navy },
  body: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  screen: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: '800', color: C.navy, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: C.navy },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: C.navy, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  text: { color: C.text, fontSize: 15 },
  muted: { color: C.muted, fontSize: 13 },
  hint: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 4 },
  link: { color: C.teal, fontWeight: '700', fontSize: 15 },
  label: { color: C.muted, marginTop: 14, marginBottom: 6, fontWeight: '600' },

  // Hero (home header)
  hero: {
    backgroundColor: C.navy,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroHello: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSub: { color: C.sky, marginTop: 2 },
  heroLabel: { color: C.sky, marginTop: 20 },
  heroBalance: { color: C.yellow, fontSize: 34, fontWeight: '800', marginTop: 2 },
  heroRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  heroStat: { flex: 1, backgroundColor: 'rgba(137,187,214,0.15)', borderRadius: 14, padding: 10 },
  heroStatLabel: { color: C.sky, fontSize: 12 },
  heroStatValue: { color: '#fff', fontWeight: '700', marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(137,187,214,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  walletBox: { flex: 1, minWidth: 95, alignItems: 'flex-start', paddingVertical: 10 },
  walletValue: { color: C.navy, fontWeight: '700', marginTop: 2 },

  tip: { backgroundColor: C.yellowSoft, borderRadius: 12, padding: 10, marginTop: 10, marginBottom: 8 },
  tipText: { color: C.text, fontSize: 13 },
  warning: { backgroundColor: '#FFF1F0', borderColor: '#F5C6C3' },

  // Inputs & buttons
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FAFCFD',
    color: C.text,
    marginBottom: 8,
  },
  amountInput: { fontSize: 22, fontWeight: '700', color: C.navy },
  button: {
    backgroundColor: C.navy,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonYellow: { backgroundColor: C.yellow },
  buttonOutline: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.navy },
  buttonDanger: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#F5C6C3' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  smallBtn: { backgroundColor: C.teal, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  smallBtnAlt: { backgroundColor: C.skySoft },
  smallBtnText: { color: '#fff', fontWeight: '700' },

  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: C.teal, borderColor: C.teal },
  chipText: { color: C.text, fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  segment: { flexDirection: 'row', backgroundColor: C.skySoft, borderRadius: 14, padding: 4, marginBottom: 8 },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segmentActive: { backgroundColor: C.navy },
  segmentText: { color: C.navy, fontWeight: '600' },
  segmentTextActive: { color: '#fff' },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  removeX: { color: C.muted, fontSize: 18, paddingHorizontal: 6 },
  addItemBtn: { paddingVertical: 6, marginBottom: 4 },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.skySoft,
    borderRadius: 12,
    paddingHorizontal: 4,
  },
  dateText: { color: C.navy, fontWeight: '700', fontSize: 15 },
  arrowBtn: { paddingHorizontal: 14, paddingVertical: 6 },
  arrow: { fontSize: 26, color: C.navy, fontWeight: '700' },

  monthSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  monthText: { color: C.navy, fontWeight: '800', fontSize: 16 },

  barBg: { height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 6 },
  barFill: { height: 10, borderRadius: 5 },

  // Transactions
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  txIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txTitle: { color: C.text, fontSize: 15, fontWeight: '600' },
  txAmount: { fontWeight: '700', fontSize: 14 },
  dayLabel: { color: C.navy, fontWeight: '700', marginBottom: 6 },
  receipt: { width: '100%', height: 280, borderRadius: 16, marginBottom: 8, backgroundColor: C.navy },

  // Goals
  emojiPick: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.bg,
  },
  emojiPickActive: { backgroundColor: C.yellow },

  // Insights
  summaryValue: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 2 },
  summaryDivider: { height: 1, backgroundColor: 'rgba(137,187,214,0.3)', marginVertical: 12 },
  statTile: { flex: 1, minWidth: 140 },
  statValue: { color: C.navy, fontWeight: '800', fontSize: 17, marginTop: 4 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 150, gap: 6 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  chartBar: { width: '70%', borderRadius: 8 },
  chartValue: { fontSize: 10, color: C.muted, marginBottom: 4 },
  chartLabel: { fontSize: 12, color: C.muted, marginTop: 6 },

  // Settings
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  budgetInput: { width: 130, textAlign: 'right' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 11, color: C.muted, marginTop: 2 },
  tabLabelActive: { color: C.navy, fontWeight: '800' },
  addBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    borderWidth: 4,
    borderColor: C.bg,
  },
  addBtnText: { fontSize: 30, color: C.navy, fontWeight: '800', marginTop: -2 },
});