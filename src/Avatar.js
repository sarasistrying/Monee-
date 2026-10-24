// Round profile picture. Shows your photo, or your initials on a gradient.
import React from 'react';
import { View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './ui';
import { C } from './styles';

const initialsOf = (name) =>
  (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'M';

export default function Avatar({ name, photo, size = 44 }) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (photo) {
    return <Image source={{ uri: photo }} style={[round, { borderWidth: 2, borderColor: C.sky }]} />;
  }
  return (
    <LinearGradient
      colors={[C.sky, C.teal]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[round, { alignItems: 'center', justifyContent: 'center' }]}
    >
      <View>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.38 }}>{initialsOf(name)}</Text>
      </View>
    </LinearGradient>
  );
}
