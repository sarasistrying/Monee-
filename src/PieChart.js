// A donut ("pie with a hole") chart, drawn with react-native-svg.
//
// How it works: each slice is the same circle, drawn as a thick outline (stroke).
// strokeDasharray draws only part of the outline ("draw 30% of it, then skip the rest"),
// and strokeDashoffset moves where that part starts, so the slices sit one after another.
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

// slices: [{ key, value, color }]
export default function PieChart({ slices, size = 128, thickness = 20, trackColor = 'rgba(255,255,255,0.15)', children }) {
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r; // the length of the whole outline
  const total = slices.reduce((s, x) => s + x.value, 0);
  const many = slices.filter((x) => x.value > 0).length > 1;
  const gap = many ? Math.min(3, circ * 0.01) : 0; // a little space between slices

  let start = 0;
  const arcs = total
    ? slices
        .filter((x) => x.value > 0)
        .map((x) => {
          const len = (x.value / total) * circ;
          const arc = { ...x, start, len: Math.max(0.5, len - gap) };
          start += len;
          return arc;
        })
    : [];

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
        {/* Start at 12 o'clock and go clockwise */}
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={thickness} fill="none" />
          {arcs.map((a) => (
            <Circle
              key={a.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={a.color}
              strokeWidth={thickness}
              fill="none"
              strokeDasharray={`${a.len} ${circ}`}
              strokeDashoffset={-a.start}
            />
          ))}
        </G>
      </Svg>
      {/* Whatever you put inside <PieChart>…</PieChart> shows in the hole */}
      {children}
    </View>
  );
}
