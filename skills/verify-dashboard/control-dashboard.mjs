#!/usr/bin/env node
// verify-dashboard のツール。売上ダッシュボードを起動し、利用者と同じ操作でブラウザから動かして、画面の状態と証拠を返す。
// リポジトリの直下で実行する。出力はすべて JSON。失敗は終了コード 1 と reason・next。
//   node skills/verify-dashboard/control-dashboard.mjs --help
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const APP_PORT = Number(process.env.DASHBOARD_PORT ?? 4317);
const CDP_PORT = Number(process.env.DASHBOARD_CDP_PORT ?? 9333);
const APP_URL = `http://127.0.0.1:${APP_PORT}/`;
const STATE_DIR = '.verify-dashboard';
const STATE = join(STATE_DIR, 'instance.json');
const DELAYS = join(STATE_DIR, 'delays.json');
const INFLIGHT = join(STATE_DIR, 'inflight.json');
const EVIDENCE = 'evidence';
const TITLE = '売上ダッシュボード';
const PARTS = { page: 'main', filters: '.filters', cards: '[data-testid="summary-cards"]', chart: '[data-testid="sales-chart"]', table: '[data-testid="orders-table"]', help: '[role="dialog"]', customer: '[data-testid="customer-summary"]', settings: '[data-testid="unit-setting"]' };

const HELP = {
  launch: `ビルドして、アプリ（${APP_URL}）とヘッドレスのブラウザを起動する。ブラウザはコマンドをまたいで同じ画面と設定を保つ。ポートは DASHBOARD_PORT と DASHBOARD_CDP_PORT で変えられる。`,
  doctor: '操作してよい状態かを確かめる。アプリとブラウザが生きているか、配信中の画面が今のソースから作られたものか。',
  state: '今の画面の状態を返す。page（dashboard|customer|settings）と、その画面の値（件数・集計・一覧・表示単位など）。',
  open: 'open dashboard|settings … 画面上部のメニューから移動する。',
  region: 'region <名前|すべて> … ダッシュボードの「地域」の選択欄で選ぶ。',
  search: 'search <語> … ダッシュボードの検索欄に入れる（"" で空に戻す）。',
  customer: 'customer <顧客名> … ダッシュボードの注文一覧で、顧客名のリンクを押して、顧客の画面を開く。',
  next: '顧客の画面で「次の顧客 →」を押す。',
  prev: '顧客の画面で「← 前の顧客」を押す。',
  idle: 'idle [--timeout ミリ秒] … ブラウザが送ったリクエストがすべて返り、画面が落ち着くまで待ってから、今の画面の状態を返す（既定は15秒まで待つ）。決まった秒数だけ sleep する代わりに使う。',
  delay: 'delay <URL の一部> <ミリ秒> … ブラウザが送るリクエストのうち、URL（デコード後）にその文字を含むものへの応答を遅らせる。回線が遅い利用者の状況を作る。delay list で一覧、delay clear で全部消す。cleanup まで残る。',
  unit: 'unit 円|万円 … 設定の画面で、金額の表示単位を選ぶ。',
  help: 'help open|close … ヘルプのダイアログを開く・閉じる。',
  screenshot: 'screenshot [ファイル] [--part page|filters|cards|chart|table|help|customer|settings] … 画面を保存する。既定は evidence/<時刻>-<part>.png。',
  snapshot: 'snapshot [--part …] … アクセシビリティツリー（ARIA）を文字で返す。',
  reload: 'ブラウザの再読み込み。保存された設定は残る。',
  reset: '保存された設定を消して、最初の画面へ戻す。delay は残る。',
  rebuild: 'ソースを変えた後に実行する。ビルドし直し、画面を読み込み直す（保存された設定は残る）。',
  cleanup: 'このツールが起動したアプリとブラウザだけを止める。evidence/ は消さない。',
};

const out = (o, code = 0) => { console.log(JSON.stringify(o, null, 2)); process.exit(code); };
const fail = (reason, next, extra = {}) => out({ ok: false, reason, next, ...extra }, 1);
const sha = (data) => createHash('sha256').update(data).digest('hex').slice(0, 12);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const readState = () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : null);
const writeState = (s) => { mkdirSync(STATE_DIR, { recursive: true }); writeFileSync(STATE, JSON.stringify(s, null, 2)); };

