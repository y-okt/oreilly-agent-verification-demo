// 集計と並べ替え。配列の標準メソッドだけで書いた。
import type { Order, Region } from '../types.ts';

export const amountOf = (order: Order): number => order.quantity * order.unitPrice;

const sum = (orders: Order[]): number => orders.reduce((total, order) => total + amountOf(order), 0);
const round = (value: number, digits = 0): number => Math.round(value * 10 ** digits) / 10 ** digits;

export interface Summary {
  total: number;
  count: number;
  average: number;
  cancelRate: number;
}

export function summarize(orders: Order[]): Summary {
  const valid = orders.filter((o) => o.status !== 'キャンセル');
  const total = sum(valid);
  return {
    total,
    count: orders.length,
    average: valid.length ? round(total / valid.length) : 0,
    cancelRate: orders.length ? round(((orders.length - valid.length) / orders.length) * 100, 1) : 0,
  };
}

export interface MonthlySales {
  /** YYYY-MM */
  month: string;
  total: number;
}

export function monthlySales(orders: Order[]): MonthlySales[] {
  const totals = new Map<string, number>();
  for (const order of orders) {
    if (order.status === 'キャンセル') continue;
    const month = order.date.slice(0, 7);
    totals.set(month, (totals.get(month) ?? 0) + amountOf(order));
  }
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total }));
}

export function selectOrders(orders: Order[], region: Region | 'all', keyword: string): Order[] {
  const word = keyword.trim();
  return orders
    .filter((o) => (region === 'all' || o.region === region) && (word === '' || o.customer.includes(word) || o.product.includes(word)))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

export function debounce<T extends unknown[]>(fn: (...args: T) => void, wait: number): (...args: T) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: T) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
