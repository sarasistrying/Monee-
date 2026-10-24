// Small pieces reused on several screens
import React from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { Text } from './ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, styles } from './styles';
import { FULL_MONTHS } from './constants';
import { formatRp, shiftMonth } from './utils';
import {
  CategoryIcon,
  House,
  ClockCounterClockwise,
  Target,
  ChartPieSlice,
  Plus,
  CaretLeft,
  CaretRight,
} from './icons';

// A pill button. `icon` is optional: a function that draws an icon in the given colour.
export function Chip({ label, active, onPress, style, icon }) {
  const color = active ? '#fff' : C.navy;
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive, style]}>
      {icon && icon(color)}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ProgressBar({ pct, color = C.teal, bg = C.skySoft }) {
  return (
    <View style={[styles.barBg, { backgroundColor: bg }]}>
      <View
        style={[styles.barFill, { width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }]}
      />
    </View>
  );
}

export function MonthSwitcher({ cursor, setCursor }) {
  const now = new Date();
  const atCurrent = cursor.y === now.getFullYear() && cursor.m === now.getMonth();
  return (
    <View style={styles.monthSwitcher}>
      <TouchableOpacity onPress={() => setCursor(shiftMonth(cursor, -1))} style={styles.arrowBtn}>
        <CaretLeft size={20} color={C.navy} weight="bold" />
      </TouchableOpacity>
      <Text style={styles.monthText}>
        {FULL_MONTHS[cursor.m]} {cursor.y}
      </Text>
      <TouchableOpacity
        disabled={atCurrent}
        onPress={() => setCursor(shiftMonth(cursor, 1))}
        style={[styles.arrowBtn, atCurrent && { opacity: 0.25 }]}
      >
        <CaretRight size={20} color={C.navy} weight="bold" />
      </TouchableOpacity>
    </View>
  );
}

export function TxRow({ tx, onPress, last, accounts }) {
  const acc = accounts?.find((a) => a.id === tx.accountId);
  const isIn = tx.type === 'income';
  return (
    <TouchableOpacity style={[styles.txRow, last && { borderBottomWidth: 0 }]} onPress={onPress} activeOpacity={0.7}>
      {tx.receiptUri ? (
        <Image source={{ uri: tx.receiptUri }} style={[styles.txIcon, { backgroundColor: C.yellowSoft }]} />
      ) : (
        <View style={[styles.txIcon, { backgroundColor: isIn ? '#E3F3EC' : C.skySoft }]}>
          <CategoryIcon name={tx.category} size={22} color={isIn ? C.in : C.navy} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.txTitle} numberOfLines={1}>
          {tx.store || tx.note || tx.category}
        </Text>
        <Text style={styles.muted} numberOfLines={1}>
          {tx.category} · {acc ? acc.name : tx.wallet}
        </Text>
      </View>
      <Text style={[styles.txAmount, { color: isIn ? C.in : C.text }]}>
        {isIn ? '+' : '−'}
        {formatRp(tx.amount)}
      </Text>
    </TouchableOpacity>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <View style={[styles.spaceBetween, { marginTop: 8, marginBottom: 8 }]}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

const TABS = [
  { key: 'home', label: 'Home', Icon: House },
  { key: 'history', label: 'History', Icon: ClockCounterClockwise },
  { key: 'add', label: 'Add' },
  { key: 'goals', label: 'Goals', Icon: Target },
  { key: 'insights', label: 'Insights', Icon: ChartPieSlice },
];

export function TabBar({ tab, setTab }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TABS.map(({ key, label, Icon }) =>
        key === 'add' ? (
          <TouchableOpacity key={key} style={styles.tab} onPress={() => setTab('add')} accessibilityLabel="Add entry">
            <View style={styles.addBtn}>
              <Plus size={26} color={C.navy} weight="bold" />
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity key={key} style={styles.tab} onPress={() => setTab(key)}>
            <Icon size={24} color={tab === key ? C.navy : C.muted} weight={tab === key ? 'fill' : 'regular'} />
            <Text style={[styles.tabLabel, tab === key && styles.tabLabelActive]}>{label}</Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );
}