/** ビルドの入力（src/ と、ビルドに効く設定）のハッシュ。 */
function sourceRevision() {
  const hash = createHash('sha256');
  const walk = (path) => {
    if (statSync(path).isDirectory()) for (const name of readdirSync(path).sort()) walk(join(path, name));
    else hash.update(path).update(readFileSync(path));
  };
  for (const path of ['src', 'index.html', 'vite.config.ts', 'package.json']) if (existsSync(path)) walk(path);
  return hash.digest('hex').slice(0, 12);
}

async function fetchHtml() { try { return await (await fetch(APP_URL)).text(); } catch { return null; } }

function build() {
  const r = spawnSync('pnpm', ['exec', 'vite', 'build', '--logLevel', 'error'], { encoding: 'utf8' });
  if (r.status !== 0) fail('ビルドに失敗しました。', 'stderr を読んで、ソースの誤りを直してから、もう一度実行してください。', { stderr: (r.stderr || r.stdout).slice(-800) });
}

// ---- ブラウザ（別プロセスで起動し、CDP で毎回つなぐ） ----

async function serveBrowser() {
  // launch から切り離して起動される。ブラウザを開いたまま、止められるまで待つ。
  const { chromium } = await import('playwright');
  const opts = {
    headless: true,
    viewport: { width: 1280, height: 900 },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    args: [`--remote-debugging-port=${CDP_PORT}`, '--remote-debugging-address=127.0.0.1'],
  };
  const profile = join(STATE_DIR, 'profile');
  let context;
  if (process.env.BROWSER_PATH) context = await chromium.launchPersistentContext(profile, { ...opts, executablePath: process.env.BROWSER_PATH });
  else {
    try { context = await chromium.launchPersistentContext(profile, opts); }
    catch { context = await chromium.launchPersistentContext(profile, { ...opts, channel: 'chrome' }); }
  }
  // delay コマンドで決めた遅延を、応答の前に入れる（コマンドをまたいで効くように、このプロセスで持つ）
  // 返ってきていないリクエストを数えておく（idle と state が読む）
  const inflight = new Map();
  const saveInflight = () => writeFileSync(INFLIGHT, JSON.stringify({ count: inflight.size, urls: [...inflight.values()] }));
  context.on('request', (req) => { inflight.set(req, decodeURIComponent(req.url())); saveInflight(); });
  for (const ev of ['requestfinished', 'requestfailed']) context.on(ev, (req) => { inflight.delete(req); saveInflight(); });
  saveInflight();
  await context.route('**/*', async (route) => {
    const url = decodeURIComponent(route.request().url());
    const rules = existsSync(DELAYS) ? JSON.parse(readFileSync(DELAYS, 'utf8')) : [];
    const ms = Math.max(0, ...rules.filter((r) => url.includes(r.match)).map((r) => r.ms));
    if (ms > 0) await sleep(ms);
    await route.continue().catch(() => {});
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(APP_URL);
  writeFileSync(join(STATE_DIR, 'browser-ready'), String(process.pid));
  await new Promise(() => {});
}

async function connect() {
  const { chromium } = await import('playwright');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`).catch(() => null);
  if (!browser) fail('ブラウザにつながりません。', 'doctor で状態を見て、cleanup → launch でやり直してください。');
  const page = browser.contexts()[0]?.pages()[0];
  if (!page) fail('ブラウザに画面がありません。', 'cleanup → launch でやり直してください。');
  page.setDefaultTimeout(10_000);
  return { browser, page };
}

async function withPage(fn) {
  const s = readState();
  if (!s) fail('このツールが起動したインスタンスがありません。', 'launch を実行してください。');
  const h = await health(s);
  if (!h.ok) fail('今のインスタンスは操作できません。', h.next, { checks: h.checks });
  const { browser, page } = await connect();
  try { return await fn(page); } finally { await browser.close(); }
}

// ---- 画面の状態 ----

async function settle(page) {
  // 画面の文字が 400ms 変わらなくなるまで待つ（最大3秒）。検索欄には 150ms の遅延がある。
  const snap = () => page.evaluate(() => document.querySelector('main')?.textContent ?? '');
  let last = await snap(); let stableSince = Date.now(); const start = Date.now();
  while (Date.now() - start < 3000) {
    await sleep(50);
    const now = await snap();
    if (now !== last) { last = now; stableSince = Date.now(); } else if (Date.now() - stableSince >= 400) return true;
  }
  return false;
}

async function readView(page) {
  return page.evaluate(() => {
    const text = (el) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
    const cardsOf = (sel) => Object.fromEntries([...document.querySelectorAll(`${sel} .card`)].map((c) => [text(c.querySelector('.card-label')), text(c.querySelector('.card-value'))]));
    const rowsOf = (sel) => [...document.querySelectorAll(`${sel} tbody tr`)].map((tr) => [...tr.querySelectorAll('td')].map(text));
    const base = { title: document.title, helpOpen: Boolean(document.querySelector('[role="dialog"]')) };
    if (document.querySelector('[data-testid="unit-setting"]')) {
      const checked = document.querySelector('[data-testid="unit-setting"] input:checked');
      return { page: 'settings', ...base, unit: text(checked?.closest('label')) };
    }
    if (document.querySelector('[data-testid="customer-name"]')) {
      const rows = rowsOf('[data-testid="customer-orders"]');
      const loading = Boolean(document.querySelector('[data-testid="customer-loading"]'));
      return { page: 'customer', ...base, name: text(document.querySelector('[data-testid="customer-name"]')), loading, cards: loading ? null : cardsOf('[data-testid="customer-summary"]'), orders: loading ? null : { rowsShown: rows.length, ids: rows.map((r) => r[0]) } };
    }
    const select = document.querySelector('.filters select');
    const chartTexts = [...document.querySelectorAll('[data-testid="sales-chart"] svg text')].map((t) => t.textContent.trim());
    const months = chartTexts.filter((t) => /^\d+月$/.test(t));
    const values = chartTexts.filter((t) => /万円$/.test(t));
    const rows = rowsOf('[data-testid="orders-table"]');
    return {
      page: 'dashboard', ...base,
      region: select ? select.options[select.selectedIndex]?.text : null,
      search: document.querySelector('input[type="search"]')?.value ?? null,
      matchCount: text(document.querySelector('[data-testid="match-count"]')),
      cards: cardsOf('[data-testid="summary-cards"]'),
      chart: months.map((m, i) => ({ month: m, value: values[i] ?? null })),
      table: { rowsShown: rows.length, first: rows[0] ?? null, last: rows.at(-1) ?? null },
    };
  });
}

// ---- 健康診断 ----

async function health(s) {
  const html = await fetchHtml();
  const checks = {
    appProcessAlive: alive(s.appPid),
    browserProcessAlive: alive(s.browserPid),
    title: html?.match(/<title>([^<]*)<\/title>/)?.[1] ?? null,
    // 起動（または rebuild）した後で、ソースが変わっていないか。変わっていれば、画面は古いソースのもの。
    sourceMatchesBuild: s.sourceRevision === sourceRevision(),
    // 配信している HTML が、ディスクの dist/index.html と同じか。
    servedMatchesDist: html != null && existsSync('dist/index.html') && sha(html) === sha(readFileSync('dist/index.html')),
  };
  let next = null;
  if (!checks.appProcessAlive || !checks.browserProcessAlive || checks.title !== TITLE) next = 'cleanup → launch でやり直してください。';
  else if (!checks.sourceMatchesBuild || !checks.servedMatchesDist) next = 'ソースが変わっています。rebuild を実行してください。';
  return { ok: next == null, checks, next };
}

// ---- コマンド ----

async function launch() {
  if (readState()) fail(`${STATE} が残っています。`, 'cleanup を実行してから launch してください。');
  if (await fetchHtml()) fail(`ポート ${APP_PORT} は、ほかのプロセスが使っています。`, 'DASHBOARD_PORT で別の番号を指定してください。別のインスタンスを操作しないためです。');
  if (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`).then(() => true, () => false)) fail(`ポート ${CDP_PORT} は、ほかのブラウザが使っています。`, 'DASHBOARD_CDP_PORT で別の番号を指定してください。別のブラウザを操作しないためです。');
  const source = sourceRevision();
  build();
  mkdirSync(STATE_DIR, { recursive: true });
  const app = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(APP_PORT), '--strictPort', '--host', '127.0.0.1'], { detached: true, stdio: 'ignore' });
  app.unref();
  for (let i = 0; i < 50 && !(await fetchHtml()); i++) await sleep(200);
  if (!(await fetchHtml())) { try { process.kill(-app.pid); } catch {} fail('10秒待っても、アプリが応答しません。', 'pnpm build が通るかを確かめてください。'); }
  const browser = spawn(process.execPath, [SELF, '__serve-browser'], { detached: true, stdio: 'ignore' });
  browser.unref();
  writeState({ appPid: app.pid, browserPid: browser.pid, appUrl: APP_URL, cdpPort: CDP_PORT, sourceRevision: source, startedAt: new Date().toISOString() });
  for (let i = 0; i < 75 && !existsSync(join(STATE_DIR, 'browser-ready')); i++) await sleep(200);
  if (!existsSync(join(STATE_DIR, 'browser-ready'))) fail('15秒待っても、ブラウザが起動しません。', 'Chrome か Playwright の Chromium を入れるか、BROWSER_PATH で場所を指定してください。その後 cleanup → launch。');
  const view = await withPage(async (page) => { await settle(page); return readView(page); });
  out({ ok: true, url: APP_URL, state: view, next: '--help でコマンドを確かめ、操作して、state と screenshot で確かめます。' });
}

