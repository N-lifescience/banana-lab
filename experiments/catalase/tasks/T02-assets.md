# T02 — 애셋: 이 실험의 기구

**상태: 끝남.** 무엇을 왜 그렇게 했는지는 `PROGRESS.md` 의 같은 번호 절에 있다.

스타일은 **라인 + 플랫**으로 확정돼 있고 린터가 강제한다. `docs/01-art-direction.md` 를
**반드시** 먼저 읽는다.

## 무엇을 만들고 무엇을 지우나

애셋 시트(`/harness.html` 아래쪽)에 지금 바나나·현미경·받침 유리가 남아 있다.
**안 쓰는 것은 `src/assets/index.js` 목록에서 뺀다** — 안 빼면 린터가 계속 남의 그림을 검사한다.

| 그대로 쓴다 | 새로 만든다 | 뺀다 |
|---|---|---|
| `forceps` 핀셋 | `beaker` 비커 (액체 높이·기포·원반) | `banana` |
| `bottle` 시약병 | `disc` 거름종이 원반 (젖음·기포·높이) | `slide` · `coverslip` |
| `dish` 실험 접시 | `filterpaper` 거름종이 + 펀치 | `coverbox` · `slidebox` |
| `sink` 개수대 | `waterbath` 수조 (온도 표시) | `microscope` |
| `waste` 폐액통 | `potatojuice` 감자즙 비커 | |
| `bin` 쓰레기통 | `stopwatch` 초시계 | |
| `bench` 실험대 | `hotplate` 가열판 (감자즙 끓이기) | |
| `tissue` 휴지 | | |
| `dropper` 스포이트 | | |

`realSizeMm` 는 **실물의 가장 긴 변**이다. 확실하지 않으면 `[확인 필요]` 주석을 달고 넘어간다.
화면 크기는 여기에만 비례해 정한다 — 애셋은 저마다 400×300 을 꽉 채워 그리므로
**그린 크기끼리 비교하면 안 된다.**

## 색

- 기구 색(`glass`, `metal`, `paper`, `bodyDark`, `rubber`, `bench`)은 `tokens.js` 공용을 `paint()` 로
- 이 실험의 색(과산화수소수·감자즙·완충 용액·산소 기포)은 **`src/style/palette.experiment.js`
  한 파일에만** 넣고 `paintExp()` 로 쓴다. **`tokens.js` 는 수정하지 않는다**
- **반응색을 기구에 쓰지 않는다.** 산소 기포 색이 실험대 어딘가에 있으면 결과와 헷갈린다

## 서브에이전트에 맡길 때

애셋마다 독립적이라 병렬로 돌리기 좋다. 프롬프트에 반드시 넣을 것:

- 읽을 파일을 **여섯 개로 제한**한다
- **`src/render/` 를 읽지 말라고 명시한다** — 아트 디렉션 예외라 따라 쓰면 오염된다
- 바꾸면 안 되는 것: `viewBox 400×300` · 노드 id · export 이름
- 완료 조건은 **돌아가는 명령**: `npm run check:art -- <이름>`
- **하네스 애셋 시트에서 옆 칸과 견주며** 고치라고 명시한다. 혼자 보면 안 된다

## 합격 기준

- [ ] `src/assets/contract.js` 에 노드 목록을 **먼저** 선언했다 (`realSizeMm`, `viewBox`, `states`, `nodes`)
- [ ] `npm run check:art` 통과. 그라데이션·필터·블러 0건, 선 두께는 셋뿐
- [ ] 코드가 패스 좌표를 만들지 않는다. **약속된 노드의 속성만** 바꾼다
- [ ] 애셋 시트에서 전 종을 나란히 보고 **시점·실루엣·상태가 눈에 보이는지** 사람이 확인했다
      (린터는 색과 두께만 본다)
- [ ] 라이트/다크 양쪽에서 확인했다
- [ ] `EXP_PALETTE` 에 없는 색을 애셋에 넣어 **린터가 실제로 잡는지** 되돌려 확인했다

## 검증 명령

```bash
npm run check:art -- beaker      # 등록 없이 단일 애셋만
npm run check                    # 전체
npm run dev                      # /harness.html 애셋 시트를 눈으로
```
