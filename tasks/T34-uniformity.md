# T34 · 통일 — 여덟 실험을 한 앱처럼 (실험별 작업 카드)

> 사장님 지시 (2026-09-03): 「실험간, 실험기기간 통일성이 중요해. 지금 보면 통일성이 떨어진달까.
> 불쾌감도 높고. 너가 직접 플레이하면서 통일성을 확보해. 모든 실험 다.」
>
> 규격은 **`docs/09-uniformity.md`** 다. 이 카드는 그 규격을 실험 하나에 적용하는 **차례**와,
> 조사에서 나온 **그 실험의 어긋난 자리**다. 참조 구현은 **banana** — 먼저 그 코드를 읽는다:
> `experiments/banana/src/ui/zoom.js` (틀·물건 화면·현미경), `experiments/banana/src/ui/bench.js` 의
> `tapTable`, `experiments/banana/src/ui/strings.js` 의 `zoom`·`observability`·`bench.hints`,
> `experiments/banana/index.html` 의 머리, `experiments/banana/tests/{bench,playtest-review,ui.contract}.test.js`.

## 공용 부품 (이미 있다 — 고치지 말고 쓴다)

| 파일 | 무엇 |
|---|---|
| `packages/lab-kit/style/shell.css` | 화면 CSS 전부. 실험 `<style>` 에는 그 실험만의 위젯만 남긴다 |
| `packages/lab-kit/ui/zoom-shell.js` | `createZoomShell(root, { closeLabel, onClose })` → `{ body, open(render, openerEl), close, repaint, isOpen }` |
| `packages/lab-kit/ui/item-view.js` | `renderItemView(body, { title, where, role, figure, note, accepts, acceptsLabel, actions })` · `acceptsFrom(dropTable, kind, nameOf)` |
| `tests/uniformity.test.js` | 기계로 재는 규격. **자기 실험 이름의 항목이 전부 초록**이어야 끝이다 |

공용 파일을 고쳐야 할 것 같으면 **고치지 말고 보고서에 적는다** (허브가 한 번에 고친다).

## 차례 (실험마다 똑같다)

1. **껍데기** — `index.html`: `<style>…</style>` 을 `<link rel="stylesheet" href="/packages/lab-kit/style/shell.css">` 로
   바꾸고, 그 실험에만 있는 선택자만 새 `<style>` 에 남긴다. 무엇이 남는지는
   `python3 /private/tmp/claude-501/-Volumes-T7-Projects-virtual-biolab/c84a2733-4443-4d1f-9603-2410b06f4e67/scratchpad/localcss.py <id>` 가 찍어 준다
   (공용에 같은 뜻의 규칙이 이미 있으면 그것도 뺀다 — `.cover-hint` 는 `.zoom-hint` 로 이름을 바꾼다).
2. **말** — `strings.js`:
   - `zoom.close: '닫기 (Esc)'` · `zoom.capture: '결과 기록'` · `zoom.tapView: '클릭 — 크게 보기'` ·
     `zoom.takeOut: '꺼내기'` · `zoom.acceptsLabel: '여기에 끌어다 놓을 수 있는 것:'` (zoom 이 없던 실험도 만든다)
   - `observability.label: '관찰 가능성'` (있는 실험만) · `hint: (worst, fix) => …` + `fix` 표 (banana 참고)
   - `edit` 는 banana 것과 **글자까지 같게** (`heading·note·copy·copied·reset·shelf·surface·overlap`)
   - `report.fields` · `report.groupFields` · `report.button` · `report.make` 도 banana 와 같게
   - `notebook.reportLockedHint: '아직 남은 것이 있습니다'` (숫자는 코드가 붙인다) · `notebook.stepProgress(done, all)` →
     `STEP ${all}개 중 ${done}개를 마쳤습니다.` · `stepLeadIn` 은 banana 와 같게 · `stepNowBadge: '지금 할 차례'` ·
     `stepLockedHint: '앞 STEP 을 먼저 적으세요'` · `stepLockedWhy: (id) => \`STEP ${id} 의 관찰 기록을 적어야 여기가 열립니다.\``
   - `notebook.likertScale` 다섯 칸(전혀 아니다 … 매우 그렇다) · `likertHeading` 은 banana 와 같게
   - 금지어를 전부 걷는다: **확대 화면 → 확대 뷰**, **슬라이드 → 받침 유리**, **폐기물 통 → 쓰레기통**
   - 말풍선(`bench.hints`): 모든 물건의 2단계 첫 줄이 `'클릭 — 크게 보기'`, 1단계 첫 줄이 「클릭하면 크게 봅니다.」꼴.
     **거짓말하는 줄을 지운다** — 「클릭 — 마개 닫기」라고 적혀 있는데 `tapTable` 에 없으면 거짓말이다.
