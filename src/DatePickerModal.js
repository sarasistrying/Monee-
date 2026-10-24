// A calendar that pops up from the bottom, so you can tap any day.
// Future days are greyed out (you can't spend money tomorrow yet!).
import React, { useEffect, useState } from 'react';
import { Modal, View, TouchableOpacity, Pressable } from 'react-native';
import { Text } from './ui';
import { C, styles } from './styles';
import { FULL_MONTHS } from './constants';
import { sameDay, shiftMonth } from './utils';
import { CaretLeft, CaretRight } from './icons';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function DatePickerModal({ visible, value, onSelect, onClose }) {
  const [cursor, setCursor] = useState({ y: value.getFullYear(), m: value.getMonth() });

  // Open on the month of the chosen date every time
  useEffect(() => {
    if (visible) setCursor({ y: value.getFullYear(), m: value.getMonth() });
  }, [visible, value]);

  const today = new Date();
  const atCurrentMonth = cursor.y === today.getFullYear() && cursor.m === today.getMonth();

  // Build the grid: empty spaces before the 1st, then each day
  const first = new Date(cursor.y, cursor.m, 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const pick = (day) => {
    const d = new Date(value); // keep the original time of day
    d.setFullYear(cursor.y, cursor.m, day);
    onSelect(d);
    onClose();
  };

  const quick = (back) => {
    const d = new Date(value);
    const t = new Date();
    t.setDate(t.getDate() - back);
    d.setFullYear(t.getFullYear(), t.getMonth(), t.getDate());
    onSelect(d);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />

        <View style={[styles.spaceBetween, { marginBottom: 12 }]}>
          <TouchableOpacity onPress={() => setCursor(shiftMonth(cursor, -1))} style={styles.arrowBtn}>
            <CaretLeft size={20} color={C.navy} weight="bold" />
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {FULL_MONTHS[cursor.m]} {cursor.y}
          </Text>
          <TouchableOpacity
            disabled={atCurrentMonth}
            onPress={() => setCursor(shiftMonth(cursor, 1))}
            style={[styles.arrowBtn, atCurrentMonth && { opacity: 0.25 }]}
          >
            <CaretRight size={20} color={C.navy} weight="bold" />
          </TouchableOpacity>
        </View>

        <View style={styles.calRow}>
          {WEEK.map((w) => (
            <Text key={w} style={styles.calWeekday}>
              {w}
            </Text>
          ))}
        </View>

        {Array.from({ length: cells.length / 7 }, (_, r) => (
          <View key={r} style={styles.calRow}>
            {cells.slice(r * 7, r * 7 + 7).map((day, i) => {
              if (!day) return <View key={i} style={styles.calCell} />;
              const d = new Date(cursor.y, cursor.m, day);
              const future = d > today && !sameDay(d, today);
              const selected = sameDay(d, value);
              const isToday = sameDay(d, today);
              return (
                <TouchableOpacity
                  key={i}
                  style={styles.calCell}
                  disabled={future}
                  onPress={() => pick(day)}
                  accessibilityLabel={`${day} ${FULL_MONTHS[cursor.m]}`}
                >
                  <View style={[styles.calDay, isToday && styles.calToday, selected && styles.calSelected]}>
                    <Text
                      style={[
                        styles.calDayText,
                        future && { color: C.border },
                        selected && { color: '#fff', fontWeight: '700' },
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <View style={[styles.row, { marginTop: 12 }]}>
          <TouchableOpacity style={styles.calQuick} onPress={() => quick(0)}>
            <Text style={styles.calQuickText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.calQuick} onPress={() => quick(1)}>
            <Text style={styles.calQuickText}>Yesterday</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
