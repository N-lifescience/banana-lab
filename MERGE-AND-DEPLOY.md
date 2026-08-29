# 여러 실험을 하나로 합치고 배포하기

병렬로 만든 실험들을 **한 사이트**로 묶는 사람을 위한 문서입니다.
실험 하나를 만드는 중이라면 이 문서는 아직 필요 없습니다 — `NEW-EXPERIMENT.md` 를 보세요.

---

## 1. 먼저 정하고 시작할 것

### 왜 각자 통째로 복제해서 만드는가

병렬로 돌리는 세션들이 **같은 파일을 건드리지 않는 것**이 유일하게 중요한 규칙입니다.
공용 엔진을 먼저 만들어 놓고 여러 세션이 거기에 기능을 얹게 하면, 병합 지옥이 옵니다.

그래서 각자 바나나랩을 통째로 복제해 **완전히 독립된 앱**으로 만듭니다.
합칠 때 중복이 드러나고, 그때 공용으로 올립니다.
**중복을 먼저 없애려 하지 마세요.** 세 번째 실험이 나오기 전에는 무엇이 공통인지 모릅니다.

### 합치면 실제로 무엇이 절약되는가

기대치를 정확히 잡아 두는 편이 좋습니다.

| 공용으로 올라가는 것 (엔진) | 실험마다 새로 만드는 것 |
|---|---|
| 실험대 드래그·자유 배치·이름표·히트박스 | 규칙표 (`sim/rules.js`) |
| 배치 편집 모드 | 상태 스키마 (`sim/state.js`) |
| 확대 뷰 뼈대 | 품질 계산 (`sim/quality.js`) |
| 탐구 노트 7단계 뼈대 | 결과 화면 (`render/`) |
| 보고서(PDF) 전부 | 기구 애셋 (`assets/`) |
| 시작 화면·토스트·되돌리기 | 문자열 전부 (`ui/strings.js`) |
| 아트 디렉션 린터·검사 스크립트 | 배치·조작표 |
| 스타일 토큰 (기구 색·선 두께·광원) | 반응색 팔레트 (`palette.js`) |

**합쳐서 아끼는 것은 배관이지 실험이 아닙니다.** 실험의 알맹이는 매번 새로 만듭니다.
그래도 배관이 전체의 절반쯤 되고, 무엇보다 **한 번 고친 버그가 모든 실험에 적용됩니다.**

---

## 2. 합친 뒤의 모양

```
lab/
  packages/lab-kit/          공용 엔진
    style/tokens.js
    assets/contract.js       CONTRACT · CONTENT_BOX · drawnBoxMm · setAttr
    ui/bench.js              드래그·자유 배치·이름표·편집 모드 (표는 실험이 준다)
    ui/zoom.js  notebook.js  report.js  start.js  toast.js  grading.js
    sim/store.js             createStore · UNDO · SAVE_NOTE · TICK · CAPTURE
  experiments/
    banana/                  실험 하나 = 폴더 하나
      manifest.js            id · 제목 · 설명 · 교육과정 자리 (실험 세션이 채워 온다)
      palette.js             이 실험의 시약색·반응색
      sim/  render/  assets/  ui/strings.js  layout.js  tests/
    onion/
    catalase/
  src/
    main.js                  실험을 고르는 첫 화면 + 라우팅
    registry.js              experiments/*/manifest.js 를 모아 놓은 곳
  scripts/                   검사 스크립트 (공용)
```

**주소:** `/?exp=onion&level=2` — 실험과 단계를 주소로 정합니다.
교사가 반이나 모둠에 따라 다른 링크를 나눠 줄 수 있어야 합니다.
실험을 고르는 첫 화면(`src/main.js`)의 원본은 `ROSTER.md` 와 함께 만든 메인 페이지입니다.
그 페이지의 글꼴은 **직접 호스팅**합니다 — 배포 헤더의 CSP 가 `font-src 'self'` 라
남의 서버에서 받아 오면 그대로 막힙니다. `scripts/build-fonts.mjs` 가 쓰인 글자만 잘라
`public/fonts/` 에 굽고(250 KB — 통째로 실으면 13.1 MB), 문구를 고친 뒤 다시 굽지 않으면
`npm run check` 가 잡습니다.

