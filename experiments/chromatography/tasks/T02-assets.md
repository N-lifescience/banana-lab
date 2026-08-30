# T02 · 애셋 7종 · 팔레트 · 하네스 갈아 끼우기

## 목표

바나나랩의 현미경 기구를 걷어 내고 이 실험의 기구를 그린다. 애셋마다 독립적이라
**병렬로 돌리기 좋다** — 붙여 넣을 프롬프트의 본은 `docs/banana-tasks/T02-PROMPT.md`.

## 새로 그릴 것 (7종)

| 이름 | 무엇 | `realSizeMm` | 상태 |
|---|---|---|---|
| `leaf` | 시금치 잎 | `[확인 필요]` — 출처 없이 지어내지 말 것 | `fresh` (신선/시듦) |
| `tube` | 원심관 | `[확인 필요]` | `leaf` · `extract` · `settleT`(층 분리) |
| `paper` | 거름종이 스트립 | **100** (2 × 10 cm 의 긴 변) | `origin` · `spots` · `wet` · `torn` |
| `capillary` | 모세관 | `[확인 필요]` | `loaded` |
| `vial` | 바이알 | `[확인 필요]` | `depth` · `capped` · `hasPaper` |
| `pencil` | 연필 | `[확인 필요]` | — |
| `ruler` | 자 | `[확인 필요]` | — |

`realSizeMm` 은 실험대에서의 화면 크기를 정한다. **확인 못 한 값을 지어내면 물건이 서로
가리고, 화면에서는 안 보인다** (`PLAYBOOK.md` §3). 출처가 없으면 `[확인 필요]` 로 적어 두고
사람에게 묻는다.

## 그대로 쓸 것

`bench` · `sink` · `bin` · `waste` · `tissue` · `dish` · `bottle`(추출액병·전개액병 두 상태)

## 지울 것

`banana` · `slide` · `coverslip` · `coverbox` · `slidebox` · `dropper` · `forceps` ·
`microscope`. `src/assets/index.js` 의 등록도 함께 뺀다 — **안 빼면 아트 시트와 린터가
계속 남의 그림을 검사한다.**

## 팔레트 (`src/style/palette.experiment.js`)

`src/style/tokens.js` 는 **수정하지 않는다.** 이 실험의 색은 전부 `EXP_PALETTE` 에 넣는다.

```
carotene      주황     ┐
xanthophyll   노랑     │ 색소 네 가지 — 결과색이다
chlorophyllA  청록     │ 「청녹」이 아니다. a 가 청록, b 가 황록
chlorophyllB  황록     ┘
extract       추출액 (메탄올:아세톤 3:1)
devSolvent    전개액 (석유에터:아세톤 9:1)
pigmentJuice  상층액 — 짙은 초록
```

- **색소 네 색을 기구에 쓰지 않는다.** 결과와 헷갈린다. → **검사로 못 박는다**
  (`src/assets/*.js` 에 네 색의 hex 가 나오면 실패). 되돌려서 실제로 실패하는지 확인할 것
- 상층액 초록과 엽록소 b 황록은 **채도·밝기를 충분히 벌린다** — 원심관과 띠가 같은 색이면
  화면이 결과를 먼저 말해 버린다

## 하네스 (`harness.html` · `src/harness.js`) — **이 카드에서 같이 갈아 끼운다**

지금 하네스는 `banana.js` 를 직접 import 하고, 익은 정도·껍질 벗김·방울 수·반응 진행도를
읽는다. **`banana.js` 를 지우는 순간 `/harness.html` 이 TypeError 로 죽는다.**
깨뜨리는 카드에서 같이 고친다 — 파일럿에서는 이걸 한참 뒤에 알았고 그동안 하네스를 못 썼다.

갈아 끼울 손잡이:

```
찍은 횟수 · 원점 지름 · 전개액 깊이 · 전개 진행(전선 높이) · 뚜껑(차광) ·
시료 신선도 · 원점 표시 도구(연필/볼펜)
```

애셋 시트(전 종 대조)는 그대로 둔다 — **린터가 못 잡는 것**(시점·실루엣·상태가 눈에
보이는가)을 사람이 보는 유일한 자리다.

결과 렌더러 자리는 T03 이 채운다. 이 카드에서는 **자리표시**로 두어도 된다.

## 합격 기준

- [ ] `npm run check:art` 통과 — 애셋마다 `npm run check:art -- <이름>` 으로도 단독 통과
- [ ] 색소 네 색이 `src/assets/` 에 없다 (검사)
- [ ] `/harness.html` 이 **콘솔 에러 0건**으로 열리고 애셋 시트에 전 종이 나온다
- [ ] 라이트/다크 양쪽에서 확인했다
- [ ] `realSizeMm` 을 지어내지 않았다 — 모르는 것은 `[확인 필요]`

## 검증 명령

```bash
npm run check:art
npm run dev   # → http://localhost:5173/experiments/chromatography/harness.html  콘솔 에러 0건
```
