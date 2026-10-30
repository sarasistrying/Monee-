// Picks a photo and shrinks it, so it's small enough to save inside the database.
// (A phone photo can be 3–5 MB; this makes it around 50–150 KB.)
// Saving it as text inside Firestore means it shows up on every device, without needing paid Firebase Storage.
import { showAlert } from './dialog';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// Shrinks any picture into a small "data:image/jpeg;base64,…" text (about 40–80 KB),
// small enough to save with an entry in the database. Returns null if it can't.
export async function shrinkImage(uri, { width = 700, compress = 0.5 } = {}) {
  try {
    const small = await manipulateAsync(uri, [{ resize: { width } }], {
      compress,
      format: SaveFormat.JPEG,
      base64: true,
    });
    return small.base64 ? `data:image/jpeg;base64,${small.base64}` : null;
  } catch (e) {
    return null;
  }
}

export async function pickSmallImage({ aspect = [16, 9], width = 900 } = {}) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true, // lets you crop it to the right shape
    aspect,
    quality: 1,
  });
  if (result.canceled) return null;

  try {
    const small = await manipulateAsync(result.assets[0].uri, [{ resize: { width } }], {
      compress: 0.55,
      format: SaveFormat.JPEG,
      base64: true,
    });
    return `data:image/jpeg;base64,${small.base64}`;
  } catch (e) {
    showAlert('Couldn’t use that picture', 'Try a different photo.');
    return null;
  }
}
