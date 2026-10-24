// Shown once, right after someone logs in for the first time
import React from 'react';
import { Modal, View, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './ui';
import { C, GRADIENT, styles } from './styles';
import { Sparkle, Wallet, Target } from './icons';

export default function WelcomeModal({ visible, name, onStart }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[styles.center, { backgroundColor: 'rgba(15,26,52,0.55)' }]}>
        <View style={{ width: '100%', maxWidth: 380, borderRadius: 26, overflow: 'hidden', backgroundColor: C.card }}>
          <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 22 }}>
            <Sparkle size={28} color={C.yellow} weight="fill" />
            <Text style={[styles.guideTitle, { fontSize: 24, marginTop: 10 }]}>
              Welcome to Monee{name ? `, ${name}` : ''}!
            </Text>
            <Text style={styles.guideText}>Before you start, let’s set up two things. It takes about a minute.</Text>
          </LinearGradient>

          <View style={{ padding: 20, gap: 14 }}>
            <View style={[styles.rowCenter, { gap: 12 }]}>
              <View style={[styles.iconTile, { backgroundColor: C.skySoft }]}>
                <Wallet size={20} color={C.navy} weight="duotone" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.text, { fontWeight: '700' }]}>Your accounts</Text>
                <Text style={styles.muted}>The e-money apps you use, like GoPay or OVO</Text>
              </View>
            </View>
            <View style={[styles.rowCenter, { gap: 12 }]}>
              <View style={[styles.iconTile, { backgroundColor: C.yellowSoft }]}>
                <Target size={20} color={C.navy} weight="duotone" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.text, { fontWeight: '700' }]}>Your monthly budget</Text>
                <Text style={styles.muted}>How much you want to spend each month</Text>
              </View>
            </View>

            <Text style={[styles.muted, { marginTop: 2 }]}>
              You’ll find all of this later in Settings: just tap your profile picture on Home.
            </Text>

            <TouchableOpacity style={[styles.button, { marginTop: 4 }]} onPress={onStart}>
              <Text style={styles.buttonText}>Let’s set it up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
