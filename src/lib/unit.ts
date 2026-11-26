// 金額の表示単位。設定画面で選び、ブラウザに保存する。
export type Unit = 'yen' | 'man';

export const UNIT_LABEL: Record<Unit, string> = { yen: '円', man: '万円' };

const KEY = 'dashboard.unit';

export function loadUnit(): Unit {
  try {
    return localStorage.getItem(KEY) === 'man' ? 'man' : 'yen';
  } catch {
    return 'yen';
  }
}

export function saveUnit(unit: Unit): void {
  try {
    localStorage.setItem(KEY, unit);
  } catch {
    // 保存できない環境では、画面を開いている間だけ有効
  }
}
