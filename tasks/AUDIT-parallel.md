# AUDIT-parallel.md — 병렬 세션 일곱 개를 실제로 띄울 수 있는가

감사자가 문서를 읽기만 한 것이 아니라 **클론을 두 벌 만들어 실제로 돌려 보고** 적은 것이다.
작업은 전부 `scratchpad/audit/` 아래에서 했고, `banana-lab` 과 `micrometer-lab` 은 읽기만 했다
(`micrometer-lab` 에서는 읽기 전용인 `npm run check` 만 돌렸다).

---

## 판정 — **조건부. 지금 그대로 열면 안 된다.**

뼈대는 튼튼하다. 클론은 익명으로 되고, 초록불에서 출발하고, 포트 격리는 **광고한 대로 정확히
작동한다** (직접 어긋나게 만들어 확인했다). 병렬로 돌리는 데 필요한 기계장치는 다 있다.

막는 것은 기계가 아니라 **문서와 출발 절차**다. 아래 **B1~B4** 를 고치기 전에 열면
일곱 세션이 전부 같은 자리에서 넘어진다. 넷 다 고치는 데 문서 몇 줄이면 된다.

| | 내용 | 몇 세션이 걸리나 |
|---|---|---|
| **B1** | 클론의 첫 커밋이 가짜 작성자 주소로 찍힌다 (Vercel `blocked`) | **7 / 7** |
| **B2** | §2 프롬프트 블록이 자족적이지 않다 — 복제 명령·포트·공통 규칙이 블록 밖에 있다 | **6 / 7** (웨이브 2·3 전부) |
| **B3** | `[검증]` 표시가 그대로 남아 있다 — LAUNCH.md 스스로 "띄우기 전에 사람이 확인" 이라고 못 박은 것 | **5 / 7** (웨이브 2 셋 다) |
| **B4** | 파일럿이 아직 초록불이 아니다 — LAUNCH.md §0 이 웨이브 2 의 조건으로 걸어 둔 관문 | 게이트 자체 |

---

## 1. 문서대로 클론이 되는가 — 자격 증명 없이

### 결과: **된다.** 그리고 문서가 "비공개" 라고 말하는 것은 이제 **틀렸다.**

전역 git 설정을 통째로 끊어(자격 증명 도우미까지) 익명으로 받아 봤다.

```
$ GIT_TERMINAL_PROMPT=0 GIT_CONFIG_GLOBAL=/dev/null \
    git clone https://github.com/N-lifescience/banana-lab.git onion-lab
Cloning into 'onion-lab'...
EXIT=0
```

키체인도 토큰도 끼어들 수 없는 조건에서 통과했다. **저장소는 실제로 공개다.**

`NEW-EXPERIMENT.md` §2 (54~56줄) 는 아직 이렇게 말한다:

> **이 저장소는 비공개입니다.** … 세션을 띄우기 전에 소유자에게 권한을 받거나
> 저장소를 공개로 돌리세요. (micrometer 파일럿에서 잡혔습니다)

파일럿이 지적한 것을 사람이 이미 처리했는데(공개 전환) **문서만 안 따라왔다.**
이대로 두면 일곱 세션이 첫 줄에서 "권한이 없을 수 있다" 를 읽고 멈춰 사람에게 묻는다.
→ **A1** (아래).

### §2 나머지 — 그대로 다 돌았다

```
$ rm -rf .git && git init && rm -f main-page.html ROSTER.md LAUNCH.md MERGE-AND-DEPLOY.md
$ rm -rf public/fonts
$ npm install
added 19 packages, and audited 20 packages in 476ms
found 0 vulnerabilities

$ npm run check
ℹ tests 177 / pass 177 / fail 0
아트 디렉션 검사 — 애셋 15종, 32개 상태
  ✓ 위반 없음
main-page.html 이 없습니다 — 이 저장소에는 직접 호스팅할 글꼴이 없습니다.
CHECK_EXIT=0
```

**초록불에서 출발한다.** 글꼴 검사가 `main-page.html` 없이 조용히 넘어가는 것도 의도대로다.

### ✗ B1 — 첫 커밋이 가짜 작성자로 찍힌다 (막는 것)

§2 는 복제 직후 이 커밋을 시키는데, 그 앞에 `rm -rf .git` 가 있다. **로컬 `user.email`
이 함께 지워진다.** 그리고 이 기계에는 전역 `user.email` 이 없다.

