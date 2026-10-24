// The entry form (used by Add, Scan and Edit)
import React, { useState } from 'react';
import { View, TouchableOpacity, Alert } from 'react-native';
import { Text, TextInput } from './ui';
import { C, styles } from './styles';
import { Chip } from './components';
import { CategoryIcon, AccountIcon, X, CaretLeft, CaretRight, CalendarBlank } from './icons';
import DatePickerModal from './DatePickerModal';
import { EXPENSE_CATS, INCOME_CATS } from './constants';
import { dayLabel, formatRp, newId, parseAmount, sameDay } from './utils';

// accounts = your accounts (GoPay, OVO…), mainAccountId = the one picked by default
export default function TransactionForm({
  initial,
  receiptUri,
  showItems,
  onSave,
  onDelete,
  submitLabel = 'Save',
  accounts,
  mainAccountId,
}) {
  const [type, setType] = useState(initial?.type || 'expense');
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : '');
  const [category, setCategory] = useState(initial?.category || 'Food');
  const [accountId, setAccountId] = useState(
    accounts.some((a) => a.id === initial?.accountId) ? initial.accountId : mainAccountId
  );
  const [note, setNote] = useState(initial?.note || '');
  const [store, setStore] = useState(initial?.store || '');
  const [date, setDate] = useState(initial?.date ? new Date(initial.date) : new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
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
      accountId,
      wallet: accounts.find((a) => a.id === accountId)?.name || '',
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
                <View style={{ padding: 6 }}>
                  <X size={18} color={C.muted} />
                </View>
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
            label={c.key}
            icon={(color) => <CategoryIcon name={c.key} size={16} color={color} weight="regular" />}
            active={category === c.key}
            onPress={() => setCategory(c.key)}
          />
        ))}
      </View>

      {/* Which account */}
      <Text style={styles.label}>{type === 'income' ? 'Goes into' : 'Paid with'}</Text>
      <View style={styles.wrap}>
        {accounts.map((a) => (
          <Chip
            key={a.id}
            label={a.name}
            icon={(color) => <AccountIcon kind={a.kind} size={16} color={color} weight="regular" />}
            active={accountId === a.id}
            onPress={() => setAccountId(a.id)}
          />
        ))}
      </View>

      {/* Date */}
      <Text style={styles.label}>Date</Text>
      <View style={styles.dateRow}>
        <TouchableOpacity onPress={() => shiftDay(-1)} style={styles.arrowBtn}>
          <CaretLeft size={20} color={C.navy} weight="bold" />
        </TouchableOpacity>
        {/* Tap the date to open the calendar */}
        <TouchableOpacity style={styles.dateButton} onPress={() => setCalendarOpen(true)} accessibilityLabel="Pick a date">
          <CalendarBlank size={18} color={C.navy} weight="bold" />
          <Text style={styles.dateText}>{dayLabel(date)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => shiftDay(1)}
          disabled={isToday}
          style={[styles.arrowBtn, isToday && { opacity: 0.25 }]}
        >
          <CaretRight size={20} color={C.navy} weight="bold" />
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

      <DatePickerModal
        visible={calendarOpen}
        value={date}
        onSelect={setDate}
        onClose={() => setCalendarOpen(false)}
      />
    </View>
  );
}