3. **실험대** — `bench.js` 의 `tapTable`: **모든 물건이 `onOpenZoom(...)` 만 부른다.** `store.dispatch` 는 하나도 없다.
   눌러서 하던 조작(껍질 벗기기·원반 뚫기·마개 닫기·잎 바꾸기·뚜껑 여닫기·솜마개 빼기·시행 기록)은 **그 물건 화면의 단추**로 옮긴다.
4. **확대 뷰** — `zoom.js`: `createZoomShell` 로 틀을 바꾸고(패널 뼈대·닫기·Esc·포커스 코드를 지운다),
   물건 화면은 `renderItemView` 로 그린다. 없던 실험(catalase·fermentation)은 `zoom.js` 를 새로 만들고
   `index.html` 에 `<div id="zoom" hidden></div>`, `main.js` 에 `createZoom` 을 잇는다 (banana `main.js` 참고).
   - 통·상자: 열린 통 그림 + 「꺼내기」(종류가 있으면 종류별). 도구·그릇: 상태 + 할 수 있는 단추. 받는 곳: 받는 것 목록.
   - 선택은 `.ctrl-group` + `button[aria-pressed]`, 상태 한 줄은 `.zoom-hint[data-good]`.
     (`.zoom-opt`·`.zoom-choice`·`.zoom-note--warn`·`.zoom-endpick`·`.cover-hint` 는 없어진다)
   - 현미경(osmosis·micrometer): banana 의 `renderScopeMode` 차례를 그대로 — 재물대 상태 → 그림+시야(그림 밑 「재물대에서 내리기」) →
     배율 줄 → 게이지(100 아래면 fix 까지) → 대물렌즈 → 다이얼(호 + 상태 글 + `dialNote`) → 조리개 → 「결과 기록」. 비어도 그림과 빈 시야를 그린다.
5. **탐구 노트** — `notebook.js`: 4쪽 STEP 카드 뼈대는 banana 와 같은 class (`note-step`·`step-summary`·`step-body`·`substep-list`·`substep`·
   `note-step--locked`·`step-locked-why`). 잠긴 STEP 의 까닭은 **카드 안**에. 7쪽은 `likert-row`/`likert-cell` (숫자+말).
   2쪽은 `materials-table`. 읽기 단추는 `.read-mark` 안 `#mark-read.read-confirm`.
6. **검사** — 자기 실험의 `tests/` 중 `index.html` 의 CSS 를 읽던 것은 `packages/lab-kit/style/shell.css` 를 읽게 바꾼다
   (banana 의 `playtest-review.test.js`·`ui.contract.test.js` 참고). `tapTable` 이 dispatch 한다고 기대하던 검사는
   「누르면 화면이 열린다」로 바꾼다 (banana `bench.test.js` 「시약병·폐액통·휴지는 눌러도 …」 참고).
