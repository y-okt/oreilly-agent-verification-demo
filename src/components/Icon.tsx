// 使うアイコンだけを、名前を指定して読み込む。
import { Ban, Calculator, CircleHelp, JapaneseYen, Search, ShoppingCart, type LucideIcon } from 'lucide-react';

const ICONS = { Ban, Calculator, CircleHelp, JapaneseYen, Search, ShoppingCart } satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const Component = ICONS[name];
  return <Component size={size} aria-hidden="true" />;
}