`registry.js` 는 **합치는 사람만** 씁니다. 실험 세션은 건드리지 않습니다.
`manifest.js` 는 반대로 **실험 세션이 채워 옵니다** — 클론에 `src/manifest.js` 로 들어
있고, `validateManifest()` 와 `tests/manifest.test.js` 가 규약을 지키게 합니다.
합치는 사람이 할 일은 `experiments/<id>/manifest.js` 로 옮기고 `entry` 를 붙이는 것뿐입니다.

카드에 쓸 값이 이미 다 들어 있습니다 — 제목·한 문장 설명·난이도·뼈대,
그리고 **`curriculum`(교육과정 자리 목록)**. 마지막 것이 목록 화면을 만듭니다:
같은 실험이 여러 교과서에 걸리므로 화면은 실험을 한 번만 두고 교과별로 **비춰 보여** 줍니다.
교과서 수만큼 실험을 복제하지 않는 것이 규모가 커졌을 때 유일하게 중요한 결정입니다.

---

## 3. 실제로 부딪히는 것들

병합에서 시간을 잡아먹는 것은 코드가 아니라 아래 여섯 개입니다. 미리 아세요.

### 3.1 팔레트 — 규칙대로 만들었다면 파일 하나 옮기는 일입니다

`NEW-EXPERIMENT.md` §4 의 규칙대로 만들어진 실험은 자기 시약색·반응색을
`src/style/palette.experiment.js` **한 파일**에 모아 두었고, `tokens.js` 는
건드리지 않았습니다. 그런 실험을 들일 때 할 일은 셋뿐입니다.

1. `src/style/palette.experiment.js` 를 `experiments/<id>/palette.js` 로 옮기고
   import 경로를 고친다
2. **그 실험의 `tokens.js` 가 바나나랩 원본과 diff 0건인지 확인한다.**
   diff 가 있다면 규칙을 어긴 것입니다 — 색을 `palette.js` 로 빼낸 뒤에 들이세요
3. 린터(`check-art-direction.mjs`)가 공용 `PALETTE` + **그 실험의** 팔레트를
   합쳐서 검사하게 합니다. 다른 실험의 색은 허용 목록에 넣지 않습니다 —
   양파의 카민색이 카탈레이스 애셋에 들어가면 잡혀야 합니다

규칙 이전에 만든(또는 규칙을 안 지킨) 실험은 색이 `tokens.js` 와 애셋 여기저기에
흩어져 있습니다. 그게 예전에 이 자리가 "가장 크게 부딪히던" 이유입니다 — 한 파일에
열댓 개가 난립하고, 더 나쁜 것은 **이름은 다른데 값이 거의 같은 색**입니다.
그런 실험은 색부터 한 파일로 모으는 것이 병합의 첫 작업입니다.

실험 수와 무관하게 변하지 않는 것:

- 기구 색(`glass`, `metal`, `paper`, `bodyDark`, `rubber`, `bench`)은 **공용**입니다.
  실험이 추가하지 않습니다
- **반응색을 기구에 쓰지 마세요.** 바나나랩에서 실험대에 파란 배관을 넣으려다 막았습니다 —
  팔레트의 파랑은 녹말 반응색(청람색)이라, 실험대에 그 색이 있으면
  학생이 현미경으로 본 결과와 헷갈립니다

### 3.2 애셋 파일 이름

여러 실험이 `slide.js` · `bottle.js` 를 각자 갖고 있고 **그림이 다릅니다.**
`experiments/<id>/assets/` 에 그대로 두세요. 공용으로 올리는 것은
정말로 똑같은 것(받침 유리, 덮개 유리, 스포이트, 핀셋, 현미경)만입니다.

올릴 때는 **둘을 나란히 띄워 놓고 눈으로** 비교하세요. 하네스의 애셋 시트가 그 자리입니다.

### 3.3 문자열

`UI` 객체 하나를 여러 실험이 공유하면 반드시 부딪힙니다.
`experiments/<id>/ui/strings.js` 를 각자 두고, 엔진은 그것을 **주입받습니다.**

엔진이 직접 갖는 문자열은 실험과 무관한 것뿐입니다 — 되돌리기, 리커트 척도,
느낀 점 문항, 보고서 머리말, 편집 모드.

### 3.4 규칙 액션 이름

`SMEAR` · `MOUNT` 같은 실험 고유 액션은 실험별 `reduce` 안에 있으니 부딪히지 않습니다.
**공용으로 올려야 하는 것은 이 다섯입니다:** `UNDO`, `SAVE_NOTE`, `TICK`,
`CAPTURE`, `NOTE_VIOLATION`. 실험마다 미묘하게 다르게 구현돼 있을 테니
합칠 때 하나로 맞추고, 각 실험의 테스트를 다시 돌려 확인하세요.