```
$ git config --global user.email
global-exit=1                       ← 전역에 없음

$ cd onion-lab && git config user.email
exit=1                              ← git init 직후라 로컬에도 없음

$ mv PROGRESS.md docs/banana-progress.md
$ printf '# PROGRESS.md — 진행 기록\n\n' > PROGRESS.md
$ git add -A && git commit -m "바나나랩 기록을 보관하고 새 기록으로 시작"
COMMIT_EXIT=0                       ← 에러도 경고도 없이 성공한다

$ git log -1 --format='author=%an <%ae>'
author=조성주 <joseongju@joseongiMacmini.Davolink>
```

`banana-lab/CLAUDE.md` 가 T27 로 경고한 **바로 그 문자열**이 그대로 나왔다.
커밋은 조용히 성공한다 — 로컬에서는 아무 티도 안 난다.

- `NEW-EXPERIMENT.md`·`LAUNCH.md`·`PLAYBOOK.md`·`AGENTS.md` 어디에도 `user.email` 이야기가 없다.
  (`grep -rn 'user\.email' *.md` → `CLAUDE.md` 74·77줄 **둘뿐**)
- `CLAUDE.md` 에는 있지만 그 절의 제목이 「**커밋하기 전에**」다. §2 는 그 문서를 읽기도 전에
  이미 커밋을 시킨다. 순서가 어긋나 있다.
- 파일럿은 이 함정을 이미 밟고 손으로 고친 흔적이 있다 — `micrometer-lab` 의 로컬
  `user.email` 은 `shinezero77@gmail.com` 으로 **설정돼 있고**, 첫 커밋 작성자도 정상이다.
  즉 사람이 그때그때 때웠고 **절차에는 안 들어갔다.**

→ 고칠 곳: §2 의 `rm -rf .git && git init` **바로 다음 줄**에
`git config user.email shinezero77@gmail.com` (와 `user.name`) 을 넣는다.

---

## 2. 두 세션이 동시에 돌 수 있는가

### 결과: **된다. §7 이 광고한 대로 정확히 작동한다.**

클론 두 벌(`onion-lab` → 5174, `catalase-lab` → 5176)을 만들어 실제로 띄웠다.

```
$ node node_modules/vite/bin/vite.js        # 각 클론에서
VITE v8.2.2 ready in 715 ms  ➜ Local: http://localhost:5174/
VITE v8.2.2 ready in 670 ms  ➜ Local: http://localhost:5176/

$ curl ...
port 5174 -> HTTP 200
port 5176 -> HTTP 200
```

**둘 다 동시에 살아 있다.**

### `strictPort` 가 실제로 죽는가 — 확인함

`catalase-lab` 의 포트를 일부러 5174 로 겹치게 바꾸고 띄웠다.

```
error when starting dev server:
Error: Port 5174 is already in use
```

밀려나지 않고 **죽는다.** §7 이 약속한 그대로다.

### 검사 스크립트가 자기 포트를 보는가 — 어긋나게 만들어 확인함

이게 §7 의 핵심 주장이라 그냥 통과시키지 않고 **반례를 만들었다.**
`onion-lab` 의 서버만 죽이고, 옆 세션(5176)은 살려 둔 채 `onion-lab` 에서 검사를 돌렸다.
스크립트가 주소를 잘못 보면 **옆 앱을 검사하고 114/114 초록불**이 나올 자리다.

```
$ curl → 5174=000  5176=200      ← 자기 서버만 죽음

$ cd onion-lab && node scripts/check-bench.mjs
page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5174/
EXIT=1
```

**옆 앱으로 새지 않고 자기 포트에서 크게 실패한다.** 이것이 §7 이 막으려던 바로 그 사고다.

정상 상태에서는:

```
$ cd onion-lab && node scripts/check-bench.mjs      # 서버 살아 있을 때
114/114 통과   EXIT=0
```

### 검사 두 개를 동시에 돌려도 되는가 — 확인함

```
$ (cd onion-lab && node scripts/check-bench.mjs) & (cd catalase-lab && node scripts/check-bench.mjs) & wait
114/114 통과   onion=0
114/114 통과   cat=0
```

크로미엄 두 개가 동시에 떠도 서로 간섭하지 않는다.

### 포트 가드가 진짜인가 — 되돌려서 확인함

