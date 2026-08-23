# T02 애셋 — 에이전트에게 붙여넣을 프롬프트

Antigravity, Claude Code 서브에이전트, Cursor 어디에 붙여도 된다.
`<이름>` 자리에 만들 애셋 이름(`slide`, `dropper`, `microscope` …)을 넣는다.

---

## 붙여넣기용

```
banana-lab 저장소에서 SVG 애셋 하나를 만든다: src/assets/<이름>.js

먼저 이 파일들을 순서대로 읽어라. 다른 파일은 읽지 마라.

1. AGENTS.md                     — §2.2, §2.3 이 이 작업의 규칙이다
2. docs/01-art-direction.md      — 규칙 9개. 전부 지켜야 한다
3. docs/02-asset-contract.md     — id 규약과 제작 순서
4. src/style/tokens.js           — 팔레트의 유일한 출처. 여기 없는 색은 쓸 수 없다
5. src/assets/banana.js          — 참조 구현. 이 구조를 그대로 따른다
6. src/assets/contract.js        — <이름> 항목의 nodes 선언을 확인한다
7. tasks/T02-assets.md           — 애셋별 형태 요점 표

src/render/fov.js 는 절대 읽지 마라. 그 파일은 광학 시뮬레이션이라
아트 디렉션이 적용되지 않고, rgba() 와 <filter> 를 쓴다. 따라 쓰면 안 된다.

만들 것:
- src/assets/<이름>.js 하나만 만든다
- render(state) / applyState(root, state) / NODES 를 내보낸다
- contract.js 의 <이름> 항목에 선언된 required 노드를 전부, 각각 한 번씩 갖는다

지킬 것:
- 색은 PALETTE 값만. 새 색이 필요하면 만들지 말고 보고하고 멈춰라
- 선은 INK 한 가지, 두께는 STROKE 의 3 / 2 / 1.5 중 하나
- <linearGradient> <radialGradient> <filter> feGaussianBlur 금지
- 광원은 좌상단 45°. 음영 도형은 항상 형태의 우하단
- Math.random() 금지. 난수는 geometry.js 의 rng(seed)
- src/assets/index.js 와 SAMPLE_STATES 는 건드리지 마라 (다른 작업자가 병합한다)

끝났다는 기준:
    npm run check:art -- <이름>
이 명령이 "위반 없음" 을 출력하고 종료 코드 0 이어야 한다.
위반이 나오면 메시지를 읽고 고친 뒤 다시 실행해라. 통과할 때까지 반복한다.

마지막에 보고할 것:
- 위 명령의 최종 출력
- SAMPLE_STATES 에 넣을 대표 상태 3~4개 (JS 객체 리터럴로)
```

---

## 병렬로 돌릴 때

10종을 한꺼번에 맡기지 말고, 성격이 비슷한 것끼리 묶어 3~4개 그룹으로 나눈다.

| 그룹 | 애셋 | 이유 |
|---|---|---|
| 유리 | slide, coverslip | 같은 유리 색·같은 반사 처리를 공유한다 |
| 손도구 | dropper, forceps, bottle | 학생이 집어 드는 물건. 크기 감각을 맞춰야 한다 |
| 현미경 | microscope | 혼자서도 크다. 부품 16개 |
| 배경 | dish, waste, tissue, bench | 조작 대상이 아니라 단순하다 |

그룹 안에서는 한 에이전트가 순서대로 만들게 한다. 그래야 유리 두 종의 색조가 어긋나지 않는다.

## 병합

모든 그룹이 끝나면 **본인이** 한 번에 처리한다.

1. `src/assets/index.js` 의 `ASSETS` 에 10종 등록, `PENDING` 배열 비우기
2. 각 에이전트가 보고한 대표 상태를 `SAMPLE_STATES` 에 넣기
3. `npm run check` — 전체 통과 확인
4. `npm run dev` 로 하네스에서 눈으로 확인

## 자주 나오는 실패

| 린터 메시지 | 원인 |
|---|---|
| 팔레트에 없는 채움색 | `#FFFFFF` 하이라이트를 넣었다. 팔레트의 밝은 톤을 쓰거나 하이라이트를 빼라 |
| 외곽선 색 "..." | 물체마다 다른 선색을 썼다. 전부 `INK` 다 |
| 선 두께 "1" | `1` 은 허용값이 아니다. 잔 디테일은 `1.5` |
| `<filter>` 사용 | 그림자를 블러로 넣었다. 접지 그림자는 `GROUND_SHADOW` 도형으로 |
| 계약 노드 #x 가 없습니다 | id 를 빠뜨렸다. `contract.js` 를 다시 보라 |
| viewBox "..." | 400×300 이 기본이다. 계약에 적힌 값을 쓴다 |
