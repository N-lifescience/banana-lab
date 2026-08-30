/**
 * **사이트 전체에 대한 검사.** 실험 하나가 아니라 이 저장소 자체를 본다.
 *
 * ── 왜 실험 폴더 밖으로 나왔는가 ────────────────────────────────────
 * 합치기 전에는 「저장소 하나 = 실험 하나」였고, 그래서 실험의 테스트가
 * `dorms-check.config.json` 이나 `package.json` 같은 **사이트 것**을 검사했다.
 *
 * 합치고 나서 그 검사들이 **서로 모순**이 됐다 — banana 는 「이 설정은 banana 를
 * 가리켜야 한다」고 하고 micrometer 는 「micrometer 를 가리켜야 한다」고 한다.
 * **둘 다 옳을 수 없다.** 중복이 아니라 모순이라, 지우거나 합치는 것으로는 안 되고
 * **주인을 하나로** 정해야 했다. 사이트 것이므로 사이트가 갖는다.
 * (합치기 3단계, 2026-08-30 — micrometer 를 들이자마자 드러났다)
 *
 * ── 잃지 말아야 할 것 ──────────────────────────────────────────────
 * 이 검사들이 잡던 사고는 진짜였다. 복제한 저장소 여섯이 `dorms-check.config.json` 을
 * 안 갈아서 **바나나랩의 배포본을 열어 보고 자기 판정을 내놓고 있었다** —
 * 다섯이 한 사이트를 다섯 번 검사한 셈이었다. **못 잡는 것보다 나쁘다:
 * 잡았다고 착각하게 만든다.** 그 값을 그대로 옮겨 온다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const at = (p) => new URL(`../${p}`, import.meta.url);
const read = (p) => readFileSync(at(p), 'utf8');
const titleOf = (html) => html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? '';

/** 이 저장소에 들어 있는 실험들 — 폴더가 곧 목록이다. 손으로 적지 않는다. */
const EXPERIMENTS = readdirSync(at('experiments'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

test('실험이 하나 이상 있다 (앞 조건 — 없으면 아래가 아무것도 안 잰다)', () => {
  assert.ok(EXPERIMENTS.length > 0, 'experiments/ 아래에 실험이 없습니다');
});

test('실험마다 자기 이름을 아는 manifest 가 있다 (id = 폴더 이름)', async () => {
  for (const id of EXPERIMENTS) {
    const { manifest } = await import(at(`experiments/${id}/src/manifest.js`).href);
    assert.equal(manifest.id, id,
      `폴더 이름과 manifest.id 가 어긋납니다 — 폴더 "${id}" · id "${manifest.id}"\n`
      + '  → 주소가 폴더에서 나오므로 어긋나면 그 실험이 안 열립니다.');
  }
});

test('저장소 이름이 사이트 이름이다 (실험 하나의 이름이 아니다)', () => {
  const name = JSON.parse(read('package.json')).name;
  assert.ok(!EXPERIMENTS.includes(name.replace(/-lab$/, '')),
    `package.json 의 이름이 실험 하나를 가리킵니다: "${name}"\n`
    + '  → 이 저장소는 실험 여럿을 담습니다. 사이트 이름을 쓰세요.');
});

/*
 * ── /dorms 점검 설정 ────────────────────────────────────────────────
 * `/dorms` 는 이 설정의 주소를 **열어 보고** 판정한다. 남의 주소면 남의 사이트를
 * 검사한 결과를 이 저장소의 판정으로 내놓는다.
 */
test('점검 설정이 사이트 이름을 쓴다', () => {
  if (!existsSync(at('dorms-check.config.json'))) return;   // 점검 대상이 아니면 잴 것이 없다
  const cfg = JSON.parse(read('dorms-check.config.json'));
  const siteTitle = titleOf(read('index.html'));
  assert.ok(siteTitle, '사이트 첫 화면에 <title> 이 없습니다');
  assert.equal(cfg.app?.name, siteTitle,
    `점검 설정의 이름이 사이트 이름과 다릅니다 — "${cfg.app?.name}" 이 아니라 "${siteTitle}" 이어야 합니다`);
});

test('점검 설정이 남의 배포본을 가리키지 않는다', () => {
  if (!existsSync(at('dorms-check.config.json'))) return;
  const url = JSON.parse(read('dorms-check.config.json')).app?.url;
  /*
   * **아직 배포 안 됐으면 `null` 이 맞다.** 남의 주소를 적어 두느니 비워 둔다 —
   * 비어 있으면 사람이 알고, 남의 주소면 아무도 모른다.
   * (centrifuge 세션이 먼저 이 모양으로 두었고 여덟이 그것을 따랐다)
   */
  if (url === null || url === undefined || url === '') return;
  assert.equal(typeof url, 'string', `주소는 문자열이거나 null 이어야 합니다: ${JSON.stringify(url)}`);
  // 아직 따로 서 있는 실험 저장소들의 배포 주소를 가리키면 안 된다
  const other = EXPERIMENTS.find((id) => url.includes(`${id}-virtual-lab`) || url.includes(`${id}-lab.`));
  assert.ok(!other,
    `점검 설정이 **${other}** 의 따로 선 배포본을 가리킵니다: ${url}\n`
    + '  → /dorms 가 남의 사이트를 열어 보고 이 저장소의 판정을 내놓습니다.');
});

/*
 * ── 개인정보처리방침 ────────────────────────────────────────────────
 * **사이트에 하나뿐인 문서다.** 실험마다 복제하면 고칠 때 여덟 번 고치게 되고,
 * 그중 하나를 빠뜨리면 **학생이 보는 방침과 실제가 달라진다.**
 *
 * 합치기 전에는 이 문서의 제목이 「개인정보처리방침 — 바나나에서 …」였다.
 * 실험이 하나였을 때는 맞는 말이었는데, 합친 뒤로는 **다른 실험을 하는 학생이
 * 남의 실험 이름이 적힌 방침**을 보게 됐다. 사이트 이름을 쓴다.
 * (합치기 3단계, 2026-08-30 — micrometer 를 들이자마자 드러났다)
 */
test('방침 제목이 사이트를 말한다 (실험 하나를 말하지 않는다)', () => {
  const title = titleOf(read('privacy.html'));
  const siteTitle = titleOf(read('index.html'));
  assert.ok(title.includes(siteTitle),
    `방침 제목이 사이트 이름을 안 담습니다:\n  방침  "${title}"\n  사이트 "${siteTitle}"`);
  const named = EXPERIMENTS.find((id) => title.includes(id));
  assert.ok(!named, `방침 제목이 실험 하나(${named})를 가리킵니다: "${title}"`);
});

/*
 * ── 방침이 받는다는 것을 정말 누군가 보내는가 ───────────────────────
 *
 * 실험마다 「방침에 안 적힌 것을 보내지 않는가」를 본다. 그 반대 방향 —
 * **「방침이 받는다는데 아무도 안 보내는가」** — 는 실험이 볼 수 없다.
 *
 * 방침은 **사이트에 하나뿐인 문서**라 실험 여덟이 보내는 것의 **합집합**을 적는다.
 * `slides` 는 banana 만 보내는데, osmosis 의 검사가 「나는 안 보내니 방침에서 지워라」고
 * 말하면 **banana 의 고지를 지우게 된다.** 실험 검사에 두면 실험이 늘 때마다
 * 고지가 깎여 나간다 — 정확히 반대로 움직인다.
 *
 * 그래서 합집합을 아는 자리, 즉 사이트가 갖는다. 여기서 재는 것은 하나다:
 * **적어 둔 항목마다 그것을 실제로 보내는 실험이 하나는 있는가.**
 * 안 받는 것을 받는다고 적은 것도 틀린 고지다 — 현미경을 안 쓰는 실험이
 * 「초점」을 받는다고 적고 있던 적이 있다.
 * (합치기 4단계, 2026-08-30 — `MERGE-AND-DEPLOY.md` §4)
 */
test('방침이 받는다는 것은 적어도 한 실험이 실제로 보낸다', async () => {
  const said = new Set();
  for (const [, list] of read('privacy.html').matchAll(/<dt[^>]+data-sends="([^"]+)"/g)) {
    for (const k of list.split(',')) said.add(k.trim());
  }
  assert.ok(said.size > 0, 'privacy.html 에 data-sends 가 하나도 없습니다');

  /** 꾸러미 밖으로 나가는 표의 칸들. `payloadOf()` 가 만들지 않으므로 따로 안다. */
  const COLUMNS = new Set(['student_no', 'student_name', 'submitted_at']);

  const sent = new Set();
  const skipped = [];
  for (const id of EXPERIMENTS) {
    const report = await import(at(`experiments/${id}/src/ui/report.js`).href);
    if (typeof report.payloadOf !== 'function') { skipped.push(id); continue; }
    const { initialState } = await import(at(`experiments/${id}/src/sim/state.js`).href);
    const p = report.payloadOf(initialState(1, 1), { school: '', team: '' }, 'individual');
    for (const k of Object.keys(p)) if (k !== 'state') sent.add(k);
    for (const [k, v] of Object.entries(p.state)) {
      if (k !== 'session') { sent.add(k); continue; }
      for (const sub of Object.keys(v)) sent.add(`session.${sub}`);
    }
  }
  /*
   * **앞 조건.** `payloadOf` 를 안 내보내는 실험이 생기면 그 실험이 보내는 것이
   * 합집합에서 빠지고, 그러면 아래가 **「아무도 안 보낸다」로 오판**한다.
   * 조용히 건너뛰지 않고 여기서 말한다.
   */
  assert.deepEqual(skipped, [],
    `payloadOf 를 내보내지 않는 실험이 있습니다: ${skipped.join(', ')}\n`
    + '  → 그 실험이 보내는 것이 합집합에서 빠져 아래 판정이 틀립니다.\n'
    + '    src/ui/report.js 에서 payloadOf 를 export 하세요.');
  assert.ok(sent.size > 0, '어느 실험도 꾸러미를 만들지 않았습니다 — 검사가 헛돌고 있습니다');

  const phantom = [...said].filter((k) => !sent.has(k) && !COLUMNS.has(k));
  assert.deepEqual(phantom, [],
    `방침이 받는다는데 어느 실험도 안 보냅니다: ${phantom.join(', ')}\n`
    + '  → 안 받는 것을 받는다고 적은 것도 틀린 고지입니다. privacy.html 에서 그 줄을 지우거나,\n'
    + '    정말 보내야 하는 값이면 그 실험의 SUBMIT_* 목록에 넣으세요.');
});

/*
 * ── 실험마다 「내가 사는 자리」를 맞게 가리키는가 ────────────────────
 *
 * 실험 검사에는 「**다른** 실험의 배포 주소를 가리키지 않는다」가 있다. 그런데
 * 그 검사는 **자기 id 를 목록에서 뺀다** — 자기 주소를 가리키는 것은 옳으니까.
 * 그래서 osmosis 가 따로 서 있던 시절의 주소(`osmosis-virtual-lab.vercel.app`)를
 * 그대로 달고 있어도 **자기 이름이 들었다는 이유로 통과**했다. 합친 뒤로 그 주소는
 * 남의 배포본인데도 그렇다.
 *
 * micrometer 는 반대쪽이었다 — canonical 이 아예 **없었다.** 「배포 주소가 정해지면
 * 넣는다」고 적어 두고 정해진 뒤에도 아무도 안 왔다. **비워 둔 자리는 아무 검사도
 * 울지 않는다.**
 *
 * 둘 다 실험 하나만 보고는 알 수 없다. **어느 사이트에 사는가**는 사이트가 안다.
 * (합치기 4단계, 2026-08-30 — `MERGE-AND-DEPLOY.md` §4)
 */
test('실험마다 canonical 이 이 사이트의 자기 자리를 가리킨다', () => {
  // 기준은 손으로 적지 않는다 — 이미 맞게 적힌 것 하나에서 사이트 주소를 뽑아 온다.
  const hosts = new Set();
  const seen = [];
  for (const id of EXPERIMENTS) {
    const html = read(`experiments/${id}/index.html`);
    const canon = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    const og = html.match(/<meta property="og:url" content="([^"]+)"/)?.[1];
    assert.ok(canon, `experiments/${id}/index.html 에 canonical 이 없습니다\n`
      + '  → 비워 두면 검색과 링크 미리보기가 무엇을 이 실험으로 여길지 알 수 없습니다.');
    assert.equal(og, canon, `${id}: canonical 과 og:url 이 다릅니다\n  ${canon}\n  ${og}`);
    hosts.add(new URL(canon).host);
    seen.push([id, canon]);
  }
  assert.equal(hosts.size, 1,
    `실험들이 서로 다른 사이트를 가리킵니다: ${[...hosts].join(' · ')}\n`
    + seen.map(([id, u]) => `  ${id}  ${u}`).join('\n') + '\n'
    + '  → 따로 서 있던 시절의 주소가 남은 것입니다. 합친 사이트의 자기 자리를 가리키세요.');

  // 주소의 **마지막 조각**이 그 실험의 폴더 이름이어야 한다 — 서로 바뀐 것을 잡는다.
  const wrong = seen.filter(([id, u]) => new URL(u).pathname.split('/').filter(Boolean).at(-1) !== id);
  assert.deepEqual(wrong.map(([id]) => id), [],
    `자기 자리가 아닌 곳을 가리키는 실험이 있습니다:\n`
    + wrong.map(([id, u]) => `  ${id}  ${u}`).join('\n'));
});

