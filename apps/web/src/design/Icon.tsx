import {
  ArrowLeft,
  ArrowRight,
  Award,
  Brain,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Crown,
  Flag,
  Flame,
  Gauge,
  Grid3x3,
  Handshake,
  Hash,
  Heart,
  Home,
  Link2,
  ListOrdered,
  Loader2,
  LogOut,
  Medal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  Shapes,
  Sparkles,
  Star,
  Swords,
  Target,
  Trophy,
  User,
  Users,
  Volume2,
  VolumeX,
  WifiOff,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** Semantic icon names used across the app and by mini-game definitions. */
export const ICONS = {
  brain: Brain,
  trophy: Trophy,
  crown: Crown,
  medal: Medal,
  award: Award,
  star: Star,
  sparkles: Sparkles,
  flame: Flame,
  bolt: Zap,
  heart: Heart,
  flag: Flag,
  rocket: Rocket,
  handshake: Handshake,
  swords: Swords,
  users: Users,
  user: User,
  home: Home,
  play: Play,
  pause: Pause,
  refresh: RefreshCw,
  search: Search,
  settings: Settings,
  logout: LogOut,
  copy: Copy,
  link: Link2,
  check: Check,
  close: X,
  plus: Plus,
  clock: Clock,
  target: Target,
  spinner: Loader2,
  offline: WifiOff,
  back: ArrowLeft,
  forward: ArrowRight,
  chevron: ChevronRight,
  sound: Volume2,
  muted: VolumeX,
  // Mini-game glyphs
  grid: Grid3x3,
  numbers: Hash,
  shapes: Shapes,
  bar: Gauge,
  sequence: ListOrdered,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName | string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, className, strokeWidth = 2.4 }: IconProps) {
  const Glyph = (ICONS as Record<string, LucideIcon>)[name] ?? Brain;
  return <Glyph size={size} className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