async function doctor() {
  const s = readState();
  if (!s) fail('このツールが起動したインスタンスがありません。', 'launch を実行してください。');
  const h = await health(s);
  out({ ok: h.ok, url: s.appUrl, ...h.checks, ...(h.ok ? {} : { next: h.next }) }, h.ok ? 0 : 1);
}

async function needPage(page, want, cmd) {
  const now = (await readView(page)).page;
  if (now !== want) fail(`${cmd} は ${want} の画面で使います。今は ${now} の画面です。`, `先に open ${want} を実行してください。`);
}

async function open(target) {
  const names = { dashboard: 'ダッシュボード', settings: '設定' };
  if (!names[target]) fail('open の後に dashboard か settings を指定してください。', 'open dashboard');
  out(await withPage(async (page) => {
    await page.getByRole('navigation').getByRole('link', { name: names[target] }).click();
    const settled = await settle(page);
    return { ok: true, action: `メニューの「${names[target]}」を押した`, settled, state: await readView(page) };
  }));
}

async function customer(name) {
  if (!name) fail('顧客名がありません。', 'customer <顧客名> で指定してください。名前は state の table.first などにあります。');
  out(await withPage(async (page) => {
    await needPage(page, 'dashboard', 'customer');
    const link = page.getByTestId('orders-table').getByRole('link', { name, exact: true }).first();
    if ((await link.count()) === 0) {
      const shown = await page.getByTestId('orders-table').getByRole('link').allTextContents();
      fail(`注文一覧に、顧客「${name}」の行が出ていません。`, `今出ている顧客の例：${[...new Set(shown)].slice(0, 5).join('、')}。search で絞ってから指定することもできます。`);
    }
    await link.click();
    const settled = await settle(page);
    return { ok: true, action: `注文一覧で「${name}」を押した`, settled, state: await readView(page) };
  }));
}

