import React, { useMemo, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '../ui';
import { C, GRADIENT, styles } from '../styles';
import { LinearGradient } from 'expo-linear-gradient';
import { MonthSwitcher, ProgressBar, SectionTitle } from '../components';
import { MONTHS } from '../constants';
import { accountBalances, kindLabel } from '../money';
import { daysInMonth, formatRp, formatShort, inMonth, shiftMonth } from '../utils';
import { AccountIcon, CalendarBlank, CategoryIcon, Leaf } from '../icons';

export default function InsightsScreen({ data }) {
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

    // How much is in each account right now (all entries ever, not just this month)
    const balances = accountBalances(data);
    return { inc, out, biggest, noSpend, avg, trend, catList, balances, isCurrent, daysCounted };
  }, [data, cursor]);

  const maxTrend = Math.max(1, ...s.trend.map((t) => t.total));
  const net = s.inc - s.out;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Insights</Text>
      <MonthSwitcher cursor={cursor} setCursor={setCursor} />

      {/* Summary */}
      <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, { padding: 18 }]}>
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
        <Text style={styles.bigNumber}>{formatRp(Math.abs(net))}</Text>
      </LinearGradient>

      {/* Monthly budget */}
      <View style={styles.card}>
        {data.profile.monthlyBudget > 0 ? (
          <>
            <View style={styles.spaceBetween}>
              <Text style={styles.cardTitle}>Monthly budget</Text>
              {s.isCurrent && (
                <Text style={styles.muted}>{daysInMonth(cursor.y, cursor.m) - s.daysCounted + 1} days left</Text>
              )}
            </View>
            <ProgressBar
              pct={(s.out / data.profile.monthlyBudget) * 100}
              color={s.out > data.profile.monthlyBudget ? C.out : s.out > data.profile.monthlyBudget * 0.8 ? '#E0A800' : C.teal}
            />
            <Text style={[styles.text, { marginTop: 8 }]}>
              {s.out <= data.profile.monthlyBudget
                ? `${formatRp(data.profile.monthlyBudget - s.out)} left of ${formatRp(data.profile.monthlyBudget)}`
                : `Over budget by ${formatRp(s.out - data.profile.monthlyBudget)}`}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.cardTitle}>Monthly budget</Text>
            <Text style={styles.muted}>Set a monthly budget in Settings (the gear on Home) to track it here.</Text>
          </>
        )}
      </View>

      {/* Stat tiles */}
      <View style={styles.row}>
        <View style={[styles.card, styles.statTile]}>
          <CalendarBlank size={22} color={C.teal} weight="duotone" />
          <Text style={styles.statValue}>{formatRp(s.avg)}</Text>
          <Text style={styles.muted}>average per day</Text>
        </View>
        <View style={[styles.card, styles.statTile]}>
          <Leaf size={22} color={C.in} weight="duotone" />
          <Text style={styles.statValue}>{s.noSpend} days</Text>
          <Text style={styles.muted}>with no spending</Text>
        </View>
      </View>
      {s.biggest && (
        <View style={styles.card}>
          <Text style={styles.muted}>Biggest expense</Text>
          <View style={[styles.rowCenter, { marginTop: 6 }]}>
            <View style={[styles.iconTile, { backgroundColor: C.skySoft }]}>
              <CategoryIcon name={s.biggest.category} />
            </View>
            <Text style={[styles.text, { flex: 1 }]} numberOfLines={1}>
              {s.biggest.store || s.biggest.note || s.biggest.category}
            </Text>
            <Text style={{ color: C.out, fontWeight: '700' }}>{formatRp(s.biggest.amount)}</Text>
          </View>
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
                  <View style={styles.rowCenter}>
                    <CategoryIcon name={cat} size={18} />
                    <Text style={styles.text}>{cat}</Text>
                  </View>
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

      {/* Where your money is */}
      <SectionTitle>Where your money is</SectionTitle>
      <View style={[styles.card, { paddingVertical: 4 }]}>
        {data.accounts.map((a, i) => {
          const b = s.balances.byId[a.id] || { balance: 0, saved: 0, available: 0 };
          return (
            <View
              key={a.id}
              style={[styles.txRow, i === data.accounts.length - 1 && { borderBottomWidth: 0 }]}
            >
              <View style={[styles.txIcon, { backgroundColor: C.skySoft }]}>
                <AccountIcon kind={a.kind} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txTitle}>{a.name}</Text>
                <Text style={styles.muted}>
                  {kindLabel(a.kind)}
                  {b.saved > 0 ? ` · ${formatRp(b.saved)} saved for goals` : ''}
                </Text>
              </View>
              <Text style={[styles.txAmount, { color: C.navy }]}>{formatRp(b.available)}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
