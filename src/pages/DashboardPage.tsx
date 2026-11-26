import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon.tsx';
import { OrdersTable } from '../components/OrdersTable.tsx';
import { SalesChart } from '../components/SalesChart.tsx';
import { SummaryCards } from '../components/SummaryCards.tsx';
import { orders } from '../data/orders.ts';
import { debounce, monthlySales, selectOrders, summarize } from '../lib/summary.ts';
import type { Unit } from '../lib/unit.ts';
import { REGIONS, type Region } from '../types.ts';

export function DashboardPage({ unit }: { unit: Unit }) {
  const [region, setRegion] = useState<Region | 'all'>('all');
  const [keyword, setKeyword] = useState('');
  const applyKeyword = useMemo(() => debounce(setKeyword, 150), []);

  const selected = useMemo(() => selectOrders(orders, region, keyword), [region, keyword]);
  const summary = useMemo(() => summarize(selected), [selected]);
  const monthly = useMemo(() => monthlySales(selected), [selected]);

  return (
    <>
      <div className="filters">
        <label>
          地域
          <select value={region} onChange={(e) => setRegion(e.target.value as Region | 'all')}>
            <option value="all">すべて</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label>
          <Icon name="Search" /> 検索
          <input type="search" placeholder="顧客名・商品名" onChange={(e) => applyKeyword(e.target.value)} />
        </label>
        <span data-testid="match-count">{selected.length}件</span>
      </div>

      <SummaryCards summary={summary} unit={unit} />
      <SalesChart data={monthly} />
      <OrdersTable orders={selected} unit={unit} />
    </>
  );
}
