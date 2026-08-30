# T09 — 보고서 · 개인정보처리방침 제2조

## 방침을 고치기 전에 **보내는 것부터 줄인다**

활동지에 실리지도 않는 것을 보내 놓고 방침에 적는 것은 고지가 아니라 **수집**이다.
`payloadOf()` 가 지금 무엇을 내는지 **먼저 찍어 본다.**

`payloadOf()` 는 **「보낼 것만 적는」 허용 목록**이어야 한다.
「빼야 할 것을 빼는」 방식(`const { history, ...session } = st.session`)은
상태에 칸이 하나 생길 때마다 조용히 새어 나간다 — 바나나랩에서 `session.log` 가 그랬다.

줄여도 되는 근거는 **기계가 확인한다.** 선생님 화면은 받은 값으로 `buildSheet()` 을
다시 돌리므로, 줄인 것만으로 같은 종이가 나오면 그것이 전부다:

```js
assert.equal(buildSheet(payloadOf(st, who, kind).state, who, kind),
             buildSheet(st, who, kind));
```

## 제2조는 **실제로 보내는 것과 정확히 같아야 한다**

`tests/privacy.test.js` 가 `privacy.html` 의 `data-sends` 와 `payloadOf()` 의 키를
**양방향으로** 맞대 본다.

- 안 받는 것을 받는다고 적은 것도 틀린 고지다.
- 받는 것을 안 적은 것도 틀린 고지다.

## 보고서

이름·학번은 보고서를 만들 때만 받는다. `store` 에도 `localStorage` 에도 넣지 않고,
인쇄가 끝나면 지운다. `tests/report.test.js` 가 소스에서 `dispatch`·`localStorage`·`fetch`
를 막고 있다.

## 검증

```bash
node --test tests/privacy.test.js tests/report.test.js
```
