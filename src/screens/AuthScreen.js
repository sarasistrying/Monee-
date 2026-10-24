// Log in / Sign up / Forgot password
import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Text, TextInput } from '../ui';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';
import { createUserProfile } from '../data';
import { C, GRADIENT, styles } from '../styles';
import { LinearGradient } from 'expo-linear-gradient';

// Turns Firebase's error codes into normal sentences
export function friendlyAuthError(e) {
  switch (e?.code) {
    case 'auth/invalid-email':
      return 'That email address doesn’t look right.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password. Try again, or tap “Forgot password?”.';
    case 'auth/email-already-in-use':
      return 'There’s already an account with this email. Try logging in instead.';
    case 'auth/weak-password':
      return 'Your password needs at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a few minutes, then try again.';
    case 'auth/network-request-failed':
      return 'No internet connection. Check your Wi-Fi or data and try again.';
    case 'auth/requires-recent-login':
      return 'Please log out and log back in, then try again.';
    default:
      return e?.message || 'Something went wrong. Please try again.';
  }
}

const COPY = {
  login: { title: 'Welcome back', button: 'Log in' },
  signup: { title: 'Create your account', button: 'Sign up' },
  reset: { title: 'Reset your password', button: 'Send reset link' },
};

export default function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const switchMode = (m) => {
    setMode(m);
    setError('');
    setInfo('');
    setPassword('');
    setConfirm('');
  };

  const submit = async () => {
    setError('');
    setInfo('');
    const mail = email.trim();
    if (!mail) return setError('Please enter your email.');

    if (mode === 'signup') {
      if (!name.trim()) return setError('Please tell us your name.');
      if (password.length < 6) return setError('Your password needs at least 6 characters.');
      if (password !== confirm) return setError('The two passwords don’t match.');
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, mail, password);
        // App.js notices the login and opens the app by itself
      } else if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, mail, password);
        await updateProfile(cred.user, { displayName: name.trim() });
        await createUserProfile(cred.user.uid, name.trim());
      } else {
        await sendPasswordResetEmail(auth, mail);
        setInfo('If there’s an account with that email, a reset link is on its way. Check your spam folder too.');
      }
    } catch (e) {
      setError(friendlyAuthError(e));
    }
    setBusy(false);
  };

  return (
    <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={styles.authWrap} keyboardShouldPersistTaps="handled">
      <Text style={styles.authLogo}>
        Monee<Text style={styles.authLogoMark}> !</Text>
      </Text>
      <Text style={styles.authTag}>Pocket money, sorted.</Text>

      <View style={styles.authCard}>
        <Text style={styles.cardTitle}>{COPY[mode].title}</Text>
        {mode === 'reset' && (
          <Text style={[styles.muted, { marginBottom: 6 }]}>
            Enter your email and we’ll send you a link to choose a new password.
          </Text>
        )}

        {mode === 'signup' && (
          <>
            <Text style={styles.label}>Your name</Text>
            <TextInput
              style={styles.input}
              placeholder="What should Monee call you?"
              placeholderTextColor={C.muted}
              value={name}
              onChangeText={setName}
              autoComplete="name"
            />
          </>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={C.muted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
        />

        {mode !== 'reset' && (
          <>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
              placeholderTextColor={C.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </>
        )}

        {mode === 'signup' && (
          <>
            <Text style={styles.label}>Type the password again</Text>
            <TextInput
              style={styles.input}
              placeholder="Same password"
              placeholderTextColor={C.muted}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
            />
          </>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}
        {!!info && (
          <View style={styles.successBox}>
            <Text style={[styles.text, { color: C.in }]}>{info}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.button, busy && { opacity: 0.7 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{COPY[mode].button}</Text>}
        </TouchableOpacity>

        {mode === 'login' && (
          <TouchableOpacity onPress={() => switchMode('reset')} style={{ alignSelf: 'center', marginTop: 14 }}>
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={styles.authSwitch}
        onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}
      >
        <Text style={styles.authSwitchText}>
          {mode === 'login' ? 'New to Monee? ' : 'Already have an account? '}
          <Text style={styles.authSwitchLink}>{mode === 'login' ? 'Sign up' : 'Log in'}</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
    </LinearGradient>
  );
}
