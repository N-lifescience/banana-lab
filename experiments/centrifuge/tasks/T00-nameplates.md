# T00 — 이름표

## 왜 제일 먼저인가

복제본에는 바나나랩의 이름표가 그대로 있다. 여기를 안 갈면 **그 뒤로 읽고 판단하는 것이
전부 틀린 전제 위에 선다.** 앱 안 화면은 `src/ui/strings.js` 를 거쳐 검사에 걸리지만
**HTML 머리말만 그 그물 밖**이라, 검사가 전부 초록불인데 브라우저 탭에는 바나나가 뜬다.

## 건드릴 파일

| 파일 | 무엇을 |
|---|---|
| `README.md` | 이 실험이 무엇이고 무엇을 가르치는지 |
| `CLAUDE.md` | 포트(5179) · 이 실험의 핵심 상수 · 자주 틀리는 것 셋 |
| `AGENTS.md` §1 · §2.4 · §2.5 | 이 프로젝트가 무엇인가 · 물리 상수 · 과학적 사실 |
| `package.json` `description` | |
| `index.html` · `teacher.html` · `privacy.html` | `<title>` · `og:title` · `og:description` |
| `privacy.html` 본문 첫 줄 | 실험 이름 |
| `src/ui/strings.js` `appTitle` | 나머지 문자열은 T07 에서 |
| `tests/pages.test.js` `OTHER_MATERIALS` | 이 실험에 **없는** 재료 낱말로 |
| `tests/privacy.test.js` `OTHER_WORDS` | 같은 원칙 |
| `src/net/supabase.js` | `createClass({ exp = 'centrifuge' })` |
| `dorms-check.config.json` | 바나나랩 배포 주소 |

## 합격 기준

- `canonical` 과 `og:url` 은 **아예 뺀다.** 배포 주소가 정해지면 그때 넣는다.
  틀린 주소는 없는 주소보다 나쁘다 — 검색엔진에 「이 페이지는 저 사이트의 사본」이라고 말한다.
- `OTHER_MATERIALS` 에서 **원심분리 · 적혈구 · 버피코트**를 뺀다. 이 실험에는 있는 말이다.
  대신 다른 실험의 말(삼투 · 엽록소 · 카탈레이스 …)을 남긴다.
- 「자기 배포 주소를 넣어도 통과하는가」를 실제로 넣어 보고 확인한다 (양방향).

## 검증

```bash
node --test tests/pages.test.js
npm run check
```
