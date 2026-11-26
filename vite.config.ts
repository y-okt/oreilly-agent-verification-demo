import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// 顧客ごとの注文を返す API（GET /api/customers/<顧客名>）。開発サーバーとプレビューの両方で動く。
function customersApi(): Plugin {
  const handle = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const name = decodeURIComponent((req.url ?? '').replace(/^\//, '').split('?')[0]);
    const orders = JSON.parse(readFileSync('src/data/orders.json', 'utf8')) as { customer: string }[];
    const own = orders.filter((o) => o.customer === name);
    if (!name || own.length === 0) return next();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ customer: name, orders: own }));
  };
  return {
    name: 'customers-api',
    configureServer: (server) => void server.middlewares.use('/api/customers', handle),
    configurePreviewServer: (server) => void server.middlewares.use('/api/customers', handle),
  };
}

export default defineConfig({
  plugins: [react(), customersApi()],
  build: { chunkSizeWarningLimit: 1000 },
});
