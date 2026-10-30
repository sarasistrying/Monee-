import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, Image, ActivityIndicator, Platform } from 'react-native';
import { showAlert } from '../dialog';
import { Text } from '../ui';
import * as ImagePicker from 'expo-image-picker';
import { C, styles } from '../styles';
import TransactionForm from '../TransactionForm';
import { matchAccount } from '../money';
import { readReceiptWithAI } from '../ai';
import { Camera, ImageIcon, PencilSimple, Receipt, Sparkle } from '../icons';
import { shrinkImage } from '../images';

export default function AddScreen({ mode, setMode, onSave, accounts, mainAccountId }) {
  const [image, setImage] = useState(null); // { uri, base64, mimeType, thumb }
  const [aiState, setAiState] = useState('idle'); // idle | loading | done
  const [prefill, setPrefill] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const imageUri = image?.uri;

  const useImage = (asset) => {
    // In a browser the picture sometimes comes as a "data:" link instead of base64, so take it from there
    let base64 = asset.base64;
    let mimeType = asset.mimeType;
    const dataUrl = /^data:([^;]+);base64,(.*)$/.exec(asset.uri || '');
    if (!base64 && dataUrl) {
      mimeType = mimeType || dataUrl[1];
      base64 = dataUrl[2];
    }
    setImage({ uri: asset.uri, base64, mimeType: mimeType || 'image/jpeg', thumb: null });

    // Make a small copy of the receipt to save with the entry. The full photo can be several MB,
    // which is too big for the database (max 1 MB per entry). The small copy also syncs to your other devices.
    shrinkImage(asset.uri).then((thumb) =>
      setImage((cur) => (cur && cur.uri === asset.uri ? { ...cur, thumb } : cur))
    );
    setPrefill(null);
    setAiState('idle');
    setFormKey((k) => k + 1);
  };

  const takePhoto = async () => {
    // Browsers ask for the camera themselves, so only check permission on phones
    const perm = Platform.OS === 'web' ? { granted: true } : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showAlert('Camera needed', 'Please allow camera access to scan paper receipts.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true });
    if (!result.canceled) useImage(result.assets[0]);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
    if (!result.canceled) useImage(result.assets[0]);
  };

  const clearImage = () => {
    setImage(null);
    setPrefill(null);
    setAiState('idle');
  };

  const scanWithAI = async () => {
    if (!image?.base64) {
      showAlert('Pick the picture again', 'Monee needs to reload this picture before the AI can read it.');
      return;
    }
    setAiState('loading');
    try {
      const r = await readReceiptWithAI(image.base64, image.mimeType);
      // Match "Paid with GoPay" on the receipt to your GoPay account
      const accountId = matchAccount(accounts, mainAccountId, { paymentText: r.paidWith, wallet: r.wallet });
      setPrefill({ type: 'expense', note: '', ...r, amount: r.total, accountId });
      setFormKey((k) => k + 1); // rebuild the form with the AI's answers
      setAiState('done');
    } catch (e) {
      setAiState('idle');
      showAlert('Couldn’t read the receipt', e.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>New entry</Text>

      <View style={styles.segment}>
        {[
          { key: 'manual', label: 'Type it in', Icon: PencilSimple },
          { key: 'scan', label: 'Scan receipt', Icon: Receipt },
        ].map(({ key, label, Icon }) => (
          <TouchableOpacity
            key={key}
            style={[styles.segmentBtn, styles.btnContent, mode === key && styles.segmentActive]}
            onPress={() => setMode(key)}
          >
            <Icon size={18} color={mode === key ? '#fff' : C.navy} weight="bold" />
            <Text style={[styles.segmentText, mode === key && styles.segmentTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'manual' ? (
        <TransactionForm onSave={onSave} submitLabel="Save entry" accounts={accounts} mainAccountId={mainAccountId} />
      ) : !imageUri ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add a receipt</Text>
          <Text style={[styles.muted, { marginBottom: 4, lineHeight: 19 }]}>
            Paper receipt: take a photo.{'\n'}Digital receipt (GoPay, ShopeePay, online order): pick the
            screenshot from your gallery.
          </Text>
          <TouchableOpacity style={styles.button} onPress={takePhoto}>
            <View style={styles.btnContent}>
              <Camera size={20} color="#fff" weight="bold" />
              <Text style={styles.buttonText}>Take photo</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.buttonOutline]} onPress={pickImage}>
            <View style={styles.btnContent}>
              <ImageIcon size={20} color={C.navy} weight="bold" />
              <Text style={[styles.buttonText, { color: C.navy }]}>Choose from gallery</Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Image source={{ uri: imageUri }} style={styles.receipt} resizeMode="contain" />
          <TouchableOpacity onPress={clearImage} style={{ alignSelf: 'center', marginBottom: 8 }}>
            <Text style={styles.link}>Use a different picture</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.aiButton, aiState === 'loading' && { opacity: 0.7 }]}
            onPress={scanWithAI}
            disabled={aiState === 'loading'}
          >
            {aiState === 'loading' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.buttonText}>Reading receipt…</Text>
              </View>
            ) : (
              <View style={styles.btnContent}>
                <Sparkle size={20} color="#fff" weight="fill" />
                <Text style={styles.buttonText}>{aiState === 'done' ? 'Read it again' : 'Read receipt with AI'}</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.tip}>
            <Text style={styles.tipText}>
              {aiState === 'done'
                ? 'Filled in by AI. Check the numbers before you save, since AI can misread blurry receipts.'
                : 'Tap the button and Monee fills in the store, items and total for you. Or type them yourself below.'}
            </Text>
          </View>

          <TransactionForm
            accounts={accounts}
            mainAccountId={mainAccountId}
            key={formKey}
            initial={prefill || undefined}
            receiptUri={
              image?.thumb || (Platform.OS !== 'web' && !String(imageUri).startsWith('data:') ? imageUri : null)
            }
            showItems
            submitLabel="Save receipt"
            onSave={(t) => {
              onSave(t);
              clearImage();
            }}
          />
        </>
      )}
    </ScrollView>
  );
}