이 저장소의 규칙("되돌려도 실패하지 않는 검사는 없는 것보다 나쁘다")을 가드 자신에게 적용했다.
`check-ui.mjs` 에 주소를 도로 박아 넣었다.

```
$ sed -i '' "s|devUrl('/?level=1')|'http://localhost:5173/?level=1'|" scripts/check-ui.mjs
$ node --test tests/devport.test.js
AssertionError: dev-port.js 의 devUrl()/previewUrl() 을 쓰세요:
  check-ui.mjs:37  const URL_BASE = 'http://localhost:5173/?level=1';
$ (원복) → pass 2 / fail 0
```

**실제로 잡는다.** 다섯 스크립트가 전부 `dev-port.js` 를 읽는 것도 확인했다
(`check-bench`·`check-ui`·`check-build`·`shot`·`perf-fov`. `check-grading` 은 브라우저를 안 써서 무관).

**정리한 것:** 띄운 서버는 전부 죽였다 (`pgrep -fl vite` → none).

---

## 3. 세션끼리 부딪히는 자원이 또 있는가

### 부딪히지 않는다 — 확인한 것

| 자원 | 왜 문제가 안 되나 | 어떻게 확인했나 |
|---|---|---|
| `shots/` | `shot.mjs` 가 `mkdirSync('shots')` 를 **cwd 기준**으로 만든다. gitignore 라 클론에 안 딸려 온다 | 소스 확인 + 클론에 `shots/` 없음 |
| `dist/` · `node_modules/.vite` · `.dorms-check/` | 전부 클론 안 경로. gitignore | `.gitignore` 확인 |
| `_audit-*.mjs` · `probe-tmp.mjs` · `shot-tmp.mjs` | 클론 안 경로. gitignore | `.gitignore` 확인 |
| **전역 npm 캐시** (`~/.npm`) | 동시 설치해도 깨지지 않는다 | `node_modules` 지우고 **두 클론에서 `npm install` 동시 실행** → 둘 다 exit 0, 에러·락 경고 0 |
| **Playwright 브라우저 캐시** (`~/Library/Caches/ms-playwright`) | 공유지만 **읽기 전용**. 크로미엄은 실행할 때마다 임시 프로필을 따로 판다 | 위의 동시 `check-bench` 2회 → 둘 다 114/114 |
| 미리보기 포트 6174~6180 | `PREVIEW_PORT = DEV_PORT + 1000`. 개발 포트 대역(5174~5180)과 안 겹친다 | `dev-port.js` + `tests/devport.test.js` |
| Vercel 프로젝트 연결 | `.vercel` 이 gitignore. 클론마다 따로 붙는다 | `.gitignore` 확인 |

### 부딪힐 수 있는 것 — 판정과 함께

**① `git config user.email` (전역에 없음)** — 이건 "부딪힘" 이 아니라 **공백**인데,
공백이라 일곱 클론이 전부 같은 방식으로 틀린다. → **B1.** 위 §1 참조.

**② Supabase 프로젝트를 여럿이 공유할 때** — LAUNCH.md §8 이 권장하는 사용법이다. 판정:
**병렬 제작을 막지는 않는다.** 근거를 실제로 열어 봤다.

- 표는 `exp` 칸 하나로 갈리고, 그 값은 `exp: manifest.id` 로 배선돼 있다
  (`src/teacher.js:110`, `src/ui/report.js` 의 제출부). 실험마다 자동으로 나뉜다.
- 수업 코드는 `classes.code text not null unique` — **전역 유일**이라 실험이 달라도 겹칠 수
  있는데, `createClass()` 가 `23505`(unique 위반)를 보고 최대 5회 다시 뽑는다
  (`src/net/supabase.js:112~130`). 실제로 문제가 안 된다.
- 다만 **`findClass(code)` 는 `klass.exp` 를 이 앱의 `manifest.id` 와 대조하지 않는다.**
  한 프로젝트를 공유하면, 삼투 앱을 연 학생이 카탈레이스 수업 코드를 넣어도 제출이 통과한다.
  보고서 행에는 자기 `exp` 가 찍히므로 선생님 화면에서 남의 실험 행으로 보인다.
  **판정: 병렬 제작의 blocker 는 아니다** (교실 운영 쪽 이야기고, 데이터가 새지도 않는다).
  제출부는 손대지 말라고 돼 있으니 **여기 적어만 둔다.**

