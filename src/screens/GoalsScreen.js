import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, TextInput } from '../ui';
import { C, GRADIENT, styles } from '../styles';
import { Chip, ProgressBar } from '../components';
import { DEADLINES, GOAL_ICON_KEYS } from '../constants';
import { AccountIcon, Camera, GoalIcon, ImageIcon, Plus } from '../icons';
import { accountBalances, accountName } from '../money';
import { fmtDate, formatRp, formatShort, newId, parseAmount } from '../utils';
import { pickSmallImage } from '../images';

// actions = { addGoal, setGoalSaved, setGoalImage, deleteGoal }
export default function GoalsScreen({ data, actions }) {
  const { goals, accounts } = data;
  const balances = accountBalances(data);
  const [showForm, setShowForm] = useState(goals.length === 0);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [icon, setIcon] = useState('target');
  const [months, setMonths] = useState(0);
  const [image, setImage] = useState(null);
  const [picking, setPicking] = useState(false);
  const [accountId, setAccountId] = useState(data.mainAccountId);

  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);

  const choosePhoto = async () => {
    setPicking(true);
    const img = await pickSmallImage({ aspect: [16, 9], width: 900 });
    setPicking(false);
    if (img) setImage(img);
  };

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
    actions.addGoal({
      id: newId(),
      name: name.trim(),
      target: value,
      saved: 0,
      icon,
      image,
      accountId,
      deadline,
      createdAt: Date.now(),
    });
    setName('');
    setTarget('');
    setIcon('target');
    setMonths(0);
    setImage(null);
    setAccountId(data.mainAccountId);
    setShowForm(false);
  };

  const changeSaved = (goal, delta) => {
    // The money for a goal is set aside inside one account, so check that account has enough
    const available = balances.byId[goal.accountId]?.available || 0;
    if (delta > 0 && delta > available) {
      Alert.alert(
        'Not enough money',
        `${accountName(accounts, goal.accountId)} only has ${formatRp(available)} available. Add money to it first, or put in a smaller amount.`
      );
      return;
    }
    actions.setGoalSaved(goal.id, Math.max(0, goal.saved + delta));
  };

  const changeGoalPhoto = async (goal) => {
    const img = await pickSmallImage({ aspect: [16, 9], width: 900 });
    if (img) actions.setGoalImage(goal.id, img);
  };

  const confirmDelete = (goal) =>
    Alert.alert(
      `Delete "${goal.name}"?`,
      goal.saved > 0 ? `The ${formatRp(goal.saved)} saved in it goes back to your balance.` : '',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => actions.deleteGoal(goal.id) },
      ]
    );

  // Long-press a goal for more options
  const goalMenu = (goal) =>
    Alert.alert(goal.name, undefined, [
      { text: goal.image ? 'Change photo' : 'Add photo', onPress: () => changeGoalPhoto(goal) },
      ...(goal.image ? [{ text: 'Remove photo', onPress: () => actions.setGoalImage(goal.id, null) }] : []),
      { text: 'Delete goal', style: 'destructive', onPress: () => confirmDelete(goal) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.spaceBetween}>
        <Text style={styles.title}>Goals</Text>
        {!showForm && (
          <TouchableOpacity onPress={() => setShowForm(true)} style={styles.rowCenter}>
            <Plus size={16} color={C.teal} weight="bold" />
            <Text style={styles.link}>New goal</Text>
          </TouchableOpacity>
        )}
      </View>

      {goals.length > 0 && (
        <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, { padding: 18 }]}>
          <Text style={{ color: C.sky }}>Saved across all goals</Text>
          <Text style={[styles.bigNumber, { marginTop: 2 }]}>{formatRp(totalSaved)}</Text>
        </LinearGradient>
      )}

      {showForm && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>New goal</Text>

          {/* Optional photo of the thing you're saving for */}
          <TouchableOpacity style={styles.photoPick} onPress={choosePhoto} disabled={picking}>
            {picking ? (
              <ActivityIndicator color={C.teal} />
            ) : image ? (
              <Image source={{ uri: image }} style={styles.photoPickImage} resizeMode="cover" />
            ) : (
              <>
                <ImageIcon size={28} color={C.teal} weight="duotone" />
                <Text style={styles.muted}>Add a photo of it (optional)</Text>
              </>
            )}
          </TouchableOpacity>
          {image && (
            <TouchableOpacity onPress={() => setImage(null)} style={{ alignSelf: 'flex-end', marginBottom: 4 }}>
              <Text style={[styles.link, { fontSize: 13 }]}>Remove photo</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.label}>Icon</Text>
          <View style={[styles.wrap, { marginBottom: 8 }]}>
            {GOAL_ICON_KEYS.map((k) => (
              <TouchableOpacity
                key={k}
                onPress={() => setIcon(k)}
                style={[styles.iconPick, icon === k && styles.iconPickActive]}
                accessibilityLabel={`Goal icon: ${k}`}
              >
                <GoalIcon name={k} size={22} />
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
          <Text style={styles.label}>Keep the savings in</Text>
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
        <GoalCard
          key={g.id}
          goal={g}
          onChange={(d) => changeSaved(g, d)}
          onPhoto={() => changeGoalPhoto(g)}
          accountLabel={accountName(accounts, g.accountId)}
          onMenu={() => goalMenu(g)}
        />
      ))}
      {goals.length > 0 && <Text style={styles.hint}>Press and hold a goal to change its photo or delete it.</Text>}
    </ScrollView>
  );
}