### 3.5 광학·물리 상수

현미경을 쓰는 실험이 여럿이면 `optics.js` 는 공용입니다. 단 **배율 구성이 다를 수 있습니다**
(4/10/40 vs 10/40/100). 상수를 엔진에 박지 말고 실험이 값을 주게 하세요.
현미경이 없는 실험(크로마토그래피 전개, 원심분리 회전)은 `optics.js` 자리에
자기 물리를 넣습니다 — 공용이 아니라 그 실험 것입니다.

값 자체는 실제 광학에서 나온 것이어야 합니다. `tests/optics.test.js` 를 함께 옮기세요.

### 3.6 테스트 파일 이름

`tests/rules.test.js` 가 실험마다 있습니다. `experiments/<id>/tests/` 로 옮기고
`npm test` 가 전부 훑도록 글로브를 넓히세요.

---

## 4. 합치는 순서

한 번에 다 옮기지 마세요. **하나 옮길 때마다 전부 초록불인지 확인합니다.**

```
1. 껍데기부터
   - 빈 저장소에 packages/lab-kit/ 자리만 만들고,
     실험을 고르는 첫 화면과 registry.js 를 만든다
   - 아직 실험은 없다. 화면이 뜨는 것만 확인한다

2. 바나나랩을 experiments/banana/ 로 통째로 옮긴다
   - 엔진으로 올리지 말고 **그대로** 옮긴다
   - npm run check / check-bench / check-build 전부 통과할 때까지 고친다
   - 여기까지가 "여러 실험 구조에서 실험 하나가 도는가" 다

3. 두 번째 실험을 옮긴다
   - 이때 처음으로 중복이 보인다. 그래도 **아직 올리지 않는다**
   - 두 실험이 각자 도는 것을 먼저 확인한다

4. 세 번째를 옮긴 뒤에 공용으로 올린다
   - 세 번 똑같이 생긴 것만 packages/lab-kit/ 으로 올린다
   - 하나 올릴 때마다 세 실험의 검사를 전부 돌린다

5. 나머지를 옮긴다
   - 이제 틀이 정해졌으므로 빨라진다
```

각 단계마다 커밋하세요. 4단계에서 뭔가 어긋나면 3단계로 돌아갈 수 있어야 합니다.

### 2단계에서 실제로 걸린 것 (2026-08-29, banana)

문서대로 「그대로 옮기기」인데도 **경로가 여섯 자리에서 어긋났다.** 다음 실험을 옮길
사람이 같은 데서 멎지 않게 적어 둔다.

| 어긋난 자리 | 증상 | 고침 |
|---|---|---|
| `tests/` 의 `../` 참조 10곳 | 두 단계 깊어졌는데 한 단계만 올렸다 | `../../../` |
| **`../src`(슬래시 없는 것)** | 정규식이 `src/` 만 빼서 **바나나 것을 뿌리로** 올렸다 | `../src` 로 되돌림 |
| `../index.html` | 뿌리 `index.html` 이 **이제 카탈로그**라 엉뚱한 것을 읽었다 | `../index.html`(실험 것) |
| `privacy.html` | **사이트 것**인데 실험 폴더에서 찾았다 | `SITE_WIDE` 로 갈랐다 |
| 검사의 `devUrl('/')` | 뿌리가 카탈로그라 **실험을 못 찾고 멎었다** | `expUrl('banana')` |
| 브라우저 안 `import('/src/…')` | 절대 경로가 그대로 남아 **125번째에서 멎었다** | `expPath` 를 넘겨 만든다 |

★ **뒤의 셋은 「바닥 관문」이 잡았다.** 없었으면 `0/0 통과` · `125/125 통과` 로
**초록불이 났다** — 옮기다 반쯤 죽은 검사를 통과로 읽었을 것이다.

★ **글꼴 검사가 조용히 통과했다.** `main-page.html` → `index.html` 로 이름이 바뀌었는데
`build-fonts.mjs` 가 옛 이름을 찾고 **「없습니다 — 할 일 없음」으로 exit 0** 했다.
굽어 둔 글꼴이 있는데 쓰는 페이지가 없으면 **빨간불**이 나게 고쳤다.

### 주소 되쓰기는 **로컬로 확인할 수 없다**