**③ `manifest.id` 를 마지막(T10)에 채운다** — 그 전에 제출을 시험해 보면 `exp` 기본값
`'banana'` 로 들어간다 (`createClass({ exp = 'banana' })`). 공유 프로젝트라면 여러 실험의
시험 데이터가 `banana` 칸에 섞인다. **판정: 사소함.** 시험 데이터고 지우면 그만이다.

**④ `npm install` 이 Playwright 브라우저를 받지 않는다** — 이 기계에서는 전역 캐시에 이미
있어서 통과했지만, 새 기계라면 `npx playwright install chromium` 이 따로 필요하다.
그 안내는 스크립트의 fallback 메시지에만 있고 문서에는 없다. **판정: 이 기계에서는 문제 없음.
다른 기계로 옮기면 걸린다.** → **A8.**

---

## 4. `LAUNCH.md` §2 의 프롬프트가 자족적인가

일곱 블록을 하나씩 읽었다. **판정: 자족적이지 않다.** 세 가지가 블록 밖에 있다.

### ✗ B2 — 복제 명령·포트·공통 규칙이 블록 안에 없다 (막는 것)

| 블록 안에 있어야 할 것 | micrometer | osmosis | catalase | chromatography | fermentation | centrifuge | germination |
|---|---|---|---|---|---|---|---|
| 복제 명령 / 저장소 주소 | △ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| 포트 번호 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| 공통 규칙 본문 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `[검증]` 해소됨 | ✔ | ✗ | ✗ | ✗ | ✗ | ✗ | ✔ |

**복제 명령** — 웨이브 2·3 블록 여섯 개는 복제 이야기가 이 한 줄뿐이다:

> `(복제·문서·PROGRESS 처리·공통 규칙은 위와 같다)`

"위" 는 **그 세션이 받지 못한 텍스트**다. micrometer 블록(70줄)에도 명령은 없고
「바나나랩(**구글 드라이브의 이 저장소**)을 복제해서 시작한다」뿐이다 — 주소도, `git clone` 도,
`rm -rf .git` 도 없다. 게다가 이 저장소는 구글 드라이브가 아니라 T7 SSD 에 있다.
(`NEW-EXPERIMENT.md` §8 의 견본 프롬프트에는 GitHub 주소가 제대로 들어 있다 — 372줄.
LAUNCH.md 쪽만 흐려져 있다.)

**포트** — 일곱 블록 중 **어디에도 숫자가 없다.** 공통 규칙에 「이 실험에 배정된 번호로
바꾼다 (§7)」라고만 돼 있는데, §7 은 블록 밖이고 그나마 `LAUNCH.md` 는 §2 절차에서 **삭제된다**
(→ A2). osmosis 세션은 자기 포트가 5175 라는 것을 알 길이 없다.
**이건 §7 이 통째로 막으려던 사고를 그대로 되살린다.**

**공통 규칙** — micrometer 블록은 규칙 자리에 「`(위 공통 규칙 전부)`」라고만 적혀 있다.
그 열두 줄에는 `tokens.js` 금지, `palette.experiment.js` 사용, 제출부 금지, 토스트 두 색 같은
**이 저장소에서 가장 자주 어기는 것들**이 들어 있다. 블록만 받은 세션에게는 전달되지 않는다.

→ 고칠 곳: 블록마다 (a) `NEW-EXPERIMENT.md` §2 의 bash 블록을 그대로, (b) `DEV_PORT = 517x`
한 줄, (c) 공통 규칙 열두 줄을 **펼쳐서** 넣는다. 중복이 늘지만 프롬프트는 중복이 맞다.

### ✗ B3 — `[검증]` 이 다섯 블록에 남아 있다 (막는 것)

LAUNCH.md §2 (41~43줄) 가 스스로 못 박은 조건이다 — 「세션을 띄우기 전에 사람이 한 번
확인한다 … 확인했으면 `[검증]` 글자를 지우고 붙여 넣는다」.

```
$ grep -n '\[검증' LAUNCH.md
101:  osmosis        [검증: 농도 표기]
124:  catalase       [검증: 반응식 2H₂O₂ → 2H₂O + O₂, 시약 농도]
148:  chromatography [검증: 색소 종류와 전개율 순서 — 카로틴>잔토필>엽록소 a>엽록소 b]
172:  fermentation   [검증: 10% 효모액/포도당액 제조·희석 비율]
195:  centrifuge     [검증: 혈액 층 성분과 순서]
```

