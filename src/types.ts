export type Status = '支払済' | '保留' | 'キャンセル';
export type Region = '北海道・東北' | '関東' | '中部' | '関西' | '中国・四国' | '九州・沖縄';

export interface Order {
  id: string;
  /** YYYY-MM-DD（UTC） */
  date: string;
  customer: string;
  product: string;
  quantity: number;
  unitPrice: number;
  status: Status;
  region: Region;
}

export const REGIONS: Region[] = ['北海道・東北', '関東', '中部', '関西', '中国・四国', '九州・沖縄'];