`vercel.json` 의 `rewrites` 는 `vite preview` 가 안 읽는다. `/cell-metabolism/banana` 가
정말 열리는지는 **배포한 뒤에만** 안다. 배포 직후 한 번 열어 보고, 안 열리면
`rewrites` 를 본다 — 로컬 초록불은 이 자리에 대해 아무 말도 하지 않는다.

교과마다 한 줄이고 실험은 폴더만 만들면 붙는다:

    { "source": "/cell-metabolism/:exp", "destination": "/experiments/:exp" }

같은 실험이 여러 교과에 걸리면 줄이 여럿이지만 **폴더는 하나**다.

★ **목적지에 `.html` 을 쓰면 안 된다 — `cleanUrls: true` 가 그것을 308 로 되돌린다.**
처음에 `/experiments/:exp/index.html` 로 적었더니 **404** 가 났다. 재 보니 갈렸다:

    /experiments/banana/index.html   **308**   ← cleanUrls 가 되돌린다
    /experiments/banana              200
    /cell-metabolism/banana          404       ← 되쓰기가 308 짜리를 가리키고 있었다

**로컬에서는 이 셋이 전부 200 이다.** `vite preview` 는 `cleanUrls` 도 `rewrites` 도
안 읽는다 — 그래서 이 자리는 **배포한 뒤 세 주소를 다 두드려 보는 것** 말고 방법이 없다.

### 합치기 전 체크리스트 (실험마다)

- [ ] `npm run check` 통과
- [ ] `node scripts/check-bench.mjs` 통과
- [ ] `npm run build && npm run preview` 후 `node scripts/check-build.mjs` 통과
- [ ] 브라우저에서 처음부터 끝까지 직접 플레이했고 콘솔 에러 0건
- [ ] 이 실험의 색이 전부 `src/style/palette.experiment.js` 에 있고 `tokens.js` 는 diff 0건
- [ ] `PROGRESS.md` 가 **이 실험의** 기록이고, 바나나랩 기록은 `docs/banana-progress.md` 에 있음
- [ ] 하드 게이트를 새로 추가하지 않았음

---

## 5. 배포

### 지금 상태

바나나랩은 **정적 사이트**입니다. 기본 상태에서는 서버도 데이터베이스도 환경변수도 없습니다 —
제출 기능을 켤 때만 Supabase 와 환경변수 둘이 생깁니다 (아래 「제출 기능 켜기」).
`npm run build` 가 `dist/` 하나를 냅니다. 그게 전부입니다.

```
dist/index.html                 26 kB   (gzip 8 kB)
dist/assets/index-*.js         154 kB   (gzip 47 kB)
```

개발용 뒷문은 배포본에 들어가지 않습니다 — `window.__store`, `?edit=1`,
`harness.html` 전부 `import.meta.env.DEV` 뒤에 있거나 빌드에서 빠집니다.
`scripts/check-build.mjs` 가 **실제 배포 파일**을 열어 그것을 확인합니다.

### Vercel 에 올리기

저장소를 GitHub 에 올려 두었다면 클릭 몇 번입니다.

1. https://vercel.com → **Add New → Project**
2. `N-lifescience/banana-lab` 를 Import
3. 설정은 건드릴 것이 없습니다. Vercel 이 Vite 를 알아서 잡습니다

   | 항목 | 값 |
   |---|---|
   | Framework Preset | Vite |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | `npm install` |
   | Node.js Version | 20 이상 |
   | Environment Variables | **없음** |

4. **Deploy**

`main`/`master` 에 push 하면 자동으로 다시 배포됩니다.
Pull Request 마다 미리보기 주소가 생기므로, 새 실험을 붙일 때 그걸로 확인하세요.

명령줄로 하려면:

```bash
npm i -g vercel
vercel login          # 브라우저가 열립니다. 사람이 해야 합니다
vercel --prod
```

### 제출 기능 켜기 (선택)

학생이 보고서를 마치고 「선생님께 제출」을 누르면 담당 교사의 수업으로 들어가게 하는 기능이다.
**켜지 않아도 앱은 그대로 돈다** — 설정이 없으면 제출 칸이 아예 안 그려지고, 학생은 지금처럼
PDF 로 저장해 낸다. 학교마다 켜고 끌 수 있어야 하므로 그렇게 만들었다.

켜기 전에 **반드시 확인할 것**: 이 기능은 학번과 이름을 저장한다. 만 14세 미만 학생이 있으면
법정대리인 동의가 필요하고, 그 절차는 학교의 개인정보 처리 절차를 따른다. 절차가 준비되지
않았으면 켜지 마라 (`privacy.html` 제8조).