**웨이브 2 의 세 개가 전부 여기 있다.** micrometer 는 해소돼 있고(「사람이 확인함」),
germination 은 애초에 표시가 없다. 이 다섯 개는 **사람이 해야 하는 일**이라 감사자가 대신
채울 수 없다. 확인 못 했다고 적는다.

### 그 실험에만 필요한데 안 적힌 것

- **centrifuge / germination** — 블록이 「`ROSTER.md` §6 / §7 을 먼저 읽어라」고 시키는데,
  §2 절차가 `rm -f ROSTER.md` 로 **그 파일을 지운다.** (§6·§7 이라는 번호 자체는 유효하다 —
  `ROSTER.md` 71~178줄이 「### 1.」~「### 7.」로 매겨져 있다.)
  다만 두 블록이 재구성의 핵심 판단(회전판 제작 단계를 빼는 것, 센서 곡선 대신 챔버 그림 +
  그래프)을 **본문에 이미 요약해 두었다.** → 그래서 막는 것이 아니라 **A3**.
- **catalase → fermentation 의존** — fermentation 블록이 「가능하면 catalase 세션이 만든
  변인 선택 UI 를 참고해」라고 하는데, **어디서 그것을 가져오는지가 없다.** 클론이 서로 다른
  폴더에 있고 `main` 은 동결이라 경로가 정해져 있지 않다. 웨이브 3 을 열 때 정해 줘야 한다.
- **채점 홀드아웃 교차 배정** (§5) — 「세션 A 가 세션 B 의 답안을 써 준다」인데
  **A→B 짝이 어디에도 없다.** 일곱 블록 어디에도 "누구에게 써 준다" 가 안 적혀 있다.
  판정: 막지는 않는다(나중에 사람이 짝을 정하면 된다). 하지만 세션은 이 요구를 아예 못 본다.

---

## 5. 파일럿 교훈이 문서에 반영됐는가

`micrometer-lab/PROGRESS.md` 와 `tasks/REVIEW-rules.md` 를 읽고 대조했다.

### 들어간 것 ✔

| 파일럿이 지적한 것 | 어디에 들어갔나 |
|---|---|
| **② 치우라고 말하지 않는 파일들** (`main-page.html`·`ROSTER.md`·`LAUNCH.md`·`MERGE-AND-DEPLOY.md`·`public/fonts/`) | `NEW-EXPERIMENT.md` §2, 65~66줄에 `rm` 목록으로 **정확히 그대로** 들어갔다 |
| **① 저장소가 비공개다** | 사람이 **저장소를 공개로 돌려** 실질적으로 해결했다 (§1 에서 익명 클론으로 확인). 다만 문서 문구가 안 따라왔다 → A1 |
| 포트 배정 | `LAUNCH.md` §7 배정표 + `dev-port.js` + `tests/devport.test.js` 로 기계화됐다. 실측으로 전부 작동 확인 (§2) |

### ✗ A5 — 빠진 것: 파일럿의 **가장 큰 교훈**이 세션에 닿지 않는다

`REVIEW-rules.md` 가 「교훈」이라고 이름 붙여 남긴 유일한 문장이다:

> 병렬로 돌릴 때 **한쪽이 다른 쪽의 미확정 값을 예시로 쓰면 그 숫자가 사실처럼 굳는다.**
> 다음 웨이브 프롬프트에 「확정 안 된 값은 예시로도 쓰지 말고 자리표시자만 두라」를 넣는다.

이 규칙은 `LAUNCH.md` §2 공통 규칙 56~57줄에 **문장으로는 들어갔다.** 그런데:

```
$ grep -n '자리표시자|확인 필요|확정 안 된|임시 숫자' NEW-EXPERIMENT.md PLAYBOOK.md AGENTS.md
(없음)
```

즉 이 규칙이 있는 곳은 **`LAUNCH.md` 한 곳뿐**이고, `LAUNCH.md` 는

1. §2 절차가 클론에서 **지운다** (`rm -f LAUNCH.md`), 그리고
2. 세션은 블록 하나만 받으므로 §2 의 공통 규칙 목록을 **애초에 못 본다** (B2).

**결과적으로 일곱 세션 중 아무도 이 규칙을 못 읽는다.** 파일럿이 실제로 물린 함정이,
파일럿의 지적이 문서에 반영됐는데도, 다음 웨이브에 전달되지 않는다.
→ `NEW-EXPERIMENT.md` §7 (되풀이해서 물린 함정, 지금 8개) 에 9번으로 넣는 것이 맞다.
같은 이유로 `LAUNCH.md` §8 의 교실 교훈들(토스트 두 색, 빈 칸 금지, `user-select` 3종 세트,
눕힌 스마트폰)도 **규칙 문장으로는** 클론에 남지 않는다 — 코드 주석(`index.html:329`)과
`docs/banana-progress.md` 에 흔적이 있을 뿐이다.

### ✗ B4 — 파일럿이 아직 초록불이 아니다 (게이트)

`LAUNCH.md` §0 의 3번이 웨이브 2 의 조건이다: 「파일럿이 초록불이면 웨이브 2를 3개 동시에 연다」.

```
$ cd /Volumes/T7/Projects/micrometer-lab
$ git log --oneline | head -5
af5d2ec 공변세포 치수를 자료로 채우고, 광학 설계 두 곳을 정정한다
5832b69 설계 세 편 (광학·규칙·탐구 노트) + 엔진의 여섯 개 한계 수정
f8aa949 광학 검산으로 규칙 설계의 예시 숫자 두 곳을 판정
441fe2f 규칙 설계 검토 — 좋은 것과 고칠 것
bdb2de0 바나나랩을 복제해 micrometer 로 출발한다

$ git status --short
 M src/sim/state.js
?? src/sim/scale.js

$ npm run check
ℹ tests 65 / pass 57 / fail 8
```

- `PROGRESS.md` 기준으로 **P1(설계) 진행 중**이다. T01 이후 구현이 시작되지 않았다.
- 지금 `npm run check` 가 **빨간불**이다. 실패 8건은 전부 미커밋 편집에서 온다 —
  `src/sim/state.js` 가 `optics.js` 에서 `umPerEyepieceDiv` 를 import 하는데 그 심볼이 아직
  없고, `src/sim/scale.js` 는 untracked 다. **작업 중인 상태의 빨간불이지 구조적 결함이 아니다.**
  (미커밋 변경이 있으므로 다른 세션이 지금 이 폴더에서 돌고 있을 수 있다. 읽기만 했다.)
- 테스트 수가 177 → 65 로 줄어 있는 것도 리팩터링 중이라는 신호다.

**판정:** 파일럿은 §2(복제 절차)를 **일반화 검증하는 데는 이미 성공했다** — 문서의 틀린 곳
두 군데를 실제로 찾아냈고 그중 하나는 반영됐다. 하지만 §0 이 걸어 둔 「초록불」 관문은
아직 통과하지 않았다. **웨이브 2 를 여는 시점은 사람이 결정할 일**이고, 여기서는
"관문이 아직 안 열렸다" 는 사실만 적는다.

---

## 6. 불편한 것 (annoyance) — 막지는 않는다

| | 내용 | 근거 |
|---|---|---|
| **A1** | `NEW-EXPERIMENT.md` §2 54~56줄의 「이 저장소는 비공개입니다」 경고가 **틀렸다.** 지금은 공개다. 세션이 첫 줄에서 멈춰 사람에게 권한을 묻게 된다 | §1 의 익명 클론 성공 |
| **A2** | §2 가 65줄에서 `rm -f LAUNCH.md` 로 지운 뒤, 83줄에서 「배정표는 `LAUNCH.md` §7 에 있습니다」라고 안내한다. **방금 지운 파일을 보라고 한다** | `NEW-EXPERIMENT.md` 65·83줄 |
| **A3** | centrifuge·germination 블록이 「`ROSTER.md` §6/§7 을 먼저 읽어라」고 하는데 §2 가 `ROSTER.md` 를 지운다. 핵심 내용은 블록에 요약돼 있어 치명적이지는 않다 | `LAUNCH.md` 191·215줄 |
| **A4** | `LAUNCH.md` 57줄이 `(§9)` 를 가리키는데 **`LAUNCH.md` 에 §9 가 없다** (§8 로 끝난다) | `grep '^## ' LAUNCH.md` |
| **A5** | 파일럿의 「확정 안 된 값은 자리표시자로」 교훈이 `LAUNCH.md` 에만 있어 어느 세션에도 안 닿는다 | §5 참조 |
| **A6** | 클론이 바나나의 `tasks/T01-state-machine.md` ~ `T19-PROMPT.md` 와 `docs/00~08` 을 그대로 들고 온다. 그런데 `NEW-EXPERIMENT.md` §6 은 「`tasks/` 에 T01~T10 카드를 만들라」고 한다 — **파일명이 충돌한다.** 파일럿은 `DESIGN-*.md` 라는 딴 이름을 써서 피해 갔고, `micrometer-lab/tasks/` 에는 지금 바나나 카드 열두 개가 그대로 남아 있다. 치우라는 말이 어디에도 없다 | `ls onion-lab/tasks/`, `ls micrometer-lab/tasks/` |
| **A7** | 클론의 `package.json` 이 `"name": "banana-lab"`, `"description": "바나나에서 탄수화물과 지질 관찰하기…"` 그대로다. `NEW-EXPERIMENT.md` §3 의 갈아 끼울 목록에도 `PLAYBOOK.md` §11 목록에도 없다 | `cat onion-lab/package.json` |
| **A8** | `check-build.mjs`·`check-ui.mjs`·`shot.mjs` 는 playwright 모듈이 없으면 **`process.exit(0)`** 으로 조용히 통과한다. 이 저장소가 가장 싫어하는 「초록불 착각」의 형태다. (`check-bench.mjs` 는 그런 가드가 없어 제대로 터진다.) 이 기계에서는 브라우저가 전역 캐시에 있어 실제로 겪지 않았다 | `scripts/check-build.mjs:26~29` 등 |
| **A9** | fermentation 블록이 catalase 의 변인 UI 를 참고하라고 하는데 **경로가 없다.** §5 의 채점 홀드아웃 교차 배정(A↔B 짝)도 어디에도 안 적혀 있다 | `LAUNCH.md` 166줄, §5 |

---

## 7. 확인하지 못한 것

짐작으로 채우지 않고 그대로 적는다.

- **`[검증]` 다섯 건의 과학적 사실** — 시약 농도·반응식·색소 전개율 순서·희석 비율·혈액 층
  순서. 이건 사람이 교과서를 펴서 확인할 일이라 감사 범위 밖이다. **B3 로 남긴다.**
- **웨이브를 실제로 일곱 개 띄웠을 때의 부하** — 클론 두 벌까지만 동시 실행해 봤다.
  일곱 개 × 서브에이전트 2~3개(= 에이전트 14~21개)의 메모리·CPU 는 재지 않았다.
  크로미엄 두 개 동시 실행은 문제 없었다.
- **Supabase 실제 통신** — `.env` 가 비어 있어 제출 기능은 꺼진 상태로만 돌았다.
  공유 프로젝트에서 실험 두 개의 제출이 실제로 어떻게 섞이는지는 **코드와 스키마를 읽어
  판단했을 뿐 실행해 보지 않았다** (§3 ②).
- **`npm run build` / `check-build.mjs` / `perf-fov.mjs`** — 돌리지 않았다.
  `npm run check` 와 `check-bench.mjs` 까지만 실측했다.
- **micrometer 의 빨간불 8건이 정말 작업 중이라서인지** — 미커밋 변경을 되돌려 확인하지
  않았다. 남의 세션 작업 파일이라 손대지 않았다. import 하는 심볼이 없다는 에러 모양으로
  판단했다.

---

## 8. 열기 전에 할 일 (요약)

1. **B1** — `NEW-EXPERIMENT.md` §2 의 `git init` 다음 줄에 `git config user.email …` 을 넣는다
2. **B2** — `LAUNCH.md` §2 의 일곱 블록에 복제 명령 · `DEV_PORT` 숫자 · 공통 규칙 열두 줄을 **펼쳐서** 박는다
3. **B3** — `[검증]` 다섯 건을 사람이 확인하고 표시를 지운다 (웨이브 2 셋이 여기 다 있다)
4. **B4** — 파일럿을 초록불까지 밀거나, §0 의 관문을 의식적으로 낮춘다
5. (덤, 각 한 줄) **A1** 비공개 문구 삭제 · **A2** 포트 배정표를 `NEW-EXPERIMENT.md` 안으로 옮김 ·
   **A5** 자리표시자 규칙을 §7 함정 목록 9번으로 · **A6** `tasks/` 정리 안내
