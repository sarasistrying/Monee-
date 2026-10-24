// Monee: the main file. It decides which screen to show.
// The screens and helpers live in the src/ folder.
import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Text } from './src/ui';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { onAuthStateChanged, signOut } from 'firebase/auth';

import { auth, firebaseReady } from './src/firebase';
import { useMoneeData, deleteAccountAndData, getLegacyData, importLegacyData, skipLegacyData } from './src/data';
import { C, styles } from './src/styles';
import { TabBar } from './src/components';
import { exportCsv } from './src/utils';

import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import AddScreen from './src/screens/AddScreen';
import EditScreen from './src/screens/EditScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import WelcomeModal from './src/WelcomeModal';

export default function App() {
  // Load Monee's fonts before showing anything
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={[styles.center, { backgroundColor: C.navy }]}>
        <ActivityIndicator color={C.yellow} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar style="light" />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Root />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

/* ---------- Logged in or not? ---------- */
function Root() {
  const [user, setUser] = useState(undefined); // undefined = still checking

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (u) => setUser(u || null));
  }, []);

  if (!firebaseReady) {
    return (
      <Message
        title="Firebase isn’t set up yet"
        text={'Monee couldn’t find your Firebase settings.\n\nCheck that your .env file has all the EXPO_PUBLIC_FIREBASE_... lines, then restart with:\nnpx expo start -c'}
      />
    );
  }
  if (user === undefined) return <Loading text="Opening Monee…" />;
  if (!user) return <AuthScreen />;
  return <MainApp key={user.uid} user={user} />; // key: a fresh app for each account
}

function Loading({ text }) {
  return (
    <View style={[styles.center, { backgroundColor: C.navy }]}>
      <ActivityIndicator color={C.yellow} size="large" />
      <Text style={{ color: C.sky, marginTop: 12 }}>{text}</Text>
    </View>
  );
}

function Message({ title, text, action }) {
  return (
    <View style={[styles.center, { backgroundColor: C.bg }]}>
      <Text style={[styles.title, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[styles.text, { textAlign: 'center' }]}>{text}</Text>
      {action}
    </View>
  );
}

/* ---------- The app itself, for one logged-in person ---------- */
function MainApp({ user }) {
  const { data, syncing, error, actions } = useMoneeData(user.uid);
  const [tab, setTab] = useState('home');
  const [addMode, setAddMode] = useState('manual');
  const [overlay, setOverlay] = useState(null); // { type: 'edit', tx } or { type: 'settings' }

  // Offer to move entries from the old phone-only version into this account (asked once)
  const askedLegacy = useRef(false);
  useEffect(() => {
    if (!data || syncing || askedLegacy.current) return;
    askedLegacy.current = true;
    getLegacyData(user.uid).then((legacy) => {
      if (!legacy) return;
      const count = `${legacy.transactions.length} entries and ${legacy.goals.length} goals`;
      Alert.alert(
        'Move your old data?',
        `This phone has ${count} from before you had an account. Move them into this account?`,
        [
          { text: 'Not now', style: 'cancel', onPress: () => skipLegacyData(user.uid) },
          {
            text: 'Move them',
            onPress: () =>
              importLegacyData(user.uid, legacy, data.profile)
                .then(() => Alert.alert('Done!', `Moved ${count} into your account.`))
                .catch((e) => Alert.alert('Couldn’t move the data', `${e.message}\n\nTry again next time you open the app.`)),
          },
        ]
      );
    });
  }, [data, syncing, user.uid]);

  // First time here? Show the welcome popup, which leads into the setup tutorial in Settings
  const [welcomeDone, setWelcomeDone] = useState(false);
  const showWelcome = !!data && !syncing && !data.onboarded && !welcomeDone && !overlay;

  if (!data) {
    if (error) {
      return (
        <Message
          title="Couldn’t load your data"
          text={`${error.message}\n\nCheck your internet connection. If it keeps happening, check the Firestore security rules.`}
          action={
            <TouchableOpacity style={[styles.button, { paddingHorizontal: 24 }]} onPress={() => signOut(auth)}>
              <Text style={styles.buttonText}>Log out</Text>
            </TouchableOpacity>
          }
        />
      );
    }
    return <Loading text="Loading your money…" />;
  }

  const confirmDeleteTx = (id) =>
    Alert.alert('Delete this entry?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          actions.deleteTx(id);
          setOverlay(null);
        },
      },
    ]);

  const goTab = (t, mode) => {
    if (mode) setAddMode(mode);
    setTab(t);
  };
  const openEdit = (tx) => setOverlay({ type: 'edit', tx });

  let content;
  if (overlay?.type === 'edit') {
    content = (
      <EditScreen
        tx={overlay.tx}
        accounts={data.accounts}
        mainAccountId={data.mainAccountId}
        onClose={() => setOverlay(null)}
        onSave={(t) => {
          actions.saveTx(t);
          setOverlay(null);
        }}
        onDelete={() => confirmDeleteTx(overlay.tx.id)}
      />
    );
  } else if (overlay?.type === 'settings') {
    content = (
      <SettingsScreen
        data={data}
        user={user}
        actions={actions}
        tutorial={!!overlay.tutorial}
        onExport={() => exportCsv(data.transactions, data.accounts)}
        onLogout={() => signOut(auth)}
        onDeleteAccount={(password) => deleteAccountAndData(user, password)}
        onClose={() => setOverlay(null)}
      />
    );
  } else if (tab === 'home') {
    content = (
      <HomeScreen
        data={data}
        displayName={data.profile.name || user.displayName || ''}
        syncing={syncing}
        onEdit={openEdit}
        onSettings={() => setOverlay({ type: 'settings' })}
        onPinAccount={actions.setMainAccount}
        goTab={goTab}
      />
    );
  } else if (tab === 'history') {
    content = <HistoryScreen transactions={data.transactions} accounts={data.accounts} onEdit={openEdit} />;
  } else if (tab === 'add') {
    content = (
      <AddScreen
        mode={addMode}
        setMode={setAddMode}
        accounts={data.accounts}
        mainAccountId={data.mainAccountId}
        onSave={(t) => {
          actions.saveTx(t);
          setTab('home');
        }}
      />
    );
  } else if (tab === 'goals') {
    content = <GoalsScreen data={data} actions={actions} />;
  } else {
    content = <InsightsScreen data={data} />;
  }

  return (
    <View style={styles.body}>
      <View style={{ flex: 1 }}>{content}</View>
      {!overlay && <TabBar tab={tab} setTab={setTab} />}
      <WelcomeModal
        visible={showWelcome}
        name={data.profile.name || user.displayName || ''}
        onStart={() => {
          setWelcomeDone(true);
          setOverlay({ type: 'settings', tutorial: true });
        }}
      />
    </View>
  );
}
