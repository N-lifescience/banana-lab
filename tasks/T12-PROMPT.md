# T12 애셋 프롬프트 — 개수대 · 쓰레기통 2종

아래 내용을 **그대로 복사해서** 애셋을 만들 에이전트(Antigravity 등)에게 붙여 넣으세요.
계약·등록·상호작용 코드는 이미 다 붙어 있습니다. **그림만 갈아 끼우면 됩니다.**

---

## 붙여 넣을 프롬프트

banana-lab 저장소에서 SVG 애셋 **2종의 그림을 다시 그린다.**

`src/assets/sink.js` 와 `src/assets/bin.js` 가 이미 있고, 계약을 지키는
**자리표시(placeholder) 그림**이 들어 있다. 형태만 제대로 그려서 교체하는 것이 이 일이다.
파일을 새로 만들지 말고 그 두 파일의 `render()` 안쪽 SVG 를 고쳐라.

### 읽을 파일 — 이 여섯 개만

1. `docs/01-art-direction.md` — 아트 디렉션. **반드시 먼저 읽는다.**
2. `docs/02-asset-contract.md` — id 규약과 상태 반영 방식
3. `src/style/tokens.js` — 쓸 수 있는 색과 선 두께의 전부
4. `src/assets/banana.js` — 본보기. 이 수준의 밀도로 그린다
5. `src/assets/waste.js` — 폐액통. 쓰레기통과 나란히 놓이므로 톤을 맞춘다
6. `src/assets/contract.js` — `sink` 와 `bin` 항목

**`src/render/fov.js` 는 읽지 마라.** 그 파일은 아트 디렉션의 예외라서
따라 쓰면 규칙이 오염된다.

### 만들 것

**1. 개수대 (`src/assets/sink.js`)**

실험실 개수대다. 학생이 받침 유리를 여기에 대면 씻어서 처음 상태로 되돌린다.

- 스테인리스 싱크볼 + 수도꼭지 + 배수구가 보여야 한다
- 실물 폭 500 mm (`realSizeMm`). 실험대 위에서 현미경(340 mm)보다 넓게 보인다
- 상태는 `water` 하나 (0~1). 물이 흐르는 중이면 1

**2. 쓰레기통 (`src/assets/bin.js`)**

**폐액통(`waste.js`)과 다른 물건이다.** 이쪽은 액체가 아니라 **고형 폐기물**을 버린다 —
한 번 쓴 덮개 유리 같은 것. 나란히 놓이므로 한눈에 구별돼야 한다.
폐액통은 액체가 담긴 투명한 통이고, 이쪽은 뚜껑 달린 불투명한 통이다.

- 실물 높이 320 mm (`realSizeMm`)
- 상태는 `fill` 하나 (0~1). 안에 버린 것이 있으면 1

### 절대 바꾸지 말 것

- **`viewBox` 는 `0 0 400 300` 고정.** 다른 값을 쓰면 같은 선 두께가 다르게 렌더된다.
- **`NODES` 배열과 id.** 코드가 이 id 로만 그림을 건드린다.
  - `sink.js` → `#basin`, `#basin-shade`, `#faucet`, `#water`
  - `bin.js` → `#trash`, `#trash-shade`, `#trash-fill`
  - `#water` 와 `#trash-fill` 의 **`opacity` 만** 코드가 바꾼다. 그 그룹이 사라지면 상태가 안 보인다.
- **`export` 목록** — `NODES`, `render(state)`, `applyState(root, state)` 셋 다 남긴다.
- `src/assets/contract.js` 는 손대지 않는다. 이미 맞게 적혀 있다.

### 지킬 규칙 (린터가 기계로 검사한다)

- 색은 `src/style/tokens.js` 의 `PALETTE` 값만. **새 색을 만들지 마라.**
  필요하면 멈추고 사람에게 물어라.
- 선 색은 `INK` 하나. 선 두께는 `STROKE.outline(3) / .detail(2) / .hair(1.5)` 셋뿐.
- `<linearGradient>`, `<radialGradient>`, `<filter>`, `feGaussianBlur` **금지.**
- 광원은 좌상단 45° 고정. 음영 도형은 광원 반대쪽 — 형태의 **우측·하단·우하단**에 온다.
  좌측이나 상단에 음영을 두지 않는다.
- 바닥에 닿는 접지 그림자는 `GROUND_SHADOW` 를 쓴다.

### 끝났는지 확인하는 법

```bash
npm run check:art -- sink
npm run check:art -- bin
```

둘 다 **"위반 없음"** 이 나와야 한다. 하나라도 걸리면 고칠 때까지 끝난 게 아니다.

그다음 눈으로 확인한다.

```bash
npm run dev
```

브라우저에서 **`http://localhost:5173/harness.html`** 을 연다.
「**애셋 시트 — 전 종 대조**」 절에 전 애셋이 한 줄로 늘어서 있다.
새로 그린 둘을 나머지와 대조해서 아래를 본다.

- 선 두께가 눈으로 같아 보이는가
- 음영이 전부 우하단 쪽에 있는가
- 폐액통과 쓰레기통이 한눈에 구별되는가
- 라이트 모드와 다크 모드 양쪽에서 확인했는가 (브라우저/OS 설정을 바꿔서)

### 하지 않을 것

- 다른 애셋 파일을 고치지 마라
- `src/ui/`, `src/sim/`, `src/render/` 는 건드리지 마라 — 상호작용은 이미 붙어 있다
- `PALETTE` 에 색을 추가하지 마라
- `npm run check` 가 실패한 상태로 끝내지 마라

---

## 사람이 알아 둘 것 (프롬프트에 포함하지 않음)

- 지금 들어 있는 자리표시 그림도 린터를 통과하고 실험대에서 정상 동작한다.
  그림이 안 와도 앱은 돌아간다. 급하지 않다.
- `src/assets/index.js` 의 `PENDING = ['sink', 'bin']` 이 "아직 자리표시" 라는 표시다.
  그림이 들어오면 그 배열을 비운다. `npm run check:art` 가 그때까지 안내를 띄운다.
- 그림이 바뀌어도 `realSizeMm` 은 그대로다 — 실험대 위 크기는 그 값으로만 정해진다
  (`docs/02`). 그림을 크게 그린다고 화면에서 커지지 않는다.
