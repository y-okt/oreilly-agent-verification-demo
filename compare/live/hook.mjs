#!/usr/bin/env node
// PreToolUse の hook。ツールを呼ぶたびに、セッションごとの回数を .claude/live/stats/<session_id>.tools.json に足す。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const dir = join(dirname(fileURLToPath(import.meta.url)), 'stats');
mkdirSync(dir, { recursive: true });
const file = join(dir, `${input.session_id ?? 'unknown'}.tools.json`);
let stats = {};
try { stats = JSON.parse(readFileSync(file, 'utf8')); } catch {}
stats.tools = (stats.tools ?? 0) + 1;
stats.byTool = stats.byTool ?? {};
stats.byTool[input.tool_name ?? '?'] = (stats.byTool[input.tool_name ?? '?'] ?? 0) + 1;
stats.startedAt ??= new Date().toISOString();
writeFileSync(file, JSON.stringify(stats, null, 2));
