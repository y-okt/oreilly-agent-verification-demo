import { useEffect, useState } from 'react';
import { customerNames, fetchCustomerOrders, type CustomerOrders } from '../lib/customers.ts';
import { formatAmount, formatDate } from '../lib/format.ts';
import { amountOf } from '../lib/summary.ts';
import type { Unit } from '../lib/unit.ts';

export function CustomerPage({ name, unit }: { name: string; unit: Unit }) {
  const [data, setData] = useState<CustomerOrders | null>(null);

  // 顧客が変わったら、その顧客の注文を取り直す。
  useEffect(() => {
    setData(null);
    fetchCustomerOrders(name).then(setData);
  }, [name]);

  const index = customerNames.indexOf(name);
  const prev = customerNames[index - 1];
  const next = customerNames[index + 1];
  const own = data ? [...data.orders].sort((a, b) => b.date.localeCompare(a.date)) : [];
  const total = own.filter((o) => o.status !== 'キャンセル').reduce((sum, o) => sum + amountOf(o), 0);

  return (
    <>
      <p className="crumb">
        <a href="#/">← ダッシュボードへ戻る</a>
      </p>
      <div className="customer-head">
        <h2 data-testid="customer-name">{name}</h2>
        <nav className="pager" aria-label="顧客の移動">
          {prev ? <a href={`#/customers/${encodeURIComponent(prev)}`}>← 前の顧客</a> : <span />}
          {next ? <a href={`#/customers/${encodeURIComponent(next)}`}>次の顧客 →</a> : <span />}
        </nav>
      </div>
      {data === null ? (
        <p className="loading" data-testid="customer-loading">読み込み中…</p>
      ) : (
        <>
          <section className="cards two" data-testid="customer-summary" aria-label="顧客の集計">
            <div className="card">
              <div className="card-label">注文数</div>
              <div className="card-value">{own.length}件</div>
            </div>
            <div className="card">
              <div className="card-label">合計金額</div>
              <div className="card-value">{formatAmount(total, unit)}</div>
            </div>
          </section>
          <table data-testid="customer-orders">
            <thead>
              <tr>
                <th>注文番号</th>
                <th>日付</th>
                <th>商品</th>
                <th className="num">数量</th>
                <th className="num">金額</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {own.map((order) => (
                <tr key={order.id}>
                  <td>{order.id}</td>
                  <td>{formatDate(order.date)}</td>
                  <td>{order.product}</td>
                  <td className="num">{order.quantity}</td>
                  <td className="num">{formatAmount(amountOf(order), unit)}</td>
                  <td>{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
