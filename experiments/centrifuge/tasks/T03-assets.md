# T03 — 애셋 + 하네스

## 만들 것

| 이름 | 무엇 | `realSizeMm` |
|---|---|---|
| `rotor` | 완성된 회전판 + 끈 + 링. **모세관을 수평으로 문다** | |
| `capillary` | 모세관 — 빈 것 · 혈액 · 분리된 층 | |
| `clay` | 고무찰흙 덩이 | |
| `lancet` | 채혈침 (가상) | |
| `finger` | 손끝 — 소독 전/후, 핏방울 | |
| `swab` | 소독솜 | |
| `ruler` | 자 | |
| `capbox` | 모세관 통 (헤파린 / 민무늬) | |
| `sharpsbin` | 손상성 폐기물 통 | |

`bench` · `sink` · `tissue` · `waste` · `bin` 은 바나나랩 것을 그대로 쓴다.
**`banana` · `slide` · `coverslip` · `coverbox` · `slidebox` · `dropper` · `forceps` ·
`microscope` · `dish` · `bottle` 은 `index.js` 에서 뺀다.**

## 규칙

- 색 2단 + 외곽선 3px. 그라데이션·필터·블러 금지. 광원 좌상단 45°.
- **결과색(적혈구층 암적색 · 연층 회백색 · 혈장 담황색)을 기구에 쓰지 않는다.**
  `tests/palette.test.js` 가 그린 SVG 를 훑어 기계로 막는다.
- `harness.html` · `src/harness.js` 의 손잡이를 이 실험 것으로 간다.
  **바나나 상태를 읽어 지금은 열면 죽는다.**

## 검증

```bash
npm run check:art
node --test tests/assets.contract.test.js tests/palette.test.js
npm run dev   # /harness.html 이 열리는지 눈으로
```
