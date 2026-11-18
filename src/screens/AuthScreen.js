// Log in / Sign up / Forgot password
import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text, TextInput } from '../ui';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';
import { createUserProfile } from '../data';
import { friendlyGoogleError, signInWithGoogle } from '../googleAuth';
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
      return 'Wrong email or password. Try again, or tap “Forgot password?”. If you signed up with Google, tap “Continue with Google”.';
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

// Google's "G" logo, for the sign-in button
function GoogleG({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
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
  const [googleBusy, setGoogleBusy] = useState(false);

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

  const google = async () => {
    setError('');
    setInfo('');
    setGoogleBusy(true);
    try {
      const res = await signInWithGoogle();
      // First time with Google? Make the Monee profile, using the name from the Google account
      if (res?.isNewUser) await createUserProfile(res.user.uid, res.user.displayName || '');
      // App.js notices the login and opens the app by itself
    } catch (e) {
      setError(friendlyGoogleError(e));
    }
    setGoogleBusy(false);
  };

  return (
    <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={styles.authWrap} keyboardShouldPersistTaps="handled">
      <Image
        source={require('../../assets/logo-white.png')}
        style={styles.authLogoImage}
        resizeMode="contain"
        accessibilityLabel="Monee"
      />
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

        {mode !== 'reset' && (
          <>
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.muted}>or</Text>
              <View style={styles.orLine} />
            </View>
            <TouchableOpacity
              style={[styles.googleBtn, googleBusy && { opacity: 0.7 }]}
              onPress={google}
              disabled={googleBusy || busy}
              accessibilityLabel="Continue with Google"
            >
              {googleBusy ? (
                <ActivityIndicator color={C.navy} />
              ) : (
                <>
                  <GoogleG size={20} />
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

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