/*
 * ── 선생님 화면은 사이트에 하나뿐이다 ────────────────────────────────
 *
 * `teacher.js` 는 **저장소 여덟에서 바이트까지 같았다.** 실험마다 복제하면 고칠 때
 * 여덟 번 고치게 되고, 그중 하나를 빠뜨리면 그 실험의 선생님만 옛 화면을 본다.
 * 4단계에서 `packages/lab-kit/teacher.js` 로 올렸고, 페이지도 뿌리로 왔다.
 *
 * 그래서 실험 검사가 보던 것들(제목이 남의 실험을 말하는가 …)의 주인이 여기가 됐다.
 * (합치기 4단계, 2026-08-30 — `MERGE-AND-DEPLOY.md` §4)
 */
test('선생님 화면이 실험 하나의 이름을 달고 있지 않다', () => {
  const html = read('teacher.html');
  const title = titleOf(html);
  const siteTitle = titleOf(read('index.html'));
  assert.ok(title.includes(siteTitle),
    `선생님 화면의 제목이 사이트 이름을 안 담습니다:\n  화면  "${title}"\n  사이트 "${siteTitle}"`);
  /*
   * 실험 **이름**으로 본다. id 로만 보면 「바나나에서 …」 같은 한글 제목을 못 잡는다 —
   * 3단계에서 방침 제목이 정확히 그 모양으로 남아 있었다.
   */
  for (const id of EXPERIMENTS) {
    assert.ok(!title.includes(id), `선생님 화면의 제목이 실험 하나(${id})를 가리킵니다: "${title}"`);
  }
  assert.match(html, /<script type="module" src="\/src\/teacher\.js"><\/script>/,
    'teacher.html 이 뿌리의 진입점(/src/teacher.js)을 안 부릅니다');
});

