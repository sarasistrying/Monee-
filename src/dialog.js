// Pop-up messages that work everywhere.
//   On phones:  uses the normal Android/iPhone pop-up (Alert.alert)
//   On the web: browsers can't show pop-ups with custom buttons, so Monee draws its own
//
// Use it exactly like Alert.alert:
//   showAlert('Delete this?', 'This can’t be undone.', [
//     { text: 'Cancel', style: 'cancel' },
//     { text: 'Delete', style: 'destructive', onPress: () => … },
//   ]);
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, TouchableOpacity, View } from 'react-native';
import { Text } from './ui';
import { C, styles } from './styles';

let show = null; // set by <DialogHost />

export function showAlert(title, message, buttons) {
  const list = buttons && buttons.length ? buttons : [{ text: 'OK' }];
  if (Platform.OS !== 'web') return Alert.alert(title, message, list);
  if (show) return show({ title, message, buttons: list });
  // Fallback if the host isn't on screen yet
  if (typeof window !== 'undefined') window.alert([title, message].filter(Boolean).join('\n\n'));
}

// Put this once near the top of the app. It only draws anything on the web.
export function DialogHost() {
  const [dialog, setDialog] = useState(null);
  useEffect(() => {
    show = setDialog;
    return () => {
      show = null;
    };
  }, []);
  if (Platform.OS !== 'web' || !dialog) return null;

  const cancel = dialog.buttons.find((b) => b.style === 'cancel');
  const press = (b) => {
    setDialog(null);
    b?.onPress?.();
  };
  // Cancel goes last, like on Android
  const ordered = [...dialog.buttons.filter((b) => b.style !== 'cancel'), ...(cancel ? [cancel] : [])];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => press(cancel)}>
      <View style={[styles.center, { backgroundColor: 'rgba(15,26,52,0.5)' }]}>
        <Pressable style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} onPress={() => cancel && press(cancel)} />
        <View style={{ width: '100%', maxWidth: 360, backgroundColor: C.card, borderRadius: 22, padding: 18, gap: 8 }}>
          <Text style={[styles.cardTitle, { fontSize: 17 }]}>{dialog.title}</Text>
          {!!dialog.message && <Text style={[styles.text, { color: C.muted, marginBottom: 6 }]}>{dialog.message}</Text>}
          {ordered.map((b, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => press(b)}
              style={[
                styles.button,
                { marginTop: 4 },
                b.style === 'cancel' && styles.buttonOutline,
                b.style === 'destructive' && styles.buttonDanger,
              ]}
            >
              <Text
                style={[
                  styles.buttonText,
                  b.style === 'cancel' && { color: C.navy },
                  b.style === 'destructive' && { color: C.out },
                ]}
              >
                {b.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}
