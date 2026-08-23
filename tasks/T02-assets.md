# T02 · 애셋 11종

## 목표

애셋은 모두 11종이다. `src/assets/banana.js` 가 참조 구현이므로 새로 만들 것은 10종이다.
전부 **라인 + 플랫**, 전부 계약 준수, 전부 린터 통과.

## 먼저 읽을 것

- `docs/01-art-direction.md` — **규칙 9개 전부**
- `docs/02-asset-contract.md` — id 규약, 새 애셋 만드는 순서
- `src/assets/banana.js` — 참조 구현
- `src/style/tokens.js` — 팔레트와 선 두께

## 건드릴 파일

```
src/assets/slide.js       (새로)
src/assets/coverslip.js   (새로)
src/assets/dropper.js     (새로)
src/assets/forceps.js     (새로)
src/assets/bottle.js      (새로)
src/assets/microscope.js  (새로)
src/assets/dish.js        (새로)
src/assets/waste.js       (새로)
src/assets/tissue.js      (새로)
src/assets/bench.js       (새로)
src/assets/index.js       (ASSETS 등록, PENDING 에서 제거)
src/style/tokens.js       (새 색이 꼭 필요할 때만)
```

## 에이전트에게 읽힐 파일

애셋 제작에 필요한 파일은 **여섯 개뿐**이다. 나머지를 읽히면 컨텍스트만 먹고 판단이 흐려진다.

| 순서 | 파일 | 왜 |
|---|---|---|
| 1 | `AGENTS.md` | §2.2 아트 디렉션은 린터가 강제 · §2.3 형태·스타일·상태 분리 |
| 2 | `docs/01-art-direction.md` | 규칙 9개. 이걸 안 읽으면 반드시 그라데이션을 넣는다 |
| 3 | `docs/02-asset-contract.md` | id 규약, 새 애셋 만드는 순서 |
| 4 | `src/style/tokens.js` | **팔레트의 유일한 출처.** 문서에는 색값을 복사해 두지 않았다 |
| 5 | `src/assets/banana.js` | 참조 구현. 구조를 그대로 따른다 |
| 6 | `src/assets/contract.js` | 만들 애셋의 노드 선언 (해당 항목만 봐도 된다) |
| 7 | `tasks/T02-assets.md` | 이 카드 |

### 절대 읽히면 안 되는 파일

- **`src/render/fov.js`** — 시야 렌더러에는 아트 디렉션이 적용되지 않는다.
  `rgba()`, `<pattern>`, `<filter>` 를 쓰고 있어서, 이 파일을 본 에이전트는
  "여기선 되네" 하고 애셋에도 따라 쓴다. **가장 흔한 오염원이다.**
- `docs/03` ~ `docs/08` — 상태 모델·규칙·노트·배포. 애셋 제작과 무관하다.

## 병렬화

애셋끼리 독립적이라 서브에이전트로 나눠 돌리기 좋다.

- 각 에이전트는 **자기 애셋 파일 하나만** 만든다
- 검증은 단일 애셋 모드로 한다. 등록 없이도 검사된다:
  ```bash
  npm run check:art -- slide
  ```
- `src/assets/index.js` 와 `SAMPLE_STATES` 는 **작업자 본인이 마지막에 한 번만** 수정한다.
  병렬 에이전트가 각자 등록하면 여기서 충돌한다
- 완료 조건을 `npm run check:art -- <이름>` 통과로 못 박는다

## 각 애셋의 요점

| 애셋 | 형태 요점 | 상태로 바뀌는 것 |
|---|---|---|
| slide | 가로로 긴 유리판. 모서리 둥글게 | 시료 얼룩 색·불투명도, 덮개 유리 회전, 기포 주입 |
| coverslip | 정사각 유리. 살짝 기울여 배치 | 각도 |
| dropper | 고무 캡 + 유리관. 관 안 액체 기둥 | 액체 색·높이, 끝의 방울 |
| forceps | 두 날이 위에서 붙고 아래로 모임. 날 폭은 넉넉히 | 벌어짐, 집은 물체 |
| bottle | 각진 시약병 + 마개 + 라벨 | 액체 색·잔량, 마개 열림 |
| microscope | 측면도. 받침·팔·재물대·회전판(대물 3개)·경통·접안·나사 2개·광원 | 회전판 각도, 나사 회전, 조리개, 재물대 슬라이드 |
| dish | 얕은 원형 접시 (측면) | 안에 놓인 물건 |
| waste | 폐액통 | 액체 높이 |
| tissue | 휴지 상자 | 뽑힌 장 |
| bench | 실험대 상판 + 선반 | 없음 (배경) |

## 하지 말 것

- 그라데이션, 블러, 팔레트 밖 색, 임의 선 두께 — 린터가 잡지만 애초에 쓰지 말 것
- 음영을 좌상단에 두지 말 것. 광원이 좌상단이므로 음영은 **우하단**이다
- `Math.random()` 금지. 난수가 필요하면 `geometry.js` 의 `rng(seed)`
- 직선적인 기구까지 `geometry.js` 의 중심선 방식으로 짜내지 말 것. 패스 문자열이 낫다

## 합격 기준

- [ ] 10종 모두 `render()` / `applyState()` / `NODES` 를 내보낸다
- [ ] `src/assets/index.js` 의 `PENDING` 이 비었다
- [ ] `SAMPLE_STATES` 에 애셋마다 3개 이상 상태가 있다
- [ ] `npm run check:art` 위반 0건
- [ ] 하네스에서 11종이 모두 보이고, 상태 슬라이더가 그림을 바꾼다 (눈으로 확인)
- [ ] 라이트/다크 양쪽에서 확인했다

## 검증

```bash
npm run check
npm run dev            # 다른 터미널
npm run shot -- '#asset-sheet' assets
```
