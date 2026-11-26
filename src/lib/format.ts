// 日付と金額の表示。ブラウザ標準の Intl だけを使う。
const dateParts = new Intl.DateTimeFormat('ja-JP', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' });

/** 例：2026年10月3日(土) */
export function formatDate(date: string): string {
  const parts = Object.fromEntries(dateParts.formatToParts(new Date(`${date}T00:00:00Z`)).map((p) => [p.type, p.value]));
  return `${parts.year}年${parts.month}月${parts.day}日(${parts.weekday})`;
}

/** 例：10月 */
export function formatMonth(month: string): string {
  return `${Number(month.slice(5, 7))}月`;
}

const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });

export function formatYen(amount: number): string {
  return yen.format(amount);
}

/** 例：1,234.5万円 */
export function formatManYen(amount: number): string {
  return `${(amount / 10_000).toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}万円`;
}

/** 設定の表示単位に合わせた金額。例：￥384,980 ／ 38.5万円 */
export function formatAmount(amount: number, unit: 'yen' | 'man'): string {
  if (unit === 'man') return formatManYen(amount);
  return formatYen(amount);
}