/*
 * ★ **교사가 나눠 주는 두 링크가 맞는가.** 이 자리는 합치면서 **둘 다 조용히 깨졌다** —
 *   학생용은 `/?exp=…&code=…` 였는데 뿌리가 카탈로그가 되면서 아무도 그 값을 안 읽고,
 *   관리용은 `/teacher.html` 이었는데 그 파일이 실험 폴더 안에 있어 404 였다.
 *   **교사는 그 링크를 학습지에 인쇄해 나눠 준다. 틀린 채로 나가면 되돌릴 수 없다.**
 *   제출 기능이 아직 꺼져 있어(설정 없음) 아무도 못 밟았을 뿐이다.
 */
test('교사가 나눠 주는 두 링크가 이 사이트의 실제 주소를 가리킨다', () => {
  const src = read('src/teacher.js');
  const base = src.match(/const EXP_BASE = '([^']+)'/)?.[1];
  assert.ok(base, 'src/teacher.js 에 EXP_BASE 가 없습니다');

  // ① 실험 주소의 앞자리가 되쓰기 규칙과 같은가 — 다르면 학생 링크가 404 다
  const rewrites = JSON.parse(read('vercel.json')).rewrites ?? [];
  const sources = rewrites.map((r) => r.source);
  assert.ok(sources.includes(`${base}/:exp`),
    `EXP_BASE("${base}")를 받아 주는 되쓰기가 vercel.json 에 없습니다.\n`
    + `  있는 것: ${sources.join(' · ') || '(없음)'}\n`
    + '  → 학생이 여는 링크가 404 가 됩니다. 로컬에서는 이 자리가 아무 말도 하지 않습니다.');

  // ② 카탈로그가 학생에게 보이는 주소와 같은가 — 두 곳이 갈라지면 하나는 죽는다
  const catalog = [...read('index.html').matchAll(/href="(\/[a-z-]+)\/([a-z-]+)"/g)];
  const linked = catalog.filter(([, , id]) => EXPERIMENTS.includes(id));
  assert.ok(linked.length > 0, '카탈로그에서 실험 링크를 하나도 못 찾았습니다 — 검사가 헛돌고 있습니다');
  const odd = [...new Set(linked.map(([, b]) => b))].filter((b) => b !== base);
  assert.deepEqual(odd, [],
    `카탈로그가 EXP_BASE 와 다른 앞자리를 씁니다: ${odd.join(' · ')} (EXP_BASE 는 "${base}")`);

  // ③ 관리 링크가 `exp` 를 싣는가 — 없으면 링크를 다시 열었을 때 어느 실험인지 모른다
  const admin = src.slice(src.indexOf('admin: (token)'));
  assert.ok(/exp=\$\{encodeURIComponent\(manifest\.id\)\}/.test(admin),
    '관리 링크가 exp 를 안 싣습니다.\n'
    + '  → 선생님이 그 링크를 다시 열면 어느 실험의 종이로 그려야 할지 알 수 없습니다.\n'
    + '    잃어버리면 되찾을 길이 없는 링크라, 틀린 채로 나가면 그 반이 통째로 막힙니다.');

  // ④ `.html` 을 붙이지 않았는가 — cleanUrls 가 308 로 되돌린다
  assert.ok(!/\/teacher\.html/.test(src),
    'src/teacher.js 가 /teacher.html 을 가리킵니다 — cleanUrls 가 308 로 되돌립니다');
});

