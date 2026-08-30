# T00 — 이름표를 이 실험 것으로 갈아 끼운다

**제일 먼저, 한 번에 한다** (`NEW-EXPERIMENT.md` §3.0).
여기를 안 갈면 그 뒤로 읽고 판단하는 것이 전부 틀린 전제 위에 선다.

## 목표

저장소 어디를 열어도 「발아 중인 콩의 물질대사 — 대조 실험」이 보이게 한다.
`/harness.html` 이 열린다 (지금은 바나나 상태를 읽어 **열자마자 죽는다**).

## 건드릴 파일

| 파일 | 무엇을 |
|---|---|
| `README.md` | 이 실험이 무엇이고 무엇을 가르치는지 |
| `CLAUDE.md` | 포트 5180 · 이 실험의 핵심 상수 · 자주 틀리는 것 셋 |
| `AGENTS.md` §1 · §2.4 · §2.5 | 이 프로젝트가 무엇인가 · 물리 상수 · 과학적 사실 |
| `index.html` · `teacher.html` · `privacy.html` | `<title>` · `og:title` · `og:description` |
| 〃 | **`canonical` · `og:url` 은 아예 뺀다** — 바나나랩 배포 주소를 물려받고 있다 |
| `privacy.html` | 본문 첫 줄(부제)과 제1조의 「슬라이드 상태」 |
| `src/ui/strings.js` | `appTitle` 만. 나머지는 뒤 카드에서 |
| `harness.html` · `src/harness.js` | 손잡이를 이 실험 것으로 |
| `tests/pages.test.js` | `OTHER_MATERIALS` — 이 실험에 **없는** 재료 낱말 |
| `tests/privacy.test.js` | `OTHER_WORDS` — 같은 이유 |

`privacy.html` 제2조(`data-sends`)는 **T06 에서** 실제 payload 와 맞춘다. 지금은 손대지 않는다 —
상태 스키마가 아직 없으므로 지금 고치면 두 번 고친다.

## 합격 기준

- [ ] `npm run check` 통과
- [ ] `npm run dev` 후 `http://localhost:5173/experiments/germination/harness.html` 이 **콘솔 에러 0건**으로 뜬다
- [ ] 배포되는 세 페이지에 `banana-inquiry-based-virtual-lab` 주소가 없다
- [ ] 세 페이지의 `<title>` 이 전부 `UI.appTitle` 을 담는다

## 검증

```bash
npm run check
node --test tests/pages.test.js
npm run dev   # /harness.html 을 눈으로 연다
```

## 되돌려 보기

`tests/pages.test.js` 는 **양방향으로** 본다.
- `index.html` 의 `<title>` 을 바나나로 되돌려 → 빨간불이 나야 한다
- `<link rel="canonical" href="https://germination-....vercel.app/">` 처럼 **자기 주소**를
  넣어 보고 → **초록불이어야 한다.** 자기 주소에 빨간불이 나면 배포하는 날 지워지는 것은 검사다.
- 확인이 끝나면 되돌린다. **되돌리기 전에 먼저 커밋한다.**
