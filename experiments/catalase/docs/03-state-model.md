# 03 · 상태 모델

`src/sim/state.js`. **이 파일은 DOM 을 모른다** — `document`·`window`·`Date.now()`·`Math.random()`
을 쓰지 않는다. 그 경계 덕분에 `node --test` 로 규칙 전체를 브라우저 없이 검증할 수 있다.

상태는 **`reduce()` 한 곳에서만** 바뀐다. 화면 코드가 상태를 직접 대입하면
되돌리기·기록·검증이 전부 무너진다.

---

## 네 덩어리

```
design    무엇을 바꾸고 무엇을 붙들어 둘 것인가  ← 이 실험의 몸통
bench     지금 실험대 위에 있는 것 (감자즙 · 원반 · 비커)
trials    기록한 시행들
session   난이도 · 시드 · 모드 · 노트 · 로그 · 되돌리기
```

### `design` — 변인 설계

```js
design: {
  independent: null,        // null | 'temp' | 'ph'   — 조작변인
  controls: {               // 통제변인의 **목표값**
    tempC: 20, ph: 7, h2o2Pct: 3, extractPct: 100, buffered: true,
  },
  declared: false,          // 「설계를 정했다」를 눌렀는가
}
```

**`declared` 는 표시이지 잠금이 아니다.** 설계를 안 하고 실험을 시작해도 막지 않는다.
설계 없이 얻은 값은 그래프에서 「무엇을 바꾼 시행인지 알 수 없음」으로 남는다.

`controls` 에 조작변인의 값도 그대로 들어 있다. 빼지 않는다 — 조작변인을 도중에 바꾸면
그 값이 다시 통제변인이 되고, 그때 앞 시행들과 비교할 근거가 살아 있어야 한다.

### `bench` — 지금 실험대 위

```js
bench: {
  extract: { pct: 100, boiled: false, ready: false },   // 만들어 둔 감자즙
  disc:    { punched: false, soakedPct: 0, soakedBoiled: false, held: false },
  beaker:  {
    h2o2Pct: null,        // null 이면 아직 안 부었다. **0 이 아니다**
    ph: 7, phMethod: 'none',   // 'none' | 'buffer' | 'acidbase'
    tempC: 20, inBath: false,
    cracked: false,       // 열 충격으로 깨졌는가
    disc: null,           // 넣은 원반 — { extractPct, extractBoiled }
    elapsedS: 0, floated: false, floatedAtS: null,
  },
}
```

**`h2o2Pct` 가 `null` 인 것과 `0` 인 것은 다르다.** 아직 안 부은 것과 물만 부은 것은
학생이 한 일이 다르므로, 화면이 다른 말을 해야 한다.

`disc.soakedPct` 는 **담근 감자즙의 농도**다. 0 이면 안 담근 원반이다.
**안 담근 원반도 비커에 넣을 수 있다.** 그러면 효소가 없어 안 뜨는데 —
**완충하지 않은 pH 11 에서는 그래도 뜬다.** 그것이 이 실험에서 가장 중요한 대조군이다
(`AGENTS.md` §2.5).

### `trials` — 기록한 시행

```js
{
  at: 0,                   // 한 번 붙으면 안 바뀌는 번호. 배열 인덱스가 아니다
  conditions: { tempC, ph, h2o2Pct, extractPct, buffered, extractBoiled },
  seconds: 25.0 | null,    // 안 떴으면 null. **큰 수로 두지 않는다**
  floated: true,
  offDesign: ['h2o2Pct'],  // 설계와 어긋난 통제변인의 목록. 빈 배열이면 설계대로다
  independent: 'temp',     // 그때의 조작변인. 도중에 바뀌면 시행마다 다를 수 있다
}
```

**`conditions` 를 통째로 담는다.** 그래프도, 탐구 노트도, 보고서도, 결과 보드도
전부 이 한 벌을 읽는다. 두 벌을 따로 만들면 어긋난다.

**`at` 은 순번이 아니라 한 번 붙으면 안 바뀌는 번호다.** 배열 인덱스로 지우면
앞엣것을 지운 순간 뒤엣것이 밀려, 그 시행에 딸린 노트가 남의 것이 된다.

### `session`

`level`, `seed`, `mode`, `step`, `notes`, `readStages`, `log`, `trialSeq`,
`history`, `undosLeft`.

> **`violations` · `tidy` 는 없다.** 바나나랩에는 있었는데 이 실험에서는 걷어냈다 —
> 안전 판정(지켰다/놓쳤다)을 없앴기 때문이다. 아래 04 의 「안전」 절을 보라.

---

## 파생값 — 저장하지 않고 그때그때 계산한다

| 함수 | 무엇 |
|---|---|
| `beakerConditions(beaker)` | 비커 상태 → `kinetics.js` 가 받는 조건 한 벌 |
| `offDesign(design, conditions)` | 설계와 어긋난 통제변인의 목록 |
| `isReady(beaker)` | 원반이 들어 있고 시간이 흐르고 있는가 |

**`beakerConditions` 가 이 실험의 `fieldParams` 다.** 비커 상태를 그림과 계산이
함께 읽는 한 벌로 좁히는 유일한 통로다. 여기를 거치지 않고 비커 상태를 직접 읽는 코드가
생기면, 조건을 하나 더할 때 두 곳이 어긋난다.

### 안 부은 비커의 조건

`h2o2Pct` 가 `null` 이면 `beakerConditions` 는 `0` 을 준다. 그러면 발생 속도가 0 이라
원반이 영원히 안 뜬다 — **막을 필요가 없다.** 빈 비커에 원반을 넣는 것은
물리적으로 성립하는 일이고, 아무 일도 안 일어나는 것이 답이다.

---

## 난이도

```js
UNDO_LIMITS = { 1: Infinity, 2: 3, 3: 1 }
```

1단계는 **통제변인의 기본값을 채워 놓고 시작한다.** 조작변인은 채우지 않는다 —
그걸 고르는 것이 이 실험의 배울 것이라, 대신 골라 주면 실험 자체가 사라진다.

## 혼자 / 모둠

```js
MODES = { SOLO: 'solo', GROUP: 'group' }
```

활동지가 갈린다. 혼자 하는 학생에게 「다른 모둠의 결과와 비교해 보세요」를 물으면
답할 수 없는 것을 묻는 셈이고, 빈칸으로 남은 문항은 「못 한 일」로 읽힌다.