7. **확인** —
   ```bash
   node --test experiments/<id>/tests/*.test.js
   node --test tests/uniformity.test.js 2>&1 | grep "<id>\|^✖"      # 자기 이름 항목이 전부 통과
   node /private/tmp/claude-501/-Volumes-T7-Projects-virtual-biolab/c84a2733-4443-4d1f-9603-2410b06f4e67/scratchpad/survey.mjs <id>
   ```
   조사 스크립트는 물건마다 `zoom=true` 와 단추 목록, 그리고 `errors:0` 을 찍어야 한다. 개발 서버는 5173 에 이미 떠 있다.
   화면은 `/private/tmp/…/scratchpad/survey/<id>-z-*.png` 에 찍힌다 — **직접 열어 본다.**
   `npm run check` 전체는 허브가 마지막에 돌린다 (다른 실험이 아직 손보는 중이라 빨갛다).

## 실험별로 어긋난 자리 (2026-09-03 조사)

### osmosis
- `zoom.slideMode` 「… 슬라이드 제작」→ `받침 유리 ${short}` · `scopeMode` 「현미경 관찰」→ 「현미경」 · `emptyStage` 의 슬라이드.
- 말풍선이 거짓말한다: 용액병 「클릭 — 마개 닫기」, 폐액통 「클릭 — 폐액 버리기」, 휴지 「클릭 — 손 씻기」 —
  `tapTable` 에 없다. 그 조작은 걷어낸 것이므로 줄을 지우고 「클릭 — 크게 보기」로.
- 누르면 아무 일 없는 물건: 해부칼·받침 유리 통·덮개 유리 통·용액병 다섯·쓰레기통·폐액통·개수대·휴지·거름종이·스포이트·핀셋 → 전부 물건 화면.
- 4쪽 잠금이 「실험대에서 STEP 2 까지 마쳐야」(진행 기준)라 다른 일곱과 다르다 → banana 의 규칙(앞 STEP 의 관찰 기록을 적으면 다음 하나)으로.
  `stepLockedUntilDone`·`stepLockedFreed` 는 없앤다.
- `stepProgress` 「STEP 6개 중 0개를」 형식은 이미 맞다. `edit.note` 문구 확인.

### micrometer
- 「확대 화면」 → 「확대 뷰」 (문자열 전부). `zoom.capture` 「현미경 화면 사진찍기」→ 「결과 기록」 — 노트·안내·검사에서
  그 이름을 부르는 곳(`resultsTodoHint` 등)도 전부 따라간다. 「새것 꺼내기」→ 「꺼내기」.
- `renderBoxMode`·`renderItemMode` 의 본문을 `renderItemView` 로 (내용은 그대로 — 어디에 있나·하는 일·그림·단추).
- 쓰레기통을 누르면 아무 일 없다 → 물건 화면 (받는 것: 금 간 대물 마이크로미터·표본).
- `edit`·`report.fields` 를 banana 와 같게. `stepProgress` 함수 추가 (지금은 `stepAllDone` 만 있다).
- 현미경 차례는 이미 맞다. 「재물대에서 내리기」 위치 그대로.

### centrifuge
- `bench.items.bin` 「폐기물 통」→ 「쓰레기통」. 손상성 폐기물 통은 문자열마다 「침 폐기함」/「손상성 폐기물 통」이 섞여 있다 → 「침 폐기함」 하나로.
- `observability.label` 「결과의 읽을 만함」→ 「관찰 가능성」 (+ `fix` 표).
- `report.fields` 「학교 (선택)」·자리 표시가 다르다 → banana 와 같게.
- 모세관 통을 누르면 **말없이 종류가 바뀐다**(헤파린↔민무늬) → 통 화면에 「헤파린 모세관 꺼내기」「민무늬 모세관 꺼내기」 단추.
- 누르면 아무 일 없는 물건: 고무찰흙·채혈침·소독솜·자·손끝·침 폐기함·쓰레기통 → 물건 화면 (손끝은 「빨아올리기」 화면이 있으니 그것을 연다).
- `.zoom-endpick` → `.ctrl-group`, `.zoom-note--warn/good` → `.zoom-hint[data-good]`. 끈·박자·누르기 위젯 CSS 는 실험 쪽에 남긴다.

