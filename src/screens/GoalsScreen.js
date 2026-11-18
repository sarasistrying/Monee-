import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { showAlert } from '../dialog';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, TextInput } from '../ui';
import { C, GRADIENT, styles } from '../styles';
import { Chip, ProgressBar } from '../components';
import { DEADLINES, GOAL_ICON_KEYS } from '../constants';
import { AccountIcon, Camera, Copy, GoalIcon, ImageIcon, Plus, UserPlus, Users } from '../icons';
import { accountBalances, accountName, myShare, sharedTotal } from '../money';
import { findByCode } from '../moneeId';
import { copyText } from '../utils';
import { fmtDate, formatRp, formatShort, newId, parseAmount } from '../utils';
import { pickSmallImage } from '../images';

// actions = { addGoal, setGoalSaved, setGoalImage, deleteGoal, and the shared-goal ones from data.js }
export default function GoalsScreen({ data, actions, myName }) {
  const { goals, accounts, sharedGoals, invites, uid } = data;
  const balances = accountBalances(data);
  const [showForm, setShowForm] = useState(goals.length === 0 && data.sharedGoals.length === 0);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [icon, setIcon] = useState('target');
  const [months, setMonths] = useState(0);
  const [image, setImage] = useState(null);
  const [picking, setPicking] = useState(false);
  const [accountId, setAccountId] = useState(data.mainAccountId);
  const [withFriends, setWithFriends] = useState(false);

  // Your own goals + your part of shared goals
  const totalSaved = goals.reduce((s, g) => s + g.saved, 0) + sharedGoals.reduce((s, g) => s + myShare(g, uid), 0);
  const nothingYet = goals.length === 0 && sharedGoals.length === 0;

  const choosePhoto = async () => {
    setPicking(true);
    const img = await pickSmallImage({ aspect: [16, 9], width: 900 });
    setPicking(false);
    if (img) setImage(img);
  };

  const addGoal = () => {
    const value = parseAmount(target);
    if (!name.trim() || !value) {
      showAlert('Oops', 'Give your goal a name and a target amount.');
      return;
    }
    let deadline = null;
    if (months) {
      const d = new Date();
      d.setMonth(d.getMonth() + months);
      deadline = d.toISOString();
    }
    const goal = {
      id: newId(),
      name: name.trim(),
      target: value,
      saved: 0,
      icon,
      image,
      accountId,
      deadline,
      createdAt: Date.now(),
    };
    if (withFriends) actions.addSharedGoal(goal, myName, accountId);
    else actions.addGoal(goal);
    setName('');
    setTarget('');
    setIcon('target');
    setMonths(0);
    setImage(null);
    setAccountId(data.mainAccountId);
    setWithFriends(false);
    setShowForm(false);
  };

  const changeSaved = (goal, delta) => {
    // The money for a goal is set aside inside one account, so check that account has enough
    const available = balances.byId[goal.accountId]?.available || 0;
    if (delta > 0 && delta > available) {
      showAlert(
        'Not enough money',
        `${accountName(accounts, goal.accountId)} only has ${formatRp(available)} available. Add money to it first, or put in a smaller amount.`
      );
      return;
    }
    actions.setGoalSaved(goal.id, Math.max(0, goal.saved + delta));
  };

  // Shared goals: you add to (or take out of) YOUR part, from your own account
  const changeMyShare = (goal, delta) => {
    const mine = myShare(goal, uid);
    if (delta > 0) {
      const available = balances.byId[goal.myAccountId]?.available || 0;
      if (delta > available) {
        showAlert(
          'Not enough money',
          `${accountName(accounts, goal.myAccountId)} only has ${formatRp(available)} available. Add money to it first, or put in a smaller amount.`
        );
        return;
      }
    } else if (-delta > mine) {
      showAlert('That’s more than you put in', `Your part of this goal is ${formatRp(mine)}. You can only take out your own money.`);
      return;
    }
    actions.setMyShare(goal.id, mine + delta);
  };

  const sharedMenu = (goal) => {
    const isOwner = goal.ownerId === uid;
    showAlert(goal.name, isOwner ? 'You made this goal.' : undefined, [
      ...(isOwner
        ? [
            {
              text: goal.image ? 'Change photo' : 'Add photo',
              onPress: async () => {
                const img = await pickSmallImage({ aspect: [16, 9], width: 900 });
                if (img) actions.setSharedImage(goal.id, img);
              },
            },
            ...(goal.image ? [{ text: 'Remove photo', onPress: () => actions.setSharedImage(goal.id, null) }] : []),
            {
              text: 'Delete for everyone',
              style: 'destructive',
              onPress: () =>
                showAlert(`Delete "${goal.name}" for everyone?`, 'Everyone’s saved money goes back to their own balance.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => actions.deleteShared(goal.id) },
                ]),
            },
          ]
        : [
            {
              text: 'Leave goal',
              style: 'destructive',
              onPress: () =>
                showAlert(
                  `Leave "${goal.name}"?`,
                  myShare(goal, uid) > 0 ? `Your ${formatRp(myShare(goal, uid))} goes back to your balance.` : '',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Leave', style: 'destructive', onPress: () => actions.leaveShared(goal.id) },
                  ]
                ),
            },
          ]),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const changeGoalPhoto = async (goal) => {
    const img = await pickSmallImage({ aspect: [16, 9], width: 900 });
    if (img) actions.setGoalImage(goal.id, img);
  };

  const confirmDelete = (goal) =>
    showAlert(
      `Delete "${goal.name}"?`,
      goal.saved > 0 ? `The ${formatRp(goal.saved)} saved in it goes back to your balance.` : '',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => actions.deleteGoal(goal.id) },
      ]
    );

  // Long-press a goal for more options
  const goalMenu = (goal) =>
    showAlert(goal.name, undefined, [
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

      {/* Your Monee ID: friends type this to invite you to a shared goal */}
      {!!data.moneeId && (
        <TouchableOpacity
          style={styles.idRow}
          onPress={() => copyText(data.moneeId, 'Your Monee ID')}
          accessibilityLabel="Copy your Monee ID"
        >
          <Text style={styles.muted}>Your Monee ID</Text>
          <Text style={styles.idCode}>{data.moneeId}</Text>
          <Copy size={16} color={C.teal} weight="bold" />
        </TouchableOpacity>
      )}

      {/* Invites from friends */}
      {invites.map((g) => (
        <InviteCard
          key={g.id}
          goal={g}
          accountLabel={accountName(accounts, data.mainAccountId)}
          onJoin={() => actions.acceptInvite(g.id, myName, data.mainAccountId)}
          onDecline={() => actions.declineInvite(g.id)}
        />
      ))}

      {!nothingYet && (
        <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, { padding: 18 }]}>
          <Text style={{ color: C.sky }}>You’ve saved across all goals</Text>
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
          <Text style={styles.label}>Who’s saving?</Text>
          <View style={styles.wrap}>
            <Chip label="Just me" active={!withFriends} onPress={() => setWithFriends(false)} />
            <Chip
              label="With friends"
              icon={(color) => <Users size={16} color={color} weight="bold" />}
              active={withFriends}
              onPress={() => setWithFriends(true)}
            />
          </View>
          {withFriends && (
            <Text style={[styles.muted, { marginTop: 6 }]}>
              After you create it, tap “Invite a friend” on the goal and type their Monee ID. Everyone adds to the
              goal from their own account.
            </Text>
          )}
          <Text style={styles.label}>{withFriends ? 'Keep your part in' : 'Keep the savings in'}</Text>
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
          {!nothingYet && (
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
      {sharedGoals.map((g) => (
        <SharedGoalCard
          key={g.id}
          goal={g}
          uid={uid}
          onChange={(d) => changeMyShare(g, d)}
          onMenu={() => sharedMenu(g)}
          accountLabel={accountName(accounts, g.myAccountId)}
          invite={actions.inviteToShared}
        />
      ))}
      {!nothingYet && (
        <Text style={styles.hint}>Press and hold a goal to change its photo, delete it, or leave it.</Text>
      )}
    </ScrollView>
  );
}

// One goal, shown like a note: a header (photo or gradient) with the name, then the details
function GoalCard({ goal, onChange, onPhoto, onMenu, accountLabel }) {
  const pct = goal.target ? (goal.saved / goal.target) * 100 : 0;
  const done = goal.saved >= goal.target;
  const plan = weeklyPlan(goal.target - goal.saved, goal.deadline);

  return (
    <TouchableOpacity style={styles.goalNote} onLongPress={onMenu} activeOpacity={0.97}>
      <GoalHeader goal={goal} pct={pct} done={done} onPhoto={onPhoto} />

      {/* Body */}
      <View style={styles.goalBody}>
        <ProgressBar pct={pct} color={done ? C.in : C.teal} />
        <Text style={[styles.text, { marginTop: 8 }]}>
          <Text style={{ fontWeight: '700' }}>{formatRp(goal.saved)}</Text>
          <Text style={styles.muted}> of {formatRp(goal.target)}</Text>
        </Text>
        <Text style={[styles.muted, { marginTop: 2 }]}>Kept in {accountLabel}</Text>
        {plan && <Text style={[styles.muted, { marginTop: 4 }]}>{plan}</Text>}

        <MoneyButtons onChange={onChange} />
      </View>
    </TouchableOpacity>
  );
}

// The +10rb / +50rb / +100rb chips and the "Other amount" box, used by both kinds of goal
function MoneyButtons({ onChange }) {
  const [amt, setAmt] = useState('');
  const apply = (sign) => {
    const v = parseAmount(amt);
    if (!v) return;
    onChange(sign * v);
    setAmt('');
  };
  return (
    <>
      <View style={[styles.wrap, { marginTop: 12 }]}>
        {[10000, 50000, 100000].map((a) => (
          <Chip key={a} label={`+${formatShort(a)}`} active={false} onPress={() => onChange(a)} />
        ))}
      </View>
      <View style={[styles.itemRow, { marginTop: 8, marginBottom: 0 }]}>
        <TextInput
          style={[styles.input, { flex: 1, minWidth: 0, marginBottom: 0 }]}
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
    </>
  );
}

// "How much a week" to reach a goal by its deadline
function weeklyPlan(left, deadline, together = false) {
  if (left <= 0 || !deadline) return null;
  const msLeft = new Date(deadline) - new Date();
  if (msLeft <= 0) return 'The deadline passed, but you can still keep going!';
  const weeks = Math.max(1, Math.ceil(msLeft / (7 * 86400000)));
  const perWeek = formatRp(Math.ceil(left / weeks));
  return `${together ? 'Together, save' : 'Save'} ${perWeek} a week to reach it by ${fmtDate(new Date(deadline))}`;
}

// The photo or gradient at the top of a goal, with its name and a badge
function GoalHeader({ goal, pct, done, badge, onPhoto }) {
  const inner = (
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
  return goal.image ? (
    <View style={styles.goalHeader}>
      <Image source={{ uri: goal.image }} style={StyleSheetAbsolute} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(30,50,96,0.9)']} style={styles.goalHeaderShade} />
      {badge}
      {inner}
    </View>
  ) : (
    <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.goalHeaderPlain}>
      {badge}
      {onPhoto && (
        <TouchableOpacity
          onPress={onPhoto}
          style={{ position: 'absolute', top: 10, right: 10, padding: 6 }}
          accessibilityLabel="Add a photo"
        >
          <Camera size={20} color={C.sky} />
        </TouchableOpacity>
      )}
      {inner}
    </LinearGradient>
  );
}

// A goal you save for together with friends
function SharedGoalCard({ goal, uid, onChange, onMenu, accountLabel, invite }) {
  const total = sharedTotal(goal);
  const pct = goal.target ? (total / goal.target) * 100 : 0;
  const done = total >= goal.target;
  const plan = weeklyPlan(goal.target - total, goal.deadline, true);
  const count = goal.members.length;

  // You first, then everyone else by how much they put in
  const people = [...goal.members]
    .map((id) => ({ id, name: id === uid ? 'You' : goal.people?.[id]?.name || 'Friend', amount: myShare(goal, id) }))
    .sort((a, b) => (a.id === uid ? -1 : b.id === uid ? 1 : b.amount - a.amount));

  const [inviting, setInviting] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok: true/false, text }

  const sendInvite = async () => {
    setMsg(null);
    setBusy(true);
    try {
      const friend = await findByCode(code);
      if (!friend) setMsg({ ok: false, text: 'No one has that Monee ID. Check it and try again.' });
      else if (friend.uid === uid) setMsg({ ok: false, text: 'That’s your own Monee ID!' });
      else if (goal.members.includes(friend.uid)) setMsg({ ok: false, text: `${friend.name} is already saving with you.` });
      else if (goal.invited.includes(friend.uid)) setMsg({ ok: false, text: `${friend.name} is already invited.` });
      else if (goal.members.length + goal.invited.length >= 10) setMsg({ ok: false, text: 'A goal can have up to 10 people.' });
      else {
        await invite(goal.id, friend);
        setMsg({ ok: true, text: `Invited ${friend.name}! It shows up on their Goals page.` });
        setCode('');
      }
    } catch (e) {
      setMsg({ ok: false, text: e.message || 'Couldn’t send the invite. Try again.' });
    }
    setBusy(false);
  };

  return (
    <TouchableOpacity style={styles.goalNote} onLongPress={onMenu} activeOpacity={0.97}>
      <GoalHeader
        goal={goal}
        pct={pct}
        done={done}
        badge={
          <View style={styles.sharedBadge}>
            <Users size={14} color="#fff" weight="bold" />
            <Text style={styles.goalBadgeText}>{count}</Text>
          </View>
        }
      />

      <View style={styles.goalBody}>
        <ProgressBar pct={pct} color={done ? C.in : C.teal} />
        <Text style={[styles.text, { marginTop: 8 }]}>
          <Text style={{ fontWeight: '700' }}>{formatRp(total)}</Text>
          <Text style={styles.muted}> of {formatRp(goal.target)} together</Text>
        </Text>
        {plan && <Text style={[styles.muted, { marginTop: 2 }]}>{plan}</Text>}

        {/* Who's in and how much each person put in */}
        <View style={styles.peopleBox}>
          {people.map((p) => (
            <View key={p.id} style={styles.spaceBetween}>
              <Text style={[styles.text, p.id === uid && { fontWeight: '700' }]} numberOfLines={1}>
                {p.name}
                {p.id === goal.ownerId ? ' ·  started it' : ''}
              </Text>
              <Text style={[styles.text, p.id === uid && { fontWeight: '700' }]}>{formatRp(p.amount)}</Text>
            </View>
          ))}
          {goal.invited.map((id) => (
            <View key={id} style={styles.spaceBetween}>
              <Text style={styles.muted} numberOfLines={1}>
                {goal.invitedNames?.[id] || 'Friend'}
              </Text>
              <Text style={styles.muted}>invited</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.muted, { marginTop: 6 }]}>Your part is kept in {accountLabel}</Text>

        <MoneyButtons onChange={onChange} />

        {/* Invite a friend by their Monee ID */}
        {!inviting ? (
          <TouchableOpacity onPress={() => setInviting(true)} style={[styles.rowCenter, { marginTop: 14 }]}>
            <UserPlus size={18} color={C.teal} weight="bold" />
            <Text style={styles.link}>Invite a friend</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.label}>Friend’s Monee ID</Text>
            <View style={[styles.itemRow, { marginBottom: 0 }]}>
              <TextInput
                style={[styles.input, styles.idInput, { flex: 1, minWidth: 0, marginBottom: 0 }]}
                placeholder="e.g. 7K4Q2X"
                placeholderTextColor={C.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                value={code}
                onChangeText={setCode}
              />
              <TouchableOpacity style={[styles.smallBtn, busy && { opacity: 0.7 }]} onPress={sendInvite} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.smallBtnText}>Invite</Text>}
              </TouchableOpacity>
            </View>
            {msg && <Text style={[styles.muted, { marginTop: 6, color: msg.ok ? C.in : C.out }]}>{msg.text}</Text>}
            <TouchableOpacity
              onPress={() => {
                setInviting(false);
                setMsg(null);
                setCode('');
              }}
              style={{ marginTop: 8 }}
            >
              <Text style={[styles.link, { fontSize: 13, color: C.muted }]}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// "Budi invited you to save for Konser"
function InviteCard({ goal, accountLabel, onJoin, onDecline }) {
  const from = goal.people?.[goal.ownerId]?.name || 'A friend';
  const total = sharedTotal(goal);
  return (
    <View style={[styles.card, styles.inviteCard]}>
      <View style={[styles.rowCenter, { gap: 12 }]}>
        <View style={[styles.iconTile, { backgroundColor: C.yellow }]}>
          <GoalIcon name={goal.icon} size={22} color={C.navy} weight="fill" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.text, { fontWeight: '700' }]}>
            {from} invited you to save for “{goal.name}”
          </Text>
          <Text style={styles.muted}>
            {formatRp(total)} of {formatRp(goal.target)} saved · {goal.members.length}{' '}
            {goal.members.length === 1 ? 'person' : 'people'}
          </Text>
        </View>
      </View>
      <Text style={[styles.muted, { marginTop: 8 }]}>If you join, your part is kept in {accountLabel}.</Text>
      <View style={[styles.row, { flexWrap: 'nowrap', marginTop: 4 }]}>
        <TouchableOpacity style={[styles.button, { flex: 1 }]} onPress={onJoin}>
          <Text style={styles.buttonText}>Join</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.buttonOutline, { flex: 1 }]} onPress={onDecline}>
          <Text style={[styles.buttonText, { color: C.navy }]}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const StyleSheetAbsolute = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' };
