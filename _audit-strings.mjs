/** 임시 — strings.js 미사용 키 / 코드에서 참조하는데 없는 키 찾기. 끝나면 지운다. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { UI } from './src/ui/strings.js';

const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== 'node_modules' && f[0] !== '.') walk(p); }
    else if (/\.(js|mjs|html)$/.test(f) && !p.includes('strings.js') && !p.includes('_audit')) files.push(p);
  }
})('.');

const src = files.map((f) => `/*${f}*/` + readFileSync(f, 'utf8')).join('\n');

/** UI 객체를 평탄화: 경로 -> 값 */
const leaves = [];
(function flat(o, path) {
  for (const [k, v] of Object.entries(o)) {
    const p = [...path, k];
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof v !== 'function') flat(v, p);
    else leaves.push({ path: p, value: v });
  }
})(UI, []);

// 마지막 두 조각 중 하나라도 코드에 등장하면 "쓰인다"로 본다 (동적 접근 UI.x[k] 대응)
const unused = [];
for (const { path } of leaves) {
  const last = path[path.length - 1];
  const parent = path[path.length - 2];
  const direct = new RegExp(`[.\\['"\`]${last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`\\]]?`).test(src)
    && new RegExp(`(\\.${escapeRe(last)}\\b)|(\\[['"\`]${escapeRe(last)}['"\`]\\])`).test(src);
  // 부모가 동적 인덱싱되면(UI.reagents[x]) 자식 키는 코드에 안 나온다 — 부모 사용 여부로 본다
  const parentDynamic = parent && new RegExp(`${escapeRe(parent)}\\s*\\[`).test(src);
  if (!direct && !parentDynamic) unused.push(path.join('.'));
}
function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

console.log('=== strings.js 에 있으나 코드에서 못 찾은 키 ===');
console.log(unused.join('\n') || '(없음)');

// 코드가 UI.a.b 로 참조하는데 실제로 없는 것
const refs = new Set();
for (const m of src.matchAll(/\bUI\.([A-Za-z0-9_.]+)/g)) refs.add(m[1]);
for (const m of src.matchAll(/\bN\.([A-Za-z0-9_.]+)/g)) refs.add('notebook.' + m[1]);
for (const m of src.matchAll(/\bS\.([A-Za-z0-9_.]+)/g)) refs.add('start.' + m[1]);
const missing = [];
for (const r of refs) {
  let cur = UI;
  for (const part of r.split('.')) {
    if (cur == null || !(part in cur)) { missing.push(r); break; }
    cur = cur[part];
  }
}
console.log('\n=== 코드가 참조하는데 strings.js 에 없는 경로 ===');
console.log(missing.join('\n') || '(없음)');

// 중복 키 (원문 파싱)
const raw = readFileSync('./src/ui/strings.js', 'utf8');
const keyLines = [...raw.matchAll(/^(\s*)'?([A-Za-z0-9_-]+)'?\s*:/gm)];
const seen = new Map();
for (const m of keyLines) {
  const k = `${m[1].length}:${m[2]}`;
  const line = raw.slice(0, m.index).split('\n').length;
  if (!seen.has(k)) seen.set(k, []);
  seen.get(k).push(line);
}
console.log('\n=== 같은 들여쓰기에서 두 번 나오는 키 (중복 정의 의심) ===');
for (const [k, lines] of seen) if (lines.length > 1) console.log(`${k.split(':')[1]}  줄 ${lines.join(', ')}`);