async function pager(dir) {
  const label = dir === 'next' ? '次の顧客 →' : '← 前の顧客';
  out(await withPage(async (page) => {
    await needPage(page, 'customer', dir);
    const link = page.getByRole('navigation', { name: '顧客の移動' }).getByRole('link', { name: label });
    if ((await link.count()) === 0) fail(`「${label}」がありません。`, dir === 'next' ? '最後の顧客です。prev を使うか、別の顧客を開いてください。' : '最初の顧客です。next を使うか、別の顧客を開いてください。');
    await link.click();
    const settled = await settle(page);
    return { ok: true, action: `「${label}」を押した`, settled, state: await readView(page) };
  }));
}

function delay(args) {
  mkdirSync(STATE_DIR, { recursive: true });
  const rules = existsSync(DELAYS) ? JSON.parse(readFileSync(DELAYS, 'utf8')) : [];
  if (args[0] === 'list' || args.length === 0) out({ ok: true, delays: rules });
  if (args[0] === 'clear') { writeFileSync(DELAYS, '[]'); out({ ok: true, delays: [] }); }
  const [match, msText] = args; const ms = Number(msText);
  if (!match || !Number.isFinite(ms) || ms < 0) fail('delay の引数が足りません。', 'delay <URL の一部> <ミリ秒> の形で指定してください。例：delay /api/customers/ 2000');
  const nextRules = [...rules.filter((r) => r.match !== match), ...(ms > 0 ? [{ match, ms }] : [])];
  writeFileSync(DELAYS, JSON.stringify(nextRules, null, 2));
  out({ ok: true, delays: nextRules, next: '効くのは、これから送られるリクエストだけです。消すときは delay clear。' });
}

async function unit(label) {
  if (!['円', '万円'].includes(label)) fail('unit の後に 円 か 万円 を指定してください。', 'unit 万円');
  out(await withPage(async (page) => {
    await needPage(page, 'settings', 'unit');
    await page.getByTestId('unit-setting').getByLabel(label, { exact: true }).check();
    const settled = await settle(page);
    return { ok: true, action: `表示単位で「${label}」を選んだ`, settled, state: await readView(page) };
  }));
}

