// All of Monee's icons in one place (Phosphor icons, free, MIT license: phosphoricons.com)
// To change an icon, swap the name here and it changes everywhere in the app.
import React from 'react';
import {
  // categories: money out
  ForkKnife,
  Coffee,
  Motorcycle,
  BookOpen,
  GameController,
  ShoppingBag,
  DeviceMobile,
  Gift,
  Package,
  // categories: money in
  Money,
  Envelope,
  Briefcase,
  Tag,
  Sparkle,
  // wallets
  Wallet,
  Bank,
  // goals
  Target,
  Headphones,
  Sneaker,
  Laptop,
  AirplaneTilt,
  PiggyBank,
} from 'phosphor-react-native';
import { C } from './styles';

// The icons used for buttons and screens, re-exported so screens import from one place
export {
  House,
  ClockCounterClockwise,
  ChartPieSlice,
  Gear,
  Plus,
  Receipt,
  Camera,
  Image as ImageIcon,
  PencilSimple,
  Sparkle,
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
  X,
  Warning,
  CalendarBlank,
  Leaf,
  CloudArrowUp,
  Export,
  SignOut,
  Trash,
  ArrowDown,
  ArrowUp,
  Target,
  PushPin,
  CheckCircle,
  Wallet,
} from 'phosphor-react-native';

const CATEGORY_ICONS = {
  Food: ForkKnife,
  Drinks: Coffee,
  Transport: Motorcycle,
  School: BookOpen,
  Fun: GameController,
  Shopping: ShoppingBag,
  'Data & Top-up': DeviceMobile,
  Gifts: Gift,
  Other: Package,
  Allowance: Money,
  'Gift money': Envelope,
  'Part-time': Briefcase,
  'Selling stuff': Tag,
  'Other income': Sparkle,
};

const WALLET_ICONS = {
  Cash: Money,
  'E-wallet': Wallet,
  Bank: Bank,
};

// The keys must match GOAL_ICON_KEYS in constants.js
const GOAL_ICONS = {
  target: Target,
  savings: PiggyBank,
  headphones: Headphones,
  sneaker: Sneaker,
  phone: DeviceMobile,
  game: GameController,
  laptop: Laptop,
  travel: AirplaneTilt,
  gift: Gift,
};

export function CategoryIcon({ name, size = 20, color = C.navy, weight = 'duotone' }) {
  const Icon = CATEGORY_ICONS[name] || Package;
  return <Icon size={size} color={color} weight={weight} />;
}

export function WalletIcon({ name, size = 20, color = C.navy, weight = 'duotone' }) {
  const Icon = WALLET_ICONS[name] || Wallet;
  return <Icon size={size} color={color} weight={weight} />;
}

export function GoalIcon({ name, size = 22, color = C.navy, weight = 'duotone' }) {
  const Icon = GOAL_ICONS[name] || Target;
  return <Icon size={size} color={color} weight={weight} />;
}

// Icon for one of your accounts, based on its kind ('ewallet' | 'bank' | 'cash')
const KIND_TO_WALLET = { ewallet: 'E-wallet', bank: 'Bank', cash: 'Cash' };
export function AccountIcon({ kind, size = 20, color = C.navy, weight = 'duotone' }) {
  return <WalletIcon name={KIND_TO_WALLET[kind] || 'E-wallet'} size={size} color={color} weight={weight} />;
}
