import React, { useMemo } from 'react';
import { View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../ui';
import { C, GRADIENT, styles } from '../styles';
import { SectionTitle, TxRow } from '../components';
import { EXPENSE_CATS, FULL_MONTHS } from '../constants';
import { daysInMonth, formatRp, inMonth, isoDay, sameDay } from '../utils';
import { accountBalances, kindLabel } from '../money';
import { AccountIcon, CategoryIcon, CloudArrowUp, PencilSimple, Plus, PushPin, Receipt, Warning } from '../icons';
import Avatar from '../Avatar';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Each account card gets its own mix of your colours
const CARD_GRADIENTS = [
  [C.teal, C.sky],
  [C.navy, C.teal],
  ['#2B4A86', '#5E9CBA'],
  ['#2F6F86', '#1E3260'],
  ['#3A7F99', '#9CC7DD'],
];

export default function HomeScreen({ data, displayName, syncing, onEdit, onSettings, onPinAccount, goTab }) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const todayKey = isoDay(now); // makes the numbers refresh when the day changes

  const main = data.accounts.find((a) => a.id === data.mainAccountId) || data.accounts[0];
  const balances = useMemo(() => accountBalances(data), [data]);

  // Add up today's spending (from the main account) and this month's spending per category
  const s = useMemo(() => {
    let spentTodayMain = 0;
    const catSpent = {};
    for (const t of data.transactions) {
      if (t.type !== 'expense') continue;
      if (t.accountId === main.id && sameDay(new Date(t.date), now)) spentTodayMain += t.amount;
      if (inMonth(t.date, y, m)) catSpent[t.category] = (catSpent[t.category] || 0) + t.amount;
    }
    return { spentTodayMain, catSpent };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, main.id, todayKey]);

  // ----- The daily amount, for your MAIN account -----
  const mainAvailable = balances.byId[main.id]?.available || 0;
  // Days left this month, counting today (on the 24th of a 31-day month: 31 − 24 + 1 = 8)
  const daysLeft = daysInMonth(y, m) - now.getDate() + 1;
  // Worked out from the start of today, so it doesn't shrink every time you buy something
  const allowance = Math.max(0, Math.floor((mainAvailable + s.spentTodayMain) / daysLeft));
  const leftToday = allowance - s.spentTodayMain;
  const over = leftToday < 0;
  const pctUsed = allowance ? Math.min(100, (s.spentTodayMain / allowance) * 100) : 100;

  let caption;
  if (allowance === 0) caption = `${main.name} is empty for this month. Add money to it when it comes in.`;
  else if (over) caption = `Over today’s amount. Tomorrow’s will be a little smaller.`;
  else caption = `Spent ${formatRp(s.spentTodayMain)} of ${formatRp(allowance)} today`;

  const warnings = EXPENSE_CATS.filter(
    (c) => data.budgets[c.key] > 0 && (s.catSpent[c.key] || 0) >= 0.8 * data.budgets[c.key]
  );
  const recent = data.transactions.slice(0, 6);

  const pin = (acc) => {
    if (acc.id === main.id) return;
    Alert.alert(`Make ${acc.name} your main account?`, 'Your daily amount on Home will be worked out from it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Make main', onPress: () => onPinAccount(acc.id) },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      {/* ---------- Header with today's amount ---------- */}
      <LinearGradient
        colors={GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.homeHero, { paddingBottom: 64 }]}
      >
        <View style={styles.heroTop}>
          {/* Tap your picture to open Settings */}
          <TouchableOpacity
            onPress={onSettings}
            style={[styles.rowCenter, { gap: 12, flex: 1 }]}
            accessibilityLabel="Profile and settings"
          >
            <Avatar name={displayName} photo={data.profile.photo} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName} numberOfLines={1}>
                {displayName ? `Hi, ${displayName}` : 'Hi there'}
              </Text>
              <Text style={styles.heroDate}>
                {WEEKDAYS[now.getDay()]}, {now.getDate()} {FULL_MONTHS[m]}
              </Text>
            </View>
          </TouchableOpacity>
          {syncing && <CloudArrowUp size={20} color={C.sky} />}
        </View>

        <Text style={styles.heroKicker} numberOfLines={1}>
          {over ? 'OVER TODAY BY' : 'LEFT TO SPEND TODAY'} · {main.name.toUpperCase()}
        </Text>
        <Text style={[styles.heroAmount, over && styles.heroAmountOver]} numberOfLines={1} adjustsFontSizeToFit>
          {formatRp(Math.abs(leftToday))}
        </Text>
        <View style={styles.heroBarBg}>
          <View style={[styles.heroBarFill, { width: `${pctUsed}%` }, over && { backgroundColor: '#FF9C97' }]} />
        </View>
        <Text style={styles.heroCaption}>{caption}</Text>

        <View style={styles.heroFoot}>
          <View>
            <Text style={styles.heroFootLabel}>Days left</Text>
            <Text style={styles.heroFootValue}>{daysLeft}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.heroFootLabel}>All accounts</Text>
            <Text style={styles.heroFootValue}>{formatRp(balances.total)}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ---------- Account cards (overlap the header). Tap one to make it your main account ---------- */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.accountRow}
        style={{ marginTop: -46 }}
      >
        {data.accounts.map((acc, i) => {
          const isMain = acc.id === main.id;
          return (
            <TouchableOpacity key={acc.id} onPress={() => pin(acc)} activeOpacity={0.85}>
              <LinearGradient
                colors={CARD_GRADIENTS[i % CARD_GRADIENTS.length]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.accountCard, isMain && styles.accountCardMain]}
              >
                <View style={styles.spaceBetween}>
                  <View style={[styles.rowCenter, { flex: 1 }]}>
                    <AccountIcon kind={acc.kind} size={20} color="#fff" weight="fill" />
                    <Text style={styles.accountName} numberOfLines={1}>
                      {acc.name}
                    </Text>
                  </View>
                  {isMain && <PushPin size={18} color={C.yellow} weight="fill" />}
                </View>
                <Text style={styles.accountAmount} numberOfLines={1} adjustsFontSizeToFit>
                  {formatRp(balances.byId[acc.id]?.available || 0)}
                </Text>
                <View style={styles.rowCenter}>
                  <View style={styles.accountPill}>
                    <Text style={styles.accountPillText}>{isMain ? 'Main' : kindLabel(acc.kind)}</Text>
                  </View>
                  {isMain && <Text style={styles.accountKind}>{kindLabel(acc.kind)}</Text>}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity onPress={onSettings} style={styles.accountAdd} accessibilityLabel="Add or edit accounts">
          <Plus size={22} color={C.teal} weight="bold" />
          <Text style={[styles.muted, { fontSize: 12 }]}>Accounts</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ---------- Quick actions ---------- */}
      <View style={[styles.actionRow, { marginTop: 14 }]}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => goTab('add', 'manual')}>
          <PencilSimple size={18} color={C.navy} weight="bold" />
          <Text style={styles.actionBtnText}>Add entry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => goTab('add', 'scan')}>
          <Receipt size={18} color={C.teal} weight="bold" />
          <Text style={styles.actionBtnText}>Scan receipt</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.screen, { paddingTop: 16 }]}>
        {/* ---------- Budget warnings (only when needed) ---------- */}
        {warnings.map((c) => {
          const spent = s.catSpent[c.key] || 0;
          const isOver = spent > data.budgets[c.key];
          return (
            <View key={c.key} style={[styles.card, styles.warning, styles.warningRow]}>
              <Warning size={20} color={C.out} weight="fill" />
              <Text style={[styles.text, { flex: 1 }]}>
                {isOver ? 'Over' : 'Almost at'} your {c.key} budget ({formatRp(spent)} of{' '}
                {formatRp(data.budgets[c.key])})
              </Text>
            </View>
          );
        })}

        {/* ---------- Recent ---------- */}
        <SectionTitle
          right={
            data.transactions.length > recent.length ? (
              <TouchableOpacity onPress={() => goTab('history')}>
                <Text style={styles.link}>See all</Text>
              </TouchableOpacity>
            ) : null
          }
        >
          Recent
        </SectionTitle>
        <View style={[styles.card, { paddingVertical: 4 }]}>
          {recent.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
              <CategoryIcon name="Other" size={32} color={C.sky} />
              <Text style={styles.muted}>Nothing here yet. Add your first entry above.</Text>
            </View>
          ) : (
            recent.map((t, i) => (
              <TxRow
                key={t.id}
                tx={t}
                accounts={data.accounts}
                onPress={() => onEdit(t)}
                last={i === recent.length - 1}
              />
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}