test('선생님 화면이 아는 실험 목록이 실제 폴더와 같다', () => {
  const listed = read('src/teacher.js')
    .match(/const EXPERIMENTS = \[([^\]]*)\]/)?.[1]
    ?.match(/'([^']+)'/g)?.map((s) => s.slice(1, -1)) ?? [];
  assert.deepEqual([...listed].sort(), [...EXPERIMENTS].sort(),
    `선생님 화면의 실험 목록이 폴더와 어긋납니다:\n`
    + `  목록  ${listed.join(' · ') || '(비었음)'}\n  폴더  ${EXPERIMENTS.join(' · ')}\n`
    + '  → 빠진 실험은 수업을 열 수 없고, 없는 실험은 고르면 빈 화면이 뜹니다.');
});

/*
 * **실험을 늘리고 여기를 안 늘리면 그 실험은 배포본에 아예 안 실린다.**
 * 로컬 개발 서버에서는 멀쩡히 열리므로 **배포한 뒤에야** 안다.
 */
test('실험마다 빌드 진입점이 있다', () => {
  const cfg = read('vite.config.js');
  const missing = EXPERIMENTS.filter((id) => !cfg.includes(`experiments/${id}/index.html`));
  assert.deepEqual(missing, [],
    `vite.config.js 의 input 에 없는 실험이 있습니다: ${missing.join(', ')}\n`
    + '  → 그 실험은 배포본에 안 실립니다. 개발 서버에서는 멀쩡히 열려서 배포 뒤에야 압니다.');
});