```
1. supabase.com → New project
   - Region 을 **Northeast Asia (Seoul)** 로 고른다. 국외 이전 문제가 여기서 사라진다
   - 프로젝트 이름과 DB 비밀번호는 아무거나. 비밀번호는 이 앱이 쓰지 않는다

2. SQL Editor → supabase/schema.sql 을 통째로 붙여 넣고 Run
   - 여러 번 실행해도 괜찮게 써 두었다
   - 끝나면 Table Editor 에서 classes · reports 두 표가 보이고,
     둘 다 "RLS enabled" 라고 떠 있어야 한다

3. Settings → API 에서 두 값을 복사한다
   - Project URL              →  VITE_SUPABASE_URL
   - Project API keys의 anon  →  VITE_SUPABASE_ANON_KEY
   - **service_role 키는 절대 쓰지 않는다.** 그 키는 RLS 를 통째로 건너뛴다

4. Vercel → 프로젝트 → Settings → Environment Variables 에 둘을 넣는다
   - Production · Preview 둘 다 체크
   - 넣은 뒤 **다시 배포**해야 반영된다 (환경변수는 빌드 때 박힌다)

5. Supabase → Database → Extensions 에서 pg_cron 을 켜고, SQL Editor 에서 한 번 실행한다
   select cron.schedule('purge-expired-classes', '0 3 * * *',
     $ delete from classes where expires_at < now() $);
   - 이게 없으면 기한이 지나도 **데이터가 남는다.** 정책이 가려 줄 뿐이다
```

확인:

```bash
BASE=https://<배포주소> node scripts/check-build.mjs   # 「설정 여부에 따라…」가 "켜짐" 으로 나와야 한다
```

쓰는 법은 간단하다. 선생님이 `/teacher.html` 을 열어 수업을 만들면 **여섯 자리 코드 · 학생용
링크 · QR · 관리 링크**가 나온다. 앞의 셋은 학생에게 주고, **관리 링크는 선생님만 갖는다** —
그 주소를 아는 사람이 그 반의 보고서를 본다. 잃어버리면 되찾을 길이 없다.

### 배포한 뒤 반드시 확인할 것

에이전트가 대신 해 줄 수 없는 것들입니다.

- [ ] **학교망에서 열리는가.** 교육청 망이 도메인이나 포트를 막는 경우가 있습니다.
      학교 컴퓨터에서 직접 열어 보세요
- [ ] **학교 컴퓨터의 브라우저에서 도는가.** 빌드 타깃이 `es2022` 입니다.
      아주 오래된 브라우저가 깔린 곳이면 `vite.config.js` 의 `target` 을 낮추세요
- [ ] **한글이 깨지지 않는가.** 특히 PDF 보고서 — 인쇄는 그 컴퓨터의 글꼴을 씁니다
- [ ] **프로젝터·태블릿에서 읽히는가.** 이름표 글자가 10.5 px 입니다
- [ ] **PDF 저장이 되는가.** 인쇄 창에서 "PDF로 저장" 을 고르는 흐름을 학생에게
      한 번 보여 줘야 합니다

### 나중에 서버가 필요해지면

모둠 결과 보드(T06)를 붙이면 그때 Supabase 와 환경변수가 생깁니다.
그 전까지는 서버 없는 상태를 유지하세요 — 학교에서 돌리기에 그게 가장 안전합니다.

붙일 때 지킬 것 (`tasks/T06-board.md`):

- **RLS 를 켜지 않고 배포하지 마세요.** anon key 하나로 테이블 전체가 열립니다
- 서비스 롤 키를 프런트엔드에 넣지 마세요
- 학생 이름·학번·이메일을 받는 칸을 만들지 마세요
- 결과 이미지를 저장하지 마세요. 시드와 파라미터로 다시 그립니다

---

## 6. 개인정보 — 합쳐도 바뀌지 않는 선

실험이 몇 개가 되든 이 선은 그대로입니다.

- 실험하는 동안 학생 정보를 **묻지 않습니다**
- 보고서를 만들 때만 받고, 상태에도 브라우저 저장소에도 넣지 않으며,
  인쇄가 끝나면 지웁니다
- 남는 것은 학생이 저장한 PDF 파일 하나뿐이고, 그건 학생 손에 있습니다

`tests/report.test.js` 가 소스에서 `dispatch`·`localStorage`·`fetch` 를 막습니다.
합칠 때 이 테스트를 반드시 함께 옮기세요.
