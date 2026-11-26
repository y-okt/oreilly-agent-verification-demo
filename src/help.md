# 使い方

- 地域を選ぶと、集計・グラフ・一覧がその地域だけになります。
- 検索欄には、顧客名か商品名の一部を入れます。
- 一覧は日付の新しい順に、先頭の20件を表示します。

## 集計の決まり

キャンセルされた注文は、売上合計と平均注文額に含めません。

```ts
const valid = orders.filter((order) => order.status !== 'キャンセル');
const total = valid.reduce((sum, order) => sum + order.quantity * order.unitPrice, 0);
```
