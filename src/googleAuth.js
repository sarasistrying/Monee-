// "Continue with Google"
//
//   On the website: Firebase opens a Google pop-up window.
//   In the Android app: the phone's own Google account picker appears
//     (uses @react-native-google-signin, which only works in the built APK, not in Expo Go).
//
// Either way, Google gives us a proof of who you are, and Firebase logs you into Monee with it.
// If you already had a Monee account with the same Gmail, it's the same account: same data.
import { Platform } from 'react-native';
import {
  GoogleAuthProvider,
  getAdditionalUserInfo,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithCredential,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from './firebase';

// From Firebase → Authentication → Sign-in method → Google → "Web client ID"
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

const isWeb = Platform.OS === 'web';

function moneeError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

// The Android Google library is loaded only when needed, so the app still opens in Expo Go
let nativeLib = null;
function getNative() {
  if (nativeLib) return nativeLib;
  let lib;
  try {
    lib = require('@react-native-google-signin/google-signin');
  } catch (e) {
    throw moneeError(
      'monee/expo-go',
      'Google sign-in doesn’t work in Expo Go. Try it in the Monee app (APK) or on the website.'
    );
  }
  if (!WEB_CLIENT_ID) {
    throw moneeError('monee/no-client-id', 'Google sign-in isn’t set up yet (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing).');
  }
  lib.GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  nativeLib = lib;
  return lib;
}

// Android: shows the account picker and returns Google's ID token (null if you cancelled)
async function pickGoogleAccount() {
  const { GoogleSignin, isSuccessResponse } = getNative();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res)) return null;
  if (!res.data.idToken) throw moneeError('monee/no-token', 'Google didn’t send a login token. Check the Web client ID.');
  return res.data.idToken;
}

const webProvider = () => {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' }); // always let you choose which Google account
  return p;
};

// Returns { user, isNewUser }, or null if you closed the picker
export async function signInWithGoogle() {
  let cred;
  if (isWeb) {
    cred = await signInWithPopup(auth, webProvider());
  } else {
    const idToken = await pickGoogleAccount();
    if (!idToken) return null;
    cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  }
  return { user: cred.user, isNewUser: !!getAdditionalUserInfo(cred)?.isNewUser };
}

// Before deleting an account, Firebase wants you to prove it's you again
export async function reauthWithGoogle(user) {
  if (isWeb) {
    await reauthenticateWithPopup(user, webProvider());
    return;
  }
  const idToken = await pickGoogleAccount();
  if (!idToken) throw moneeError('monee/cancelled', 'You closed the Google window. Try again to confirm.');
  await reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken));
}

// Also forget the Google account on the phone, so next time you can pick a different one
export async function googleSignOut(user) {
  if (isWeb || !user?.providerData?.some((p) => p.providerId === 'google.com')) return;
  try {
    await getNative().GoogleSignin.signOut();
  } catch (e) {
    // not important: Firebase logs you out either way
  }
}

// true = this account has a Monee password (signed up with email), false = Google only
export const hasPassword = (user) => !!user?.providerData?.some((p) => p.providerId === 'password');
export const hasGoogle = (user) => !!user?.providerData?.some((p) => p.providerId === 'google.com');

// Google errors in normal sentences. Returns '' when there's nothing to show (you just closed the window).
export function friendlyGoogleError(e) {
  const code = String(e?.code ?? '');
  const native = nativeLib?.statusCodes || {};
  if (code && code === String(native.PLAY_SERVICES_NOT_AVAILABLE)) {
    return 'Google Play services are missing or out of date on this phone.';
  }
  if (code && (code === String(native.SIGN_IN_CANCELLED) || code === String(native.IN_PROGRESS))) return '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
    case '12501': // Android: closed the picker
      return '';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google window. Allow pop-ups for this site and try again.';
    case 'auth/unauthorized-domain':
      return 'This website isn’t allowed to use Google login yet. Add it in Firebase → Authentication → Settings → Authorized domains.';
    case 'auth/operation-not-allowed':
      return 'Google login is turned off. Turn it on in Firebase → Authentication → Sign-in method.';
    case 'auth/account-exists-with-different-credential':
      return 'This email already has a Monee account. Log in with your email and password instead.';
    case 'auth/network-request-failed':
      return 'No internet connection. Check your Wi-Fi or data and try again.';
    case 'PLAY_SERVICES_NOT_AVAILABLE':
      return 'Google Play services are missing or out of date on this phone.';
    case 'DEVELOPER_ERROR':
    case '10':
      return 'Google sign-in isn’t fully set up for this app yet (check the SHA-1 fingerprint and Web client ID in Firebase).';
    default:
      return e?.message || 'Google sign-in didn’t work. Please try again.';
  }
}
