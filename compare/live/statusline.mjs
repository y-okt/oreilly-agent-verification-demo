#!/usr/bin/env node
// ステータスライン。条件の名前・ツール呼び出しの数・費用（定価での見積もり）・経過時間を1行で出す。
// 費用と時間は .claude/live/stats/<session_id>.cost.json に書いておき、live-summary.mjs が読む（回数は hook が別のファイルに書く）。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const label = (() => { try { return readFileSync(join(here, 'label'), 'utf8').trim(); } catch { return '?'; } })();
const sid = input.session_id ?? 'unknown';
let stats = {};
try { stats = JSON.parse(readFileSync(join(here, 'stats', `${sid}.tools.json`), 'utf8')); } catch {}
const cost = input.cost?.total_cost_usd ?? 0;
const ms = input.cost?.total_duration_ms ?? 0;
mkdirSync(join(here, 'stats'), { recursive: true });
writeFileSync(join(here, 'stats', `${sid}.cost.json`), JSON.stringify({ costUsd: cost, durationMs: ms, model: input.model?.display_name ?? null }, null, 2));
const mmss = `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
console.log(`${label} │ ツール ${stats.tools ?? 0}回 │ $${cost.toFixed(2)} │ ${mmss} │ ${input.model?.display_name ?? ''}`);
