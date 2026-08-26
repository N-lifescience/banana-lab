/**
 * LAUNCH.md 의 실험별 프롬프트 블록을 `prompts/<id>.txt` 로 뽑는다.
 *
 * 왜 파일로 빼는가: 블록 안에 ```bash 펜스가 중첩돼 있어서, 마크다운에서 눈으로 긁으면
 * **어디까지가 한 블록인지 헷갈린다.** 절반만 붙여 넣은 세션은 출발 절차를 건너뛰고,
 * 그러면 작성자 이메일이 안 잡혀 Vercel 이 배포를 막는다 — 로컬에서는 아무 이상이 없어
 * 아무도 모른다 (PROGRESS T27).
 *
 * LAUNCH.md 를 고쳤으면 이걸 다시 돌린다. 안 돌리면 파일이 조용히 옛말을 하게 된다.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FOLDER = {
  micrometer: 'micrometer-lab', osmosis: 'osmosis-lab', catalase: 'catalase-lab',
  chromatography: 'chromatography-lab', fermentation: 'fermentation-lab',
  centrifuge: 'centrifuge-lab', germination: 'germination-lab',
};
/** 이미 만들어 둔 폴더. 세션이 clone 을 다시 돌리지 않게 알려 준다. */
const READY = new Set(['osmosis', 'catalase', 'chromatography']);
/** 이미 끝난 것. 파일을 뽑지 않는다 — 끝난 실험의 프롬프트가 섞여 있으면 헷갈린다. */
const DONE = new Set(['micrometer']);

const src = readFileSync('LAUNCH.md', 'utf8');
const heads = [...src.matchAll(/^### 웨이브 [^\n`]*`([a-z]+)`/gm)];
if (heads.length !== 7) {
  console.error(`블록이 7개가 아니라 ${heads.length}개입니다. LAUNCH.md 의 제목 형식이 바뀌었습니까?`);
  process.exit(1);
}

mkdirSync('prompts', { recursive: true });
const made = [];
for (const [i, h] of heads.entries()) {
  const id = h[1];
  if (DONE.has(id)) continue;
  const end = i + 1 < heads.length ? heads[i + 1].index : src.length;
  const seg = src.slice(h.index + h[0].length, end);
  const fences = [...seg.matchAll(/^```/gm)].map((m) => m.index);
  if (fences.length < 2) { console.error(`${id}: 펜스를 못 찾았습니다`); process.exit(1); }
  const body = seg.slice(seg.indexOf('\n', fences[0]) + 1, fences.at(-1)).trimEnd();
  // 절반만 뽑히면 조용히 통과하는 것이 가장 위험하다. 두 절이 다 있어야 한다.
  for (const need of ['## 출발', '## 지켜야 할 것', '## 이 실험의 내용']) {
    if (!body.includes(need)) { console.error(`${id}: 「${need}」 절이 없습니다`); process.exit(1); }
  }
  const folder = FOLDER[id];
  const head = READY.has(id)
    ? `작업 폴더: /Volumes/T7/Projects/${folder}\n\n`
      + '이 폴더는 **이미 만들어져 있다.** 복제 · git 작성자 설정 · 포트 배정 ·\n'
      + '바나나 허브 문서 정리 · npm install 까지 끝났고 `npm run check` 가 초록불이다.\n'
      + '먼저 그 폴더로 옮겨 가 `git log -1` 을 읽어라 — 「복제 직후」 커밋 메시지에\n'
      + '**아직 바나나인 채로 남아 있는 것**이 적혀 있다.\n\n'
      + '아래 「출발」 절의 clone · git init · npm install 은 **다시 하지 마라. 이미 됐다.**\n'
      + '거기 ★ 로 표시된 것 중 **바나나 이름표 갈아 끼우기와 하네스는 아직 남아 있다.**\n'
      + '그것부터 하고 시작하라.\n\n'
    : `작업 폴더: /Volumes/T7/Projects/${folder}\n\n`
      + '이 폴더는 **아직 없다.** 아래 「출발」 절을 그대로 실행해 만들어라.\n'
      + '만들 자리는 /Volumes/T7/Projects 다.\n\n';
  const path = join('prompts', `${id}.txt`);
  writeFileSync(path, `${head}${'─'.repeat(70)}\n\n${body}\n`);
  made.push([path, body.split('\n').length]);
}
for (const [p, n] of made) console.log(`  ${p}  ${n}줄`);
console.log(`\n프롬프트 ${made.length}개를 뽑았습니다.`);
