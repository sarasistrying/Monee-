import React, { useMemo, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Text, TextInput } from '../ui';
import { C, styles } from '../styles';
import { Chip, MonthSwitcher, TxRow } from '../components';
import { dayLabel, formatRp, inMonth, isoDay } from '../utils';
import { MagnifyingGlass } from '../icons';

export default function HistoryScreen({ transactions, accounts, onEdit }) {
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
          [t.note, t.store, t.category, t.wallet, accounts.find((a) => a.id === t.accountId)?.name, ...(t.items || []).map((i) => i.name)]
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

      <View style={[styles.input, styles.rowCenter, { paddingVertical: 0, backgroundColor: C.card }]}>
        <MagnifyingGlass size={18} color={C.muted} />
        <TextInput
          style={{ flex: 1, paddingVertical: 12, fontSize: 16, color: C.text }}
          placeholder="Search notes, stores, items…"
          placeholderTextColor={C.muted}
          value={query}
          onChangeText={setQuery}
        />
      </View>
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
          <View style={[styles.card, { paddingVertical: 4 }]}>
            {g.items.map((t, i) => (
              <TxRow key={t.id} tx={t} accounts={accounts} onPress={() => onEdit(t)} last={i === g.items.length - 1} />
            ))}
          </View>
        </View>
      ))}
      {groups.length > 0 && <Text style={styles.hint}>Tap an entry to edit or delete it.</Text>}
    </ScrollView>
  );
}
