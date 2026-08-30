# T02 · 애셋

## 목표

바나나랩에서 물려받은 애셋 15종 중 **이 실험에 없는 것을 빼고, 없는 것을 만든다.**

## 먼저 읽을 것

- `docs/01-art-direction.md` — 애셋을 만들거나 고칠 때 **반드시**
- `docs/02-asset-contract.md` — id 규약, 상태 반영 방식
- `AGENTS.md` §2.2 · §2.3

## 건드릴 파일

```
src/assets/contract.js          노드 계약 — 그림보다 먼저
src/assets/onion.js             새로 만든다
src/assets/filterpaper.js       새로 만든다
src/assets/blade.js             새로 만든다
src/assets/bottle.js            증류수 · 설탕 용액 4종으로 갈아 끼운다
src/assets/slide.js             시료가 「표피 조각」이 되고, 반응색 대신 액포색
src/assets/banana.js            지운다
src/assets/index.js             등록 목록
src/style/palette.experiment.js 이 실험의 색
tests/assets.contract.test.js
```

## 그대로 쓰는 것

`slidebox` · `coverslip` · `coverbox` · `dropper` · `forceps` · `microscope` ·
`dish` · `waste` · `sink` · `bin` · `tissue` · `bench` — 손대지 않는다.

## 새로 만들 것

| 이름 | 무엇 | 상태 노드 |
|---|---|---|
| `onion` | 적양파 비늘잎 한 조각 | `cut`(칼집) · `peeled`(벗긴 정도) · `side`(바깥/안쪽) |
| `filterpaper` | 거름종이 — 덮개 유리 반대쪽에 대는 것 | `wet`(젖은 정도) |
| `blade` | 칼집을 내는 해부칼 | 없음 (모양만) |

`onion` 은 **바깥쪽 면이 보라색, 안쪽 면이 옅다**는 것이 그림에서 읽혀야 한다.
학생이 어느 면을 벗기는지 고르는 조작이 여기에 걸려 있다.

## 색

이 실험의 색은 **전부** `src/style/palette.experiment.js` 의 `EXP_PALETTE` 에 넣는다.
`src/style/tokens.js` 는 **수정하지 않는다** (합칠 때 diff 가 0 이어야 한다).

필요한 색:

- 적양파 겉면 보라 · 안쪽 면 옅은 색
- 액포 안토시아닌 색 (시야 렌더러와 `slide` 애셋이 공유)
- 설탕 용액 — **농도가 달라도 눈으로는 다 무색이다.** 병에 색을 칠해 구분하지 말고
  **이름표**로 구분한다. 색으로 구분해 두면 "진한 용액은 진한 색" 이라는 틀린 것을 가르친다

`EXP_PALETTE.water`(증류수) 는 이미 있다. 실제 증류수는 무색이지만 선반의 병이 비어
보이고 스포이트에 무엇이 들었는지 알 수 없어 밝은 하늘색을 쓴다 — 그 판단은 그대로 쓴다.

## 하지 말 것

- 그라데이션 · 필터 · 블러 (린터가 잡는다)
- `tokens.js` 수정
- 반응색(액포색)을 **기구**에 쓰기 — 결과 색과 헷갈린다
- 코드가 패스 좌표를 만드는 것. **약속된 노드의 속성만** 바꾼다
- 설탕 용액 병마다 다른 색 칠하기 (위 참조)

## 합격 기준

- [ ] `npm run check:art` 위반 0건
- [ ] `npm run check:art -- onion` 처럼 단독 검사도 통과한다
- [ ] `banana` 가 `index.js` · `contract.js` · `SAMPLE_STATES` 어디에도 없다
- [ ] 하네스 애셋 시트에서 **옆 칸과 견주어** 선 두께 · 음영 방향 · 크기 감각이 맞는다 (눈)
- [ ] 라이트/다크 양쪽에서 확인 (눈)
- [ ] `EXP_PALETTE` 에 없는 색을 애셋에 넣어 **린터가 실제로 잡는지** 되돌려 확인했다

## 검증

```bash
npm run check:art
npm run dev   →   http://localhost:5173/experiments/osmosis/harness.html    # 애셋 시트
npm run shot -- '#sheet' assets-sheet
```

## 서브에이전트로 돌릴 때

애셋마다 독립적이라 병렬로 돌리기 좋다. 프롬프트 형식은 `docs/banana-tasks/T02-PROMPT.md`.
**읽힐 파일을 여섯 개로 제한**하고 `src/render/fov.js` 는 **읽히지 말 것** —
그 파일은 아트 디렉션 예외라 따라 쓰면 애셋이 오염된다.
