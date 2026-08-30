# T09 — 보고서 · 개인정보처리방침

## 목표
보고서는 인쇄용 종이 한 장. 방침 제2조는 **실제로 보내는 것과 정확히 같다.**

## 지킬 것
- 이름·학번은 **인쇄할 때만** 받고 `store` 에도 `localStorage` 에도 넣지 않는다
- `privacy.html` 의 `data-sends` 와 `payloadOf()` 의 키를 **양방향으로** 맞댄다.
  한쪽만 늘어도 빨간불이다 — 안 받는 것을 받는다고 적는 것도 틀린 고지다
- 방침에 이 실험에 **없는** 기구 이름이 남아 있지 않다

## 검증
```bash
node --test tests/privacy.test.js
node --test tests/report.test.js
```