/*
 * ── 기구 색은 공용이다. 실험이 늘리지 않는다 ────────────────────────
 *
 * `MERGE-AND-DEPLOY.md` §3.1: 기구 색(`glass`·`metal`·`paper`·`bodyDark`·`rubber`·`bench`)과
 * 선 두께·광원은 **공용**이고, 시약색·반응색만 그 실험의 `palette.experiment.js` 로 간다.
 * 규칙은 「이 파일이 실험 여덟에서 diff 0 이어야 한다」였는데 **사람이 지키는 규칙**이었다.
 *
 * 4단계에서 값을 `packages/lab-kit/style/tokens.js` 하나로 모으고, 실험의 자리에는
 * **다시-내보내기 한 줄만** 남겼다 — 애셋 예순 곳과 복제 절차가 그 자리를 알기 때문이다.
 * 한 줄뿐인지를 여기서 지킨다. 줄이 늘면 그 순간 사본이 되고, 사본은 갈라진다.
 * (합치기 4단계, 2026-08-30)
 */
test('실험의 tokens.js 는 공용을 다시 내보내기만 한다', () => {
  const RE_EXPORT = /^export \* from '(\.\.\/)+packages\/lab-kit\/style\/tokens\.js';$/;
  for (const id of EXPERIMENTS) {
    const lines = read(`experiments/${id}/src/style/tokens.js`)
      .replace(/\/\*[\s\S]*?\*\//g, '')      // 주석은 얼마든지 적어도 된다
      .split('\n').map((l) => l.trim()).filter(Boolean);
    assert.deepEqual(lines.filter((l) => !RE_EXPORT.test(l)), [],
      `experiments/${id}/src/style/tokens.js 에 다시-내보내기 말고 다른 줄이 있습니다:\n`
      + lines.map((l) => `    ${l}`).join('\n') + '\n'
      + '  → 이 실험만의 색은 palette.experiment.js 로 가세요.\n'
      + '    여기에 넣으면 여덟 실험 전부의 허용 색이 됩니다.');
    assert.equal(lines.length, 1, `${id}: 다시-내보내기가 한 줄이 아닙니다 (${lines.length}줄)`);
  }
});

/*
 * ── 카탈로그가 **없는 실험**으로 데려가지 않는가 ─────────────────────
 *
 * 첫 화면은 교과서 탐구활동 열일곱을 다 보여 줍니다. 그중 가상 실험 여덟은 **다 만들어졌지만**,
 * 이 사이트로 옮긴 것은 아직 일부입니다. 그런데 카드 여덟 장이 전부 「지금 열기 →」로
 * 남아 있었습니다 — **학생이 다섯 장을 누르면 404 를 봤습니다.**
 *
 * 로컬에서는 아무도 못 봅니다. 개발 서버는 되쓰기(`/cell-metabolism/…`)를 안 읽어서
 * 그 주소가 어차피 안 열리고, 배포본에서만 「어떤 것은 열리고 어떤 것은 404」로 갈립니다.
 * **파일끼리 맞대면 지금 여기서 압니다.**
 *
 * 옮긴 실험 = `experiments/` 의 폴더. 그 밖으로 가는 링크는 카드에 있으면 안 됩니다.
 * (합치기 4단계, 2026-08-30)
 */
test('카탈로그가 이 사이트에 없는 실험으로 데려가지 않는다', () => {
  const html = read('index.html');
  const links = [...html.matchAll(/<a[^>]+class="card[^"]*"[^>]+href="\/[a-z-]+\/([a-z-]+)"/g)]
    .map((m) => m[1]);
  // 앞 조건 — 하나도 못 읽으면 아래가 **아무것도 안 재고 통과**한다.
  assert.ok(links.length > 0, '카탈로그에서 실험 링크를 하나도 못 찾았습니다 — 검사가 헛돌고 있습니다');

  const dead = [...new Set(links)].filter((id) => !EXPERIMENTS.includes(id));
  assert.deepEqual(dead, [],
    `카탈로그가 이 저장소에 없는 실험으로 데려갑니다: ${dead.join(', ')}\n`
    + `  있는 것: ${EXPERIMENTS.join(' · ')}\n`
    + '  → 배포하면 학생이 그 카드를 눌렀을 때 **404** 를 봅니다.\n'
    + '    아직 안 옮겼으면 `<span class="card soon">` 에 「준비 중」 배지를 다세요 (링크를 주지 마세요).');
});

test('아직 안 옮긴 실험은 「준비 중」으로 보인다', () => {
  const html = read('index.html');
  const soon = (html.match(/<span class="badge soon">/g) ?? []).length;
  const cards = (html.match(/<span class="card soon">/g) ?? []).length;
  assert.equal(soon, cards,
    `「준비 중」 카드 ${cards}장 중 배지가 달린 것은 ${soon}장입니다 — 배지가 없으면 왜 안 열리는지 알 수 없습니다`);

  /*
   * **범례는 화면에 있는 것만 설명한다.** 없는 상태를 설명하면 학생이 그것을 찾고,
   * 있는 상태를 안 설명하면 왜 어떤 카드는 안 눌리는지 모른다. 둘 다 잡는다.
   */
  const hasLegend = /<span class="swatch soon">/.test(html);
  assert.equal(hasLegend, cards > 0,
    cards > 0
      ? '「준비 중」 카드가 있는데 범례에 그 칸이 없습니다 — 왜 안 눌리는지 학생이 알 수 없습니다'
      : '「준비 중」 카드가 하나도 없는데 범례가 그 상태를 설명합니다 — 학생이 없는 것을 찾습니다');
});

/*
 * ── 방침은 실험 하나의 말씨를 쓰지 않는다 ────────────────────────────
 *
 * catalase 의 검사가 「방침에 **이 실험에 없는** 기구가 적혀 있지 않다」로 이것을 잡았다.
 * 잡던 것은 진짜였다 — 현미경이 없는 실험이 「배율·초점을 받는다」고 고지하고 있었다.
 *
 * 그런데 그 모양은 실험이 둘 이상이면 **반드시 서로 모순**이 된다. banana·micrometer 에는
 * 「배율」이 정말로 있으므로, catalase 의 요구를 들어 주면 **그 둘의 고지를 지우게 된다.**
 * 실험이 늘 때마다 방침이 깎여 나간다.
 *
 * 주인을 사이트로 옮기면 규칙이 하나가 된다:
 * **공용 문서는 어느 실험의 기구도 이름으로 대지 않는다.** 무엇을 받는지는 산문이 아니라
 * `data-sends` 가 말하고, 그건 바로 위 두 검사가 양방향으로 잰다.
 *
 * 실제로 셋이 남아 있었다 — 학생이 눈으로 읽는 **부제**가 「바나나에서 탄수화물과 지질
 * 관찰하기」였고(3단계에서 `<title>` 만 고쳤다), 제1조가 「슬라이드 상태」를 예로 들었고,
 * 수집 항목이 「시약·배율·두께·방울 수」였다.
 * (합치기 5단계, 2026-08-30)
 */
test('방침이 실험 하나의 말씨를 쓰지 않는다', () => {
  /** 어느 실험엔 있고 어느 실험엔 없는 말. 공용 문서에서는 **전부** 하면 안 된다. */
  const APPARATUS = [
    '바나나', '녹말', '지질', '현미경', '배율', '초점', '슬라이드', '덮개 유리',
    '적양파', '원형질', '카탈레이스', '과산화수소', '감자즙',
    '크로마토그래피', '엽록소', '잔토필', '효모', '발효', '맹관부',
    '원심분리', '적혈구', '버피코트', '마이크로미터', '눈금자',
  ];
  const html = read('privacy.html').replace(/<!--[\s\S]*?-->/g, '');
  const found = APPARATUS.filter((w) => html.includes(w));
  assert.deepEqual(found, [],
    `개인정보처리방침이 실험 하나의 기구를 이름으로 댑니다: ${found.map((w) => `「${w}」`).join(' · ')}\n`
    + '  → 방침은 사이트에 하나뿐입니다. 그 실험을 안 하는 학생에게는 **틀린 고지**입니다.\n'
    + '    무엇을 받는지는 산문이 아니라 <dt data-sends="…"> 가 말하게 하세요.');
});

test('방침에 있어야 할 대목이 다 있다 — 파기까지', () => {
  /*
   * `/Volumes/T7/Projects/CLAUDE.md` 의 dorms 요건이다. **하나라도 빠지면 미충족**이라
   * 사람이 세면 반드시 틀린다. fermentation 이 들고 있던 것을 사이트로 옮겼다 —
   * 방침은 사이트에 하나뿐이라 실험마다 재면 여덟 벌 중복이 된다.
   * (합치기 5단계, 2026-08-30)
   *
   * ★ 띄어쓰기를 강요하지 않는다. 방침의 표제는 「파기절차」이고 검사는 「파기 절차」를
   *   찾고 있었다 — **요건은 갖췄는데 검사만 우는** 자리였다. 그런 검사는 곧 꺼진다.
   */
  const text = read('privacy.html').replace(/<[^>]+>/g, ' ');

  const REQUIRED = [
    ['수집 항목', /처리하는 개인정보 항목|수집(하는)? ?항목/],
    ['처리 목적', /처리 목적/],
    ['보유 기간', /보유 기간/],
    ['파기', /개인정보의 파기/],
    ['파기 절차·방법·시점', /파기\s*절차/, /파기\s*방법/, /파기\s*시점/],
    ['안전성 확보 조치', /안전성 확보 조치/],
    ['권리 — 열람', /열람/],
    ['권리 — 정정', /정정/],
    ['권리 — 삭제', /삭제/],
    ['권리 — 처리정지', /처리정지|처리 정지/],
    ['제3자 제공', /제3자/],
    ['처리 위탁', /위탁/],
    ['분쟁조정 연락처', /개인정보분쟁조정위원회/, /개인정보침해신고센터/],
  ];
  // [앞 조건] 방침을 못 읽으면 「0개 빠졌다」로 통과한다.
  assert.ok(text.length > 2000, `방침이 ${text.length}자뿐입니다 — 못 읽었는지 보세요`);
  const missing = REQUIRED
    .filter(([, ...pats]) => !pats.every((re) => re.test(text)))
    .map(([label]) => label);
  assert.deepEqual(missing, [],
    `방침에 빠진 대목이 있습니다: ${missing.join(' · ')}\n`
    + '  → 내용을 다른 조에서 말하고 있어도, 요구되는 표제가 없으면 갖춘 것이 아닙니다.');
});