### chromatography
- `observability.label` 「결과의 볼 만함」→ 「관찰 가능성」 (+ `fix`).
- 잎을 누르면 **말없이 신선한 잎↔시든 잎이 바뀐다** → 잎 화면에서 `.ctrl-group` 「신선한 잎 / 시든 잎」 으로 고른다 (`PICK_LEAF`).
- 바이알을 누르면 **말없이 뚜껑이 열리고 닫힌다** → 바이알 화면(이미 `vial` 모드가 있다)에 「뚜껑 덮기 / 뚜껑 열기」 단추.
- 누르면 아무 일 없는 물건: 추출액·전개액 병·거름종이 통·모세관·연필·자·쓰레기통·폐액통·개수대 → 물건 화면.
- `stepLockedHint`·`stepLockedWhy` 가 다른 문장 → 규격 문장으로. `.zoom-opt`·`.zoom-choice`·`.zoom-note--` 를 없앤다.

### germination
- `zoom.js` 가 `.zoom-sheet`(제목·닫기 한 줄) → `createZoomShell` 로. 챔버 화면 내용은 그대로.
- `zoom.record` 「두 챔버 결과 기록」→ 「결과 기록」(`zoom.capture` 키로) — 노트 예시·안내에서 부르는 이름도 따라간다.
- 폐액통·쓰레기통을 누르면 알림만 뜬다(`NOTE_PRACTICE`) → 물건 화면의 ⑤ 덧붙일 말로 옮기고 dispatch 는 없앤다.
- 누르면 아무 일 없는 물건: 콩 통 둘·숟가락·BTB 병·개수대·휴지 → 물건 화면. 센서는 자기 화면(어디에 꽂혀 있나 · 「빼기」).
- `edit`·`report` 를 banana 와 같게. `stepProgress` 함수 추가.

### catalase · fermentation (설계 실험 둘 — 서로 같은 코드라 **한 사람이 둘 다** 한다)
- 확대 뷰가 **없다.** `zoom.js` 를 새로 만든다 (banana 의 틀 + `renderItemView`). 물건마다:
  - 비커/발효관: 상태(무엇이 들었나·온도·시간) + 「수조(항온기)에서 꺼내기」「비우기」「결과 기록」(`RECORD_TRIAL`)
  - 초시계: 「결과 기록」 · 거름종이와 펀치: 「원반 뚫기」 · 핀셋: 「원반 집기」/「버리기」 · 만든 병: 「비우기」 · 발효관: 「솜마개 빼기」
  - 병·수조·항온기·감자즙·비커 통·솜마개·스포이트·휴지·폐액통·쓰레기통: 상태 + 하는 일 + 받는 것 (+ 비커 통은 「꺼내기」=`NEW_BEAKER`)
- 상단 막대의 「이 시행 기록하기」→ 「결과 기록」.
- `notebook.js` 를 banana 뼈대로: `.note-body` 카드 없앰 · 탭은 `aria-selected` · `.read-foot`→`.read-mark`+`#mark-read.read-confirm` ·
  `.mat-table`→`.materials-table` · `.steps/.step`→`.substep-list/.substep` · `.likert-opt`→`.likert-row/.likert-cell` (숫자+말).
  `reportTodoHeading` 은 `reportLockedHint` 로.
- `index.html` 의 `#side` 구조는 그대로 (공용 CSS 가 `#side` 를 안다). 변인 설계 판(`.design-*`)·`.shell-sentence` CSS 만 실험 쪽에 남긴다.
- `UI.zoom` 이 없으므로 만든다 (close·capture·tapView·takeOut·acceptsLabel).

## 끝났다고 말하기 전에
- [ ] `node --test experiments/<id>/tests/*.test.js` 초록
- [ ] `tests/uniformity.test.js` 에서 자기 실험 항목 전부 초록
- [ ] 조사 스크립트: 모든 물건 `zoom=true`, `errors:0`, 화면을 직접 열어 봄
- [ ] 보고서: 무엇을 고쳤는지 · 공용 파일에 필요해 보인 것 · 사장님이 정해 주셔야 할 것
