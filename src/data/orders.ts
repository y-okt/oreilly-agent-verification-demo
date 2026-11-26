// 画面に出す注文データ（固定の120件）。orders.json を読み込むだけ。
import data from './orders.json';
import type { Order } from '../types.ts';

export const orders = data as Order[];
