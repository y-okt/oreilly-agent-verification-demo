#!/usr/bin/env node
// Feature Map と操作用の CLI が、今のコードと合っているかを確かめる。CI でも手元でも、リポジトリの直下で実行する。
//   node scripts/check-feature-map.mjs   （pnpm check:feature-map）
// 確かめること：
//   1. Feature Map の README の表と、機能ファイルが1対1で対応している
//   2. 機能ファイルに、決まった4つの H2 が決まった順にある
//   3. Feature Map と SKILL.md に書いた `node $C <コマンド>` が、CLI にあるコマンドである
//   4. CLI が画面を探すときの目印（data-testid・ラベル・ボタンの名前）が、src/ にある
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKILL = 'skills/verify-dashboard';
const FEATURES = join(SKILL, 'references/features');
const CLI = join(SKILL, 'control-dashboard.mjs');
const H2 = ['Sub-features', 'How to get to it (user POV)', 'Driving it with control-dashboard', 'Gotchas'];

const problems = [];
const read = (path) => readFileSync(path, 'utf8');
const walk = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));

// 1. 索引と機能ファイル
const index = read(join(FEATURES, 'README.md'));
const linked = new Set([...index.matchAll(/\]\(([\w-]+\.md)\)/g)].map((m) => m[1]));
const files = readdirSync(FEATURES).filter((f) => f.endsWith('.md') && f !== 'README.md');
for (const f of files) if (!linked.has(f)) problems.push(`${FEATURES}/README.md の表に ${f} がありません。`);
for (const f of linked) if (!files.includes(f)) problems.push(`${FEATURES}/README.md が、存在しない ${f} を指しています。`);

// 2. 機能ファイルの形
for (const f of files) {
  const text = read(join(FEATURES, f));
  if (!/^# .+/m.test(text)) problems.push(`${f}：H1 がありません。`);
  const found = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  if (found.join('|') !== H2.join('|')) problems.push(`${f}：H2 は「${H2.join('」「')}」の順にしてください（今は「${found.join('」「')}」）。`);
}

// 3. 文書に書いたコマンドが CLI にあるか
const commands = Object.keys(JSON.parse(execFileSync(process.execPath, [CLI, '--help'], { encoding: 'utf8' })).commands);
for (const path of [join(SKILL, 'SKILL.md'), ...files.map((f) => join(FEATURES, f))]) {
  for (const m of read(path).matchAll(/node \$C ([a-z-]+)/g)) {
    if (!m[1].startsWith('-') && !commands.includes(m[1])) problems.push(`${path}：CLI に無いコマンド「${m[1]}」が書かれています。`);
  }
}

// 4. CLI が使う目印が src/ にあるか
const src = walk('src').filter((p) => /\.(tsx?|md)$/.test(p)).map(read).join('\n');
const cli = read(CLI);
const testIds = new Set([...cli.matchAll(/data-testid="([\w-]+)"/g), ...cli.matchAll(/getByTestId\('([\w-]+)'\)/g)].map((m) => m[1]));
for (const id of testIds) if (!src.includes(`data-testid="${id}"`)) problems.push(`CLI が使う data-testid「${id}」が src/ にありません。`);
const labels = new Set([
  ...[...cli.matchAll(/getBy(?:Label|Placeholder)\('([^']+)'/g)].map((m) => m[1]),
  ...[...cli.matchAll(/name: '([^']+)'/g)].map((m) => m[1]),
  ...[...cli.matchAll(/'([^'。]{1,10})'/g)].map((m) => m[1]).filter((t) => /[→←]/.test(t) && !/launch|cleanup/.test(t)),  // 「次の顧客 →」など、押すリンクの名前
]);
for (const label of labels) if (!src.includes(label)) problems.push(`CLI が探す文字「${label}」が src/ にありません。`);

if (problems.length > 0) {
  console.log(JSON.stringify({ ok: false, problems, next: 'Feature Map・SKILL.md・CLI を今のコードに合わせて直し、もう一度実行してください。' }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, features: files.length, commandsChecked: commands.length, testIds: [...testIds], labels: [...labels] }, null, 2));