// One goal, shown like a note: a header (photo or gradient) with the name, then the details
function GoalCard({ goal, onChange, onPhoto, onMenu, accountLabel }) {
  const [amt, setAmt] = useState('');
  const pct = goal.target ? (goal.saved / goal.target) * 100 : 0;
  const done = goal.saved >= goal.target;

  let plan = null;
  if (!done && goal.deadline) {
    const msLeft = new Date(goal.deadline) - new Date();
    if (msLeft <= 0) plan = 'The deadline passed, but you can still keep going!';
    else {
      const weeks = Math.max(1, Math.ceil(msLeft / (7 * 86400000)));
      const perWeek = Math.ceil((goal.target - goal.saved) / weeks);
      plan = `Save ${formatRp(perWeek)} a week to reach it by ${fmtDate(new Date(goal.deadline))}`;
    }
  }

  const apply = (sign) => {
    const v = parseAmount(amt);
    if (!v) return;
    onChange(sign * v);
    setAmt('');
  };

  const headerInner = (
    <View style={styles.goalHeaderInner}>
      <View style={[styles.rowCenter, { flex: 1 }]}>
        {!goal.image && <GoalIcon name={goal.icon} size={26} color={C.yellow} weight="fill" />}
        <Text style={styles.goalTitle} numberOfLines={2}>
          {goal.name}
        </Text>
      </View>
      <View style={[styles.goalBadge, done && { backgroundColor: C.in }]}>
        <Text style={styles.goalBadgeText}>{done ? 'Reached!' : `${Math.round(pct)}%`}</Text>
      </View>
    </View>
  );

  return (
    <TouchableOpacity style={styles.goalNote} onLongPress={onMenu} activeOpacity={0.97}>
      {/* Header */}
      {goal.image ? (
        <View style={styles.goalHeader}>
          <Image source={{ uri: goal.image }} style={StyleSheetAbsolute} resizeMode="cover" />
          <LinearGradient colors={['transparent', 'rgba(30,50,96,0.9)']} style={styles.goalHeaderShade} />
          {headerInner}
        </View>
      ) : (
        <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.goalHeaderPlain}>
          <TouchableOpacity
            onPress={onPhoto}
            style={{ position: 'absolute', top: 10, right: 10, padding: 6 }}
            accessibilityLabel="Add a photo"
          >
            <Camera size={20} color={C.sky} />
          </TouchableOpacity>
          {headerInner}
        </LinearGradient>
      )}

      {/* Body */}
      <View style={styles.goalBody}>
        <ProgressBar pct={pct} color={done ? C.in : C.teal} />
        <Text style={[styles.text, { marginTop: 8 }]}>
          <Text style={{ fontWeight: '700' }}>{formatRp(goal.saved)}</Text>
          <Text style={styles.muted}> of {formatRp(goal.target)}</Text>
        </Text>
        <Text style={[styles.muted, { marginTop: 2 }]}>Kept in {accountLabel}</Text>
        {plan && <Text style={[styles.muted, { marginTop: 4 }]}>{plan}</Text>}

        <View style={[styles.wrap, { marginTop: 12 }]}>
          {[10000, 50000, 100000].map((a) => (
            <Chip key={a} label={`+${formatShort(a)}`} active={false} onPress={() => onChange(a)} />
          ))}
        </View>
        <View style={[styles.itemRow, { marginTop: 8, marginBottom: 0 }]}>
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
      </View>
    </TouchableOpacity>
  );
}

const StyleSheetAbsolute = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' };