async function region(name) {
  if (!name) fail('地域の名前がありません。', 'region <名前> で指定してください。名前は references/features/region-filter.md にあります。');
  out(await withPage(async (page) => {
    await needPage(page, 'dashboard', 'region');
    const select = page.getByLabel('地域');
    const labels = await select.locator('option').allTextContents();
    if (!labels.includes(name)) fail(`地域「${name}」は選択肢にありません。`, `次のどれかを指定してください：${labels.join('、')}`);
    await select.selectOption({ label: name });
    const settled = await settle(page);
    return { ok: true, action: `地域で「${name}」を選んだ`, settled, state: await readView(page) };
  }));
}

async function search(word) {
  if (word === undefined) fail('検索語がありません。', 'search <語> で指定してください。空に戻すときは search ""。');
  out(await withPage(async (page) => {
    await needPage(page, 'dashboard', 'search');
    await page.getByPlaceholder('顧客名・商品名').fill(word);
    await sleep(200);
    const settled = await settle(page);
    return { ok: true, action: word ? `検索欄に「${word}」と入れた` : '検索欄を空にした', settled, state: await readView(page) };
  }));
}

async function help(mode) {
  if (!['open', 'close'].includes(mode)) fail('help の後に open か close を指定してください。', 'help open');
  out(await withPage(async (page) => {
    const isOpen = (await page.getByRole('dialog').count()) > 0;
    if (mode === 'open') {
      if (!isOpen) await page.getByRole('button', { name: 'ヘルプ' }).click();
      await page.getByRole('dialog').locator('pre code').first().waitFor({ timeout: 5000 });
    } else {
      if (!isOpen) fail('ヘルプは開いていません。', 'state の helpOpen で確かめてください。');
      await page.getByRole('dialog').getByRole('button', { name: '閉じる' }).click();
      await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 3000 });
    }
    return { ok: true, action: `ヘルプを${mode === 'open' ? '開いた' : '閉じた'}`, state: await readView(page) };
  }));
}

async function needPart(page, part) {
  if ((await page.locator(PARTS[part]).count()) > 0) return;
  let next = 'state で今の画面を確かめてください。';
  if (part === 'help') next = '先に help open を実行してください。';
  else if (part === 'customer' && (await page.getByTestId('customer-loading').count()) > 0) next = '顧客の画面は読み込み中です。state の loading が false になってから、もう一度実行してください。読み込み中の画面は --part page で撮れます。';
  fail(`画面に ${part} がありません。`, next);
}

function partArg(args) {
  const i = args.indexOf('--part');
  const part = i >= 0 ? args[i + 1] : 'page';
  if (!PARTS[part]) fail(`--part ${part} はありません。`, `次のどれかを指定してください：${Object.keys(PARTS).join('、')}`);
  return { part, rest: args.filter((_, j) => j !== i && j !== i + 1) };
}

async function screenshot(args) {
  const { part, rest } = partArg(args);
  const file = rest[0] ?? join(EVIDENCE, `${new Date().toISOString().replace(/[:.]/g, '-')}-${part}.png`);
  mkdirSync(dirname(file), { recursive: true });
  out(await withPage(async (page) => {
    const target = page.locator(PARTS[part]).first();
    await needPart(page, part);
    await target.screenshot({ path: file });
    return { ok: true, file, part, state: await readView(page) };
  }));
}

async function snapshot(args) {
  const { part } = partArg(args);
  out(await withPage(async (page) => {
    await needPart(page, part);
    return { ok: true, part, aria: await page.locator(PARTS[part]).first().ariaSnapshot() };
  }));
}

async function reload() {
  out(await withPage(async (page) => { await page.reload(); await page.locator('main').waitFor(); await settle(page); return { ok: true, action: '再読み込みした（保存された設定は残る）', state: await readView(page) }; }));
}

function readInflight() {
  try { return JSON.parse(readFileSync(INFLIGHT, 'utf8')); } catch { return { count: 0, urls: [] }; }
}

