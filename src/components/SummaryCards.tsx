import { formatAmount } from '../lib/format.ts';
import type { Summary } from '../lib/summary.ts';
import type { Unit } from '../lib/unit.ts';
import { Icon, type IconName } from './Icon.tsx';

export function SummaryCards({ summary, unit }: { summary: Summary; unit: Unit }) {
  const cards: { label: string; value: string; icon: IconName }[] = [
    { label: '売上合計', value: formatAmount(summary.total, unit), icon: 'JapaneseYen' },
    { label: '注文数', value: `${summary.count}件`, icon: 'ShoppingCart' },
    { label: '平均注文額', value: formatAmount(summary.average, unit), icon: 'Calculator' },
    { label: 'キャンセル率', value: `${summary.cancelRate.toFixed(1)}%`, icon: 'Ban' },
  ];
  return (
    <section className="cards" data-testid="summary-cards" aria-label="集計">
      {cards.map((card) => (
        <div className="card" key={card.label}>
          <div className="card-label">
            <Icon name={card.icon} /> {card.label}
          </div>
          <div className="card-value">{card.value}</div>
        </div>
      ))}
    </section>
  );
}
