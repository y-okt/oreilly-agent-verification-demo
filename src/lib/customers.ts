// 顧客の一覧と、顧客ごとの注文を取る。
import { orders } from '../data/orders.ts';
import type { Order } from '../types.ts';

/** 顧客名を日本語の文字の順（localeCompare）に並べたもの。読みの五十音順ではない。顧客の画面の「前の顧客」「次の顧客」はこの順で移る。 */
export const customerNames: string[] = [...new Set(orders.map((o) => o.customer))].sort((a, b) => a.localeCompare(b, 'ja'));

export interface CustomerOrders {
  customer: string;
  orders: Order[];
}

/** サーバーから、その顧客の注文を取る。 */
export async function fetchCustomerOrders(name: string): Promise<CustomerOrders> {
  const res = await fetch(`/api/customers/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`顧客「${name}」の注文を取れませんでした（${res.status}）`);
  return res.json();
}
