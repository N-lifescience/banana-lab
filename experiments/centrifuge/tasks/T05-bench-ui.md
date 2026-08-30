# T05 — 실험대 조작 UI

`src/ui/bench.js` 의 셋만 고친다 — `defaultItems()` · `dropTable()` · `tapTable()`.
배치는 손으로 적지 말고 **배치 편집 모드**(`/?edit=1`)에서 옮기고 「코드 복사」.

## 어포던스까지 이 카드에서

기능이 있는데 어포던스가 없으면 학생에게는 **없는 것과 같다.**
- 물건에 올리면 이름 + 지금 할 수 있는 조작
- 끄는 동안 놓을 수 있는 곳 강조
- 잡는 영역 최소 44 px, 판정도 같은 크기
- 포인터 이벤트만 듣지 않는다 — `click` 도 듣는다 (보조기기)

## 검증

```bash
node scripts/check-bench.mjs
node --test tests/bench.test.js
```
