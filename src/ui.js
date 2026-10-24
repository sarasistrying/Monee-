// Monee's own Text and TextInput.
// They work exactly like React Native's, but automatically use Monee's fonts:
//   fontWeight '400'…'800'  →  the matching Plus Jakarta Sans file
//   a style with its own fontFamily (like the big numbers) keeps it
//   every font size is scaled by FONT_SCALE
import React, { forwardRef } from 'react';
import { Text as RNText, TextInput as RNTextInput, StyleSheet } from 'react-native';

export const FONTS = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  800: 'PlusJakartaSans_800ExtraBold',
  display: 'BricolageGrotesque_800ExtraBold', // titles and big numbers
  displayBold: 'BricolageGrotesque_700Bold',
};

// Makes every text in the app a little smaller. 1 = original size, 0.9 = 10% smaller.
export const FONT_SCALE = 0.9;

function withFont(style) {
  const flat = StyleSheet.flatten(style) || {};
  const { fontWeight, ...rest } = flat;
  if (typeof rest.fontSize === 'number') rest.fontSize = Math.round(rest.fontSize * FONT_SCALE * 2) / 2;
  if (typeof rest.lineHeight === 'number') rest.lineHeight = Math.round(rest.lineHeight * FONT_SCALE);
  if (rest.fontFamily) return rest;
  let w = fontWeight === 'bold' ? 700 : Number(fontWeight) || 400;
  w = w >= 800 ? 800 : w >= 700 ? 700 : w >= 600 ? 600 : w >= 500 ? 500 : 400;
  return { ...rest, fontFamily: FONTS[w] };
}

export function Text({ style, ...props }) {
  return <RNText {...props} style={withFont(style)} />;
}

export const TextInput = forwardRef(function MoneeTextInput({ style, ...props }, ref) {
  return <RNTextInput ref={ref} {...props} style={withFont(style)} />;
});