async function idle(args) {
  const i = args.indexOf('--timeout');
  const timeout = i >= 0 ? Number(args[i + 1]) : 15000;
  if (!Number.isFinite(timeout) || timeout <= 0) fail('--timeout にはミリ秒を指定してください。', 'idle --timeout 15000');
  out(await withPage(async (page) => {
    const start = Date.now(); let quietSince = null;
    while (Date.now() - start < timeout) {
      if (readInflight().count === 0) { quietSince ??= Date.now(); if (Date.now() - quietSince >= 300) break; } else quietSince = null;
      await sleep(50);
    }
    const pending = readInflight().urls;
    if (pending.length > 0) fail(`${timeout}ms 待っても、返ってこないリクエストがあります。`, 'delay list で、遅らせすぎていないかを確かめてください。待つ時間は --timeout で延ばせます。', { pendingRequests: pending, waitedMs: Date.now() - start });
    const settled = await settle(page);
    return { ok: true, waitedMs: Date.now() - start, settled, state: await readView(page) };
  }));
}

async function reset() {
  out(await withPage(async (page) => {
    await page.evaluate(() => { localStorage.clear(); location.hash = '#/'; });
    await page.reload(); await page.locator('main').waitFor(); await settle(page);
    return { ok: true, action: '保存された設定を消して、最初の画面へ戻した', state: await readView(page) };
  }));
}

async function rebuild() {
  const s = readState();
  if (!s) fail('このツールが起動したインスタンスがありません。', 'launch を実行してください。');
  const source = sourceRevision();
  build();
  writeState({ ...s, sourceRevision: source, rebuiltAt: new Date().toISOString() });
  await reload();
}

function cleanup() {
  const s = readState();
  if (s) for (const pid of [s.browserPid, s.appPid]) { if (alive(pid)) { try { process.kill(-pid, 'SIGTERM'); } catch { try { process.kill(pid, 'SIGTERM'); } catch {} } } }
  // ブラウザが閉じ終わるのを待ってから、状態のフォルダを消す（閉じる途中にプロフィールを書き戻すため）
  const wait = new Int32Array(new SharedArrayBuffer(4));
  for (let i = 0; i < 50 && s && (alive(s.browserPid) || alive(s.appPid)); i++) Atomics.wait(wait, 0, 0, 100);
  Atomics.wait(wait, 0, 0, 300);
  rmSync(STATE_DIR, { recursive: true, force: true });
  out({ ok: true, stopped: s ? { app: s.appPid, browser: s.browserPid } : null, evidenceKept: existsSync(EVIDENCE) ? EVIDENCE : null });
}

const [cmd, ...args] = process.argv.slice(2);
// 操作の途中で Playwright が投げた例外（待ち時間切れなど）も、JSON で返す。
process.on('uncaughtException', (e) => fail(`${cmd} の途中で失敗しました：${String(e?.message ?? e).split('\n')[0]}`, 'state で今の画面を確かめてください。直らなければ cleanup → launch。'));
if (cmd === '__serve-browser') await serveBrowser();
else if (!cmd || cmd === '--help' || cmd === 'help' && args[0] === '--help') out({ usage: 'node skills/verify-dashboard/control-dashboard.mjs <command> [args]', commands: HELP, flow: 'launch → doctor → （open / region / search / customer / next / prev / unit / help / delay）→ state / screenshot → ソースを直したら rebuild → cleanup' });
else if (args.includes('--help')) out(HELP[cmd] ? { command: cmd, help: HELP[cmd] } : { ok: false, reason: `コマンド ${cmd} はありません。`, next: '--help で一覧を見てください。', commands: Object.keys(HELP) }, HELP[cmd] ? 0 : 1);
else if (cmd === 'launch') await launch();
else if (cmd === 'doctor') await doctor();
else if (cmd === 'state') out(await withPage(async (page) => ({ ok: true, pendingRequests: readInflight().urls, state: await readView(page) })));
else if (cmd === 'idle') await idle(args);
else if (cmd === 'open') await open(args[0]);
else if (cmd === 'customer') await customer(args[0]);
else if (cmd === 'unit') await unit(args[0]);
else if (cmd === 'next' || cmd === 'prev') await pager(cmd);
else if (cmd === 'delay') delay(args);
else if (cmd === 'reload') await reload();
else if (cmd === 'region') await region(args[0]);
else if (cmd === 'search') await search(args[0]);
else if (cmd === 'help') await help(args[0]);
else if (cmd === 'screenshot') await screenshot(args);
else if (cmd === 'snapshot') await snapshot(args);
else if (cmd === 'reset') await reset();
else if (cmd === 'rebuild') await rebuild();
else if (cmd === 'cleanup') cleanup();
else fail(`コマンド ${cmd} はありません。`, `--help で一覧を見てください。使えるもの：${Object.keys(HELP).join('、')}`);
