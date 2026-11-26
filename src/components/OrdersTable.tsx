import { formatAmount, formatDate } from '../lib/format.ts';
import { amountOf } from '../lib/summary.ts';
import type { Unit } from '../lib/unit.ts';
import type { Order } from '../types.ts';

export const PAGE_SIZE = 20;

export function OrdersTable({ orders, unit }: { orders: Order[]; unit: Unit }) {
  return (
    <table data-testid="orders-table">
      <thead>
        <tr>
          <th>注文番号</th>
          <th>日付</th>
          <th>顧客</th>
          <th>商品</th>
          <th className="num">数量</th>
          <th className="num">金額</th>
          <th>状態</th>
          <th>地域</th>
        </tr>
      </thead>
      <tbody>
        {orders.slice(0, PAGE_SIZE).map((order) => (
          <tr key={order.id}>
            <td>{order.id}</td>
            <td>{formatDate(order.date)}</td>
            <td>
              <a href={`#/customers/${encodeURIComponent(order.customer)}`}>{order.customer}</a>
            </td>
            <td>{order.product}</td>
            <td className="num">{order.quantity}</td>
            <td className="num">{formatAmount(amountOf(order), unit)}</td>
            <td>{order.status}</td>
            <td>{order.region}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
