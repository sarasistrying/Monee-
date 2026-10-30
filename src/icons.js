// All of Monee's icons in one place (Phosphor icons, free, MIT license: phosphoricons.com)
// To change an icon, swap the name here and it changes everywhere in the app.
import React from 'react';
// Each icon is loaded on its own, so the app only includes the ~45 icons it uses
// (not all 1,500 in the library). That keeps the website much smaller.
import { AirplaneTilt } from 'phosphor-react-native/src/icons/AirplaneTilt';
import { ArrowDown } from 'phosphor-react-native/src/icons/ArrowDown';
import { ArrowUp } from 'phosphor-react-native/src/icons/ArrowUp';
import { Bank } from 'phosphor-react-native/src/icons/Bank';
import { BookOpen } from 'phosphor-react-native/src/icons/BookOpen';
import { Briefcase } from 'phosphor-react-native/src/icons/Briefcase';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
import { Camera } from 'phosphor-react-native/src/icons/Camera';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { ChartPieSlice } from 'phosphor-react-native/src/icons/ChartPieSlice';
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle';
import { ClockCounterClockwise } from 'phosphor-react-native/src/icons/ClockCounterClockwise';
import { CloudArrowUp } from 'phosphor-react-native/src/icons/CloudArrowUp';
import { Coffee } from 'phosphor-react-native/src/icons/Coffee';
import { DeviceMobile } from 'phosphor-react-native/src/icons/DeviceMobile';
import { Envelope } from 'phosphor-react-native/src/icons/Envelope';
import { Export } from 'phosphor-react-native/src/icons/Export';
import { ForkKnife } from 'phosphor-react-native/src/icons/ForkKnife';
import { GameController } from 'phosphor-react-native/src/icons/GameController';
import { Gear } from 'phosphor-react-native/src/icons/Gear';
import { Gift } from 'phosphor-react-native/src/icons/Gift';
import { Headphones } from 'phosphor-react-native/src/icons/Headphones';
import { House } from 'phosphor-react-native/src/icons/House';
import { Image } from 'phosphor-react-native/src/icons/Image';
import { Laptop } from 'phosphor-react-native/src/icons/Laptop';
import { Leaf } from 'phosphor-react-native/src/icons/Leaf';
import { MagnifyingGlass } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { Money } from 'phosphor-react-native/src/icons/Money';
import { Motorcycle } from 'phosphor-react-native/src/icons/Motorcycle';
import { Package } from 'phosphor-react-native/src/icons/Package';
import { PencilSimple } from 'phosphor-react-native/src/icons/PencilSimple';
import { PiggyBank } from 'phosphor-react-native/src/icons/PiggyBank';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { PushPin } from 'phosphor-react-native/src/icons/PushPin';
import { Receipt } from 'phosphor-react-native/src/icons/Receipt';
import { ShoppingBag } from 'phosphor-react-native/src/icons/ShoppingBag';
import { SignOut } from 'phosphor-react-native/src/icons/SignOut';
import { Sneaker } from 'phosphor-react-native/src/icons/Sneaker';
import { Sparkle } from 'phosphor-react-native/src/icons/Sparkle';
import { Tag } from 'phosphor-react-native/src/icons/Tag';
import { Target } from 'phosphor-react-native/src/icons/Target';
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { Wallet } from 'phosphor-react-native/src/icons/Wallet';
import { Warning } from 'phosphor-react-native/src/icons/Warning';
import { X } from 'phosphor-react-native/src/icons/X';
import { C } from './styles';

// The icons used for buttons and screens
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
};

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
