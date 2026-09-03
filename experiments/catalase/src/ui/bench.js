/**
 * 실험대 — 배치와 집기/놓기.
 *
 * 물건이 실험대 어디에 놓여 있는지(좌표)는 결과에 영향을 주지 않는 표현일 뿐이라
 * 이 파일 안에서만 관리한다 (src/sim/ 에는 넣지 않는다).
 * 결과를 바꾸는 조작은 전부 store.dispatch() 를 거쳐 reduce() 로 간다.
 *
 * 포인터 이벤트로만 드래그를 구현한다 (pointerdown/move/up + setPointerCapture).
 * 잘못된 조작을 막지 않는다 — 어디에 무엇을 놓았는지만 보고 맞는 액션을 골라 보낸다.
 * 나머지는 reduce() 가 결과로 답한다.
 */

import { ASSETS } from '../assets/index.js';
import { CONTRACT, CONTENT_BOX, drawnBoxMm } from '../assets/contract.js';
import { PH_METHODS, isRunning, beakerConditions } from '../sim/state.js';
import { OBSERVE_LIMIT_S } from '../sim/kinetics.js';
import { renderBeaker } from '../render/beaker.js';
import { UI } from './strings.js';

/**
 * 실험대의 좌표계는 **밀리미터**다. 픽셀이 아니다.
 *
 * 배경(실험대 애셋)은 패널 크기에 맞춰 늘어나는데 도구를 고정 px 로 놓으면,
 * 창 크기가 바뀔 때 둘이 어긋나고 realSizeMm 비례도 한 크기에서만 성립한다.
 * 그래서 무대 전체를 실험대 실물 크기로 잡고, 크기와 위치를 모두 그 비율로 낸다.
 * 배경과 도구가 같은 자로 재어지므로 어느 창 크기에서도 비례가 유지된다.
 *
 * 실험대 폭 1500 mm, 배경 애셋 viewBox 가 4:3 이므로 높이는 1125 mm.
 */
const STAGE_W_MM = CONTRACT.bench.realSizeMm;          // 1500
const STAGE_H_MM = (STAGE_W_MM * 3) / 4;               // 1125

/**
 * 애셋의 실물 긴 변을 무대 폭에 대한 비율(%)로 바꾼다.
 * 실험대 위 크기는 반드시 이 함수 하나만 거친다 — 두 곳에서 따로 계산하면 어긋난다.
 */
export function widthPct(assetName) {
  return (CONTRACT[assetName].realSizeMm / STAGE_W_MM) * 100;
}

/** mm 좌표를 무대 비율(%)로 */
const xPct = (mm) => (mm / STAGE_W_MM) * 100;
const yPct = (mm) => (mm / STAGE_H_MM) * 100;

/** 애셋 그림의 세로/가로 비. 대부분 400×300 이고 바나나만 400×312 다. */
function aspect(assetName) {
  const [, , w, h] = CONTRACT[assetName].viewBox.split(/\s+/).map(Number);
  return h / w;
}

/** 화면에서 차지할 높이 (mm). 실물 긴 변 × 그림 비율. */
const heightMm = (assetName) => CONTRACT[assetName].realSizeMm * aspect(assetName);

/**
 * 배경 애셋(`src/assets/bench.js`, viewBox 400×300) 의 랜드마크를 mm 로 옮긴 것.
 * 물건은 허공이 아니라 이 높이에 **바닥을 대고** 선다.
 * 숫자를 바꾸려면 배경 애셋의 좌표를 먼저 보라 — 둘이 어긋나면 물건이 떠 보인다.
 */
const LANDMARKS = CONTRACT.bench.landmarks;
const SHELF_MM = (LANDMARKS.shelfTopY / 300) * STAGE_H_MM;      // 선반 상판 윗면
const SHELF2_MM = (LANDMARKS.shelf2TopY / 300) * STAGE_H_MM;    // 아래 선반 윗면
const SURFACE_MM = (LANDMARKS.surfaceFrontY / 300) * STAGE_H_MM; // 작업면 앞 모서리

const DRAG_THRESHOLD_PX = 6;

/**
 * 잡을 수 있는 최소 크기 (px). `.token::after` 가 화면에서 보장하는 값과 같아야 한다.
 * 덮개 유리는 실물 22 mm 라 그림이 아주 작은데, 놓기 판정을 그림 크기로 하면
 * 눈에 보이는 넓은 영역에 갖다 대도 아무 일이 안 일어난다 — 잡히지 않는 것처럼 보인다.
 */
const MIN_HIT_PX = 44;


/**
 * 실험 시간을 실제보다 몇 배 빠르게 흘리는가.
 *
 * 60 ℃ 조건은 원반이 뜨는 데 230 초 걸리고, 안 뜨는 조건은 관찰 시간 300 초를 다 기다려야
 * 「뜨지 않음」이 된다. 실제 시간으로 두면 화면 앞에서 5분을 보게 된다.
 *
 * 5 로 둔 것은 **가장 빠른 조건도 볼 수 있어야** 하기 때문이다 — 37 ℃ 는 8.2 초라
 * 10배로 흘리면 0.8 초 만에 끝나 무슨 일이 일어났는지 보이지 않는다.
 * 5배면 1.6 초에 뜨고, 300 초짜리도 1분이면 끝난다.
 *
 * **배속을 화면에 적는다** (`UI.bench.clock.speed`). 안 적으면 학생이 초를 잘못 읽는다.
 */
export const CLOCK_SPEED = 5;

/**
 * 문질러 바르기 — 받침 유리 **위에서 움직인 거리**(mm)로 두께가 정해진다.
 *
 * 누르고 있던 시간이 아니다. 허공에 오래 들고 있었다고 두껍게 발릴 수는 없고,
 * 실제로 문지르는 동작은 왕복 운동이기 때문이다.
 * 이 거리만큼 움직이면 가장 두껍게 발린다 (받침 유리 긴 변이 76 mm 이므로 여러 번 왕복).
 */

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

/**
 * 한 줄에 물건을 고르게 늘어놓는다. **좌표를 손으로 적지 않는다.**
 *
 * ── 왜 계산하나 ────────────────────────────────────────────────────
 * 이 실험은 실험대에 물건이 스물일곱 개 놓인다 — 조건마다 하나씩 있어야 하기 때문이다
 * (과산화수소수 세 병 · 완충 용액 다섯 병 · 수조 다섯 대 · 감자즙 네 통).
 * 스물일곱 개의 x 를 손으로 적으면 하나를 옮길 때마다 그 오른쪽이 전부 밀리고,
 * 겹치거나 실험대 밖으로 나간 것을 눈으로 찾게 된다. 실제로 첫 배치가 그렇게 깨졌다 —
 * 비커가 수조를 덮었고 쓰레기통은 실험대 오른쪽 밖에 있었다.
 *
 * ── 무엇을 기준으로 재나 ───────────────────────────────────────────
 * 프레임(400×300)이 아니라 **그려진 부분**으로 잰다. 애셋은 저마다 프레임을 꽉 채워 그리지만
 * 실제로 칠해진 부분은 훨씬 좁다 — 시약병은 프레임 105 mm 중 40 mm 만 그려져 있다.
 * 프레임으로 재면 그림이 한참 떨어져 보이는데도 자리가 모자란다.
 *
 * 남는 자리를 물건 사이에 고르게 나눈다. 자리가 모자라면 겹치는데, 그것은
 * `tests/bench.test.js` 가 잡는다 — 조용히 좁혀서 겹치게 두지 않는다.
 *
 * ── 잡는 영역까지 여기서 벌리려고 했다가 되돌렸다 ──────────────────
 * 작은 물건에 **그림보다 넓은 자리**를 주어 44 px 짜리 잡는 영역이 안 겹치게 하려 했다.
 * 그런데 줄 전체 폭이 고정이라, 작은 것에 더 준 만큼 큰 것에서 뺏길 뿐 물건 사이 거리는
 * 거의 그대로였다 — **되돌려도 검사가 통과했다.** 실제로 겹침을 막고 있던 것은
 * 잡는 영역을 그려진 부분에 맞춘 쪽이었다 (`index.html` 의 `.token::after`).
 * 아무 일도 안 하는 상수를 큰 주석과 함께 두면 다음 사람이 그것을 근거로 삼는다.
 */
/**
 * **「코드 복사」가 내는 코드가 참조하는 도우미들.**
 *
 * 편집 모드에서 배치를 옮기고 「코드 복사」를 누르면 `shelf(20, {…})` 같은 줄이 나온다.
 * 그런데 이 저장소에는 그 이름들이 **없었다** — 붙여 넣을 수 없는 코드를 내고 있었다.
 * (`row()` 로만 배치를 적어 왔기 때문이다. 내는 쪽과 받는 쪽이 갈라져 있었다.)
 *
 * ★ `at` 의 둘째 인자는 **윗변(y)** 이다. 「바닥」으로 두면 같은 숫자가 다른 자리를 가리켜,
 * 배치를 옮겨 붙일 때 조용히 어긋난다. 정본과 뜻을 맞춰 둔다.
 */
const shelf = (x, rest) => ({ x, bottom: SHELF_MM, ...rest });
const shelf2 = (x, rest) => ({ x, bottom: SHELF2_MM, ...rest });
const surface = (x, rest) => ({ x, bottom: SURFACE_MM, ...rest });
const at = (x, y, rest) => ({ x, y, bottom: y + heightMm(rest.asset), ...rest });

function row(entries, { from, to, bottom }) {
  const drawn = entries.map((e) => drawnBoxMm(e.asset));
  /*
   * **프레임까지 실험대 안에 둔다.** `from`·`to` 는 그려진 부분의 자리인데, 물건의
   * `<button>` 은 프레임(400×300 전체) 크기다. 줄 끝 물건의 그려진 부분을 실험대 가장자리에
   * 붙이면 **프레임의 빈 여백이 실험대 밖으로 삐져나가** `#bench`(overflow:auto) 에
   * 가로 스크롤이 생겼다 — 1280 px 에서 23 px, 768 px 태블릿에서 19 px. 눈에는 아무것도
   * 없는데 실험대가 옆으로 밀리고 스크롤 막대가 붙었다. 플레이테스트에서 잡았다 (2026-09-02).
   * `tests/bench.test.js` 의 「프레임까지 실험대 안」이 지킨다.
   */
  const first = drawn[0];
  const last = drawn[drawn.length - 1];
  const lastFrame = CONTRACT[entries[entries.length - 1].asset].realSizeMm;
  from = Math.max(from, first.dx);
  to = Math.min(to, STAGE_W_MM - (lastFrame - last.dx - last.w));
  const used = drawn.reduce((w, d) => w + d.w, 0);
  const gap = entries.length > 1 ? ((to - from) - used) / (entries.length - 1) : 0;
  let cursor = from;
  return entries.map((e, i) => {
    // `x` 는 **프레임** 왼쪽이다. 그림은 그보다 dx 만큼 안쪽에서 시작하므로 그만큼 당긴다.
    const x = cursor - drawn[i].dx;
    cursor += drawn[i].w + gap;
    return { ...e, x, bottom };
  });
}

/**
 * 실험대 위 배치. 좌표는 전부 **mm** 다.
 * `bottom` 은 물건이 바닥을 대는 높이 — 선반 위인지 작업면 위인지.
 * 위쪽 좌표(y)는 실물 크기에서 계산하므로, `realSizeMm` 을 고치면 자리도 알아서 따라온다.
 *
 * ── 무엇을 선반에, 무엇을 작업면에 ────────────────────────────────
 * **자리를 많이 먹는 것이 작업면**이다. 수조 다섯 대만 600 mm 가까이 되므로,
 * 병과 잔 도구는 선반으로 올렸다. 작업면에는 비커를 들고 다니며 하는 일만 남긴다.
 *
 * ── 조건마다 물건이 하나씩 있다 ────────────────────────────────────
 * **골라 쓰는 것이 학생의 일**이라, 화면이 대신 골라 주면 통제변인을 틀릴 수가 없어진다 —
 * 틀릴 수 없으면 그래프에서 어긋난 점을 볼 일도 없고, 이 실험이 가르치려는 것이 사라진다.
 *
 * 끓인 감자즙을 **미리 끓여 둔 통**으로 두었다. 교실에서도 대조군은 미리 만들어 둔다.
 * 실험대에서 끓이게 하면 「어느 감자즙이 끓은 것인가」를 상태 하나로 좇아야 하는데,
 * 통을 오가는 순간 그 값이 조용히 뒤집힌다.
 *
 * 줄 안의 **순서**에는 뜻이 있다. 농도와 pH 와 온도가 전부 오름차순이라,
 * 계열을 훑는 순서와 화면을 훑는 순서가 같다.
 */
function defaultItems() {
  const I = UI.bench.items;
  const bottle = (id, kind, extra) => ({ id, asset: 'bottle', kind, labelKey: id, ...extra });
  const items = [
    /*
     * **시약병 열 개를 두 줄로 가른다.**
     *
     * 선반이 하나였을 때는 열 개가 한 줄에 몰려 있었다. 폰에서 실험대가 줄어들자
     * 그 줄이 가장 붐볐고, 잡는 자리(44px = 실험대의 223 mm)가 서로 포개졌다.
     * 겹쳐도 겨눈 것이 집히게는 해 뒀지만(`aimedAt`), **눈으로 덜 붐비는 것**은 배치가 한다.
     *
     * 위 선반에 과산화수소수 셋과 완충 용액 다섯, 아래 선반에 산·염기와 도구.
     * 같은 종류끼리 한 줄에 두면 학생이 「이 줄은 농도, 저 줄은 pH」로 읽는다.
     *
     * 여기서 정하는 것은 **첫 자리**일 뿐이다 — 선생님이 Ctrl+P 로 직접 옮기신다.
     */
    ...row([
      bottle('h2o2_1', 'bottleH2O2', { pct: 1 }),
      bottle('h2o2_2', 'bottleH2O2', { pct: 2 }),
      bottle('h2o2_3', 'bottleH2O2', { pct: 3 }),
      bottle('buffer3', 'bottleBuffer', { ph: 3 }),
      bottle('buffer5', 'bottleBuffer', { ph: 5 }),
      bottle('buffer7', 'bottleBuffer', { ph: 7 }),
      bottle('buffer9', 'bottleBuffer', { ph: 9 }),
      bottle('buffer11', 'bottleBuffer', { ph: 11 }),
    ], { from: 20, to: STAGE_W_MM - 20, bottom: SHELF_MM }),

    ...row([
      bottle('acid', 'bottleAcid', {}),
      bottle('base', 'bottleBase', {}),
      { id: 'filterpaper', asset: 'filterpaper', kind: 'filterpaper', labelKey: 'filterpaper' },
      { id: 'forceps', asset: 'forceps', kind: 'forceps', labelKey: 'forceps' },
      // 비커 통은 선반이다. 깨졌을 때만 가는 곳이라 작업면의 목 좋은 자리를 차지할 이유가 없고,
      // 막힘 문구도 「**선반의** 비커 통」이라고 말한다 (rules.js 의 CRACKED_MESSAGE).
      { id: 'beakerbox', asset: 'beakerbox', kind: 'beakerbox', labelKey: 'beakerbox' },
    ], { from: 20, to: STAGE_W_MM - 20, bottom: SHELF2_MM }),

    ...row([
      { id: 'bath0', asset: 'waterbath', kind: 'waterbath', tempC: 0, labelKey: 'bath0' },
      { id: 'bath20', asset: 'waterbath', kind: 'waterbath', tempC: 20, labelKey: 'bath20' },
      { id: 'bath37', asset: 'waterbath', kind: 'waterbath', tempC: 37, labelKey: 'bath37' },
      { id: 'bath60', asset: 'waterbath', kind: 'waterbath', tempC: 60, labelKey: 'bath60' },
      { id: 'bath100', asset: 'waterbath', kind: 'waterbath', tempC: 100, labelKey: 'bath100' },
      { id: 'beaker', asset: 'beaker', kind: 'beaker', labelKey: 'beaker' },
      { id: 'stopwatch', asset: 'stopwatch', kind: 'stopwatch', labelKey: 'stopwatch' },
      { id: 'extract25', asset: 'beaker', kind: 'extract', pct: 25, labelKey: 'extract25' },
      { id: 'extract50', asset: 'beaker', kind: 'extract', pct: 50, labelKey: 'extract50' },
      { id: 'extract100', asset: 'beaker', kind: 'extract', pct: 100, labelKey: 'extract100' },
      { id: 'extractBoiled', asset: 'beaker', kind: 'extract', pct: 100, boiled: true, labelKey: 'extractBoiled' },
      // 개수대는 두지 않는다. **과산화수소수와 산·염기 폐액은 개수대에 버리지 않는다** —
      // 비운 것은 전부 폐액통으로 간다. 손은 휴지 쪽에서 씻는다.
      // 자리 문제이기도 했다: 개수대 하나가 194 mm 라, 두면 나머지가 잡는 영역만큼
      // 벌어질 자리를 못 얻어 옆엣것의 클릭을 서로 가로챈다.
      { id: 'waste', asset: 'waste', kind: 'waste', labelKey: 'waste' },
      { id: 'bin', asset: 'bin', kind: 'bin', labelKey: 'bin' },
    ], { from: 10, to: STAGE_W_MM - 10, bottom: SURFACE_MM }),
    // 이름은 키로만 적어 둔다. 편집 모드가 배치를 다시 코드로 뱉을 때
    // `label: I.beaker` 를 되살리려면 어느 키였는지를 알아야 한다.
  ];
  return items.map((it) => ({ ...it, label: I[it.labelKey], y: it.bottom - heightMm(it.asset) }));
}

/**
 * 끌어다 놓았을 때 무슨 일이 일어나는가. **종류 쌍**으로만 적는다.
 *
 * 상태(핀셋이 지금 원반을 들고 있는가 같은 것)는 여기서 보지 않는다.
 * 빈 핀셋을 비커에 대면 `rules.js` 가 「넣을 원반이 없습니다. 거름종이를 펀치로 먼저 뚫으세요」
 * 라고 답해 주는데, **그 답을 듣는 것이 이 실험에서 배우는 내용이다.**
 * 여기서 미리 걸러 내면 들을 기회가 사라진다.
 * 그래서 드래그 중 하이라이트는 「된다」가 아니라 **「여기에 무언가 일어난다」**는 표시다.
 *
 * 이 표 하나가 세 곳에 함께 쓰인다 — 실제 실행, 드래그 중 대상 하이라이트, 안내 문구 유무.
 * 셋을 따로 적으면 조작을 하나 늘릴 때마다 세 곳이 어긋난다.
 */
export function dropTable(store) {
  return {
    /** 병에 적힌 농도가 그대로 들어간다. 병을 잘못 고르는 것을 막지 않는다 — 통제변인이다. */
    bottleH2O2: {
      beaker: (item) => store.dispatch('POUR_H2O2', { pct: item.pct }),
    },
    bottleBuffer: {
      beaker: (item) => store.dispatch('SET_PH', { ph: item.ph, method: PH_METHODS.BUFFER }),
    },
    /**
     * 산·염기를 그대로 붓는다.
     *
     * 0.1 M 염산 자체는 pH 1 이지만, 실제 절차는 **목표 pH 가 될 때까지 조금씩 넣는 것**이다.
     * 그래서 도달 pH 를 이 실험의 눈금(3 · 11)에 맞춰 둔다. 완충 용액과 갈리는 것은
     * 도달한 pH 가 아니라 **어떻게 도달했는가**이고, 그것이 `method` 로 넘어간다.
     */
    bottleAcid: {
      beaker: () => store.dispatch('SET_PH', { ph: 3, method: PH_METHODS.ACID_BASE }),
    },
    bottleBase: {
      beaker: () => store.dispatch('SET_PH', { ph: 11, method: PH_METHODS.ACID_BASE }),
    },
    beaker: {
      waterbath: (item, target) => store.dispatch('PUT_IN_BATH', { tempC: target.tempC }),
      // 비운 것은 폐액통으로 간다. 개수대에 버리지 않는다 (defaultItems 주석 참조).
      waste: () => store.dispatch('EMPTY_BEAKER', {}),
      beakerbox: () => store.dispatch('NEW_BEAKER', {}),
    },
    forceps: {
      /**
       * 감자즙 통에 원반을 담근다.
       *
       * 통을 고르는 것이 곧 농도를 고르는 것이라, **어느 통에서 떴는지**를 먼저 기록하고
       * 담근다. 끓인 감자즙 통은 그 한 걸음이 더 붙는다 — 미리 끓여 둔 것이기 때문이다.
       */
      extract: (item, target) => {
        store.dispatch('MAKE_EXTRACT', { pct: target.pct });
        if (target.boiled) store.dispatch('BOIL_EXTRACT', {});
        store.dispatch('SOAK_DISC', {});
      },
      beaker: () => store.dispatch('DROP_DISC', {}),
      // 쓴 원반은 고형 폐기물이다. 폐액통이 아니라 쓰레기통에 버린다.
      bin: () => store.dispatch('DISCARD_DISC', {}),
    },
  };
}

/**
 * 물건을 클릭(또는 Enter/Space)했을 때. 끌어다 놓는 조작과 달리 대상이 필요 없는 것들.
 *
 * 앞서는 여기에 안전 수칙 조작 넷이 더 있었다 — 시약병 마개 닫기·폐액 버리기·손 씻기.
 * **앱이 안전을 판정하지 않기로 하면서 함께 걷어냈다** (`rules.js` 참조).
 * 시약병과 폐액통은 **끌기로 하던 일이 그대로 있어서** 눌러도 아무 일 없는 물건이 되지 않는다:
 * 시약병은 비커로 끌어 붓고, 폐액통은 비커를 끌어 비운다.
 * 휴지는 손 씻기 하나뿐이었으므로 **실험대에서 뺐다** — 눌러도 아무 말도 없는 물건을
 * 남기지 않는다. 실제 실험에서 무엇을 해야 하는지는 탐구 노트의 안내가 말한다.
 */
export function tapTable(store) {
  return {
    filterpaper: () => store.dispatch('PUNCH_DISC', {}),
    forceps: () => store.dispatch('PICK_DISC', {}),
    // 초시계를 멈추고 적는 것이 이 실험에서 결과를 남기는 동작이다.
    stopwatch: () => store.dispatch('RECORD_TRIAL', {}),
    beaker: () => store.dispatch('TAKE_FROM_BATH', {}),
  };
}

/**
 * 실험대 배치를 mm 사각형으로 낸다. **그려진 부분**의 사각형이다 (프레임이 아니라).
 *
 * 물건이 서로 겹치면 나중에 그려진 쪽이 앞선 쪽의 클릭을 가로챈다.
 * 예전에는 애셋의 400×300 프레임 전체를 그 영역으로 쳤는데, 스포이트는 폭 400 중 55 만
 * 실제로 그려져 있다. 그 여백까지 세면 눈에는 한참 떨어져 보이는 물건 둘이 겹친 것이 되고,
 * 작업면에 놓을 물건 일곱을 재면 1695 mm 라 1500 mm 실험대에 아예 앉힐 수가 없었다.
 * 이제 칠해진 부분만 포인터를 받으므로(`index.html` 의 `.token`), 여기서도 그 부분만 잰다.
 */
export function benchLayout() {
  return defaultItems().map((it) => {
    const d = drawnBoxMm(it.asset);
    // `kind` 를 함께 낸다. 검사가 조작표의 종류와 실제로 놓인 물건을 맞춰 보려면 필요한데,
    // 소스를 정규식으로 훑어 읽게 두었더니 도우미 함수로 만든 물건을 통째로 놓쳤다.
    // `frame` 은 `<button>` 이 실제로 차지하는 자리(프레임)다. 그려진 부분과 따로 낸다 —
    // 겹침은 그려진 부분으로, 실험대 밖으로 나갔는가는 프레임으로 재야 한다 (`row()` 주석).
    return {
      id: it.id, kind: it.kind, x: it.x + d.dx, y: it.y + d.dy, w: d.w, h: d.h,
      frame: { x: it.x, w: CONTRACT[it.asset].realSizeMm },
    };
  });
}

/** 실험대에 놓인 물건들. 배치를 몰라도 종류만 알면 되는 검사에 쓴다. */
export const BENCH_KINDS = [
  'bottleH2O2', 'bottleBuffer', 'bottleAcid', 'bottleBase', 'filterpaper', 'forceps',
  'tissue', 'waterbath', 'beaker', 'stopwatch', 'extract', 'beakerbox', 'sink', 'waste', 'bin',
];

/**
 * 배치를 다시 코드로 뱉는다 — 편집 모드에서 옮긴 자리를 그대로 `defaultItems()` 에 붙여 넣는다.
 *
 * 눈으로 옮긴 것을 손으로 숫자로 옮겨 적는 일은 반드시 어딘가 틀린다.
 * 옮긴 사람이 스크린샷만 보내면 되도록, 화면이 스스로 좌표를 말하게 한다.
 */
/**
 * 이 물건이 **어느 선에 가장 가까운가.** 붙인 선이 아니다 — 자유 배치라 그런 것이 없다.
 * 편집 패널이 「어디쯤 놓였나」를 말해 주는 데 쓰고, `layoutCode` 가 어느 도우미로 낼지 고르는 데 쓴다.
 *
 * **모듈 자리에 둔다.** 처음에 `createBench` 안에 뒀다가 `layoutCode`(모듈 함수)가 부르게 해서
 * 「코드 복사」를 누르는 순간 터지게 만들어 놨었다 — 편집 모드를 안 열면 안 드러나는 자리다.
 */
const LINES = [
  { key: 'shelf', mm: SHELF_MM },
  { key: 'shelf2', mm: SHELF2_MM },
  { key: 'surface', mm: SURFACE_MM },
];
function whichLine(item) {
  const bottom = item.y + heightMm(item.asset);
  return LINES.reduce((best, l) =>
    Math.abs(bottom - l.mm) < Math.abs(bottom - best.mm) ? l : best).key;
}

function layoutCode(items) {
  const lines = items.map((it) => {
    const fn = whichLine(it);
    const props = [
      `id: '${it.id}'`,
      `asset: '${it.asset}'`,
      `kind: '${it.kind}'`,
      it.tempC !== undefined ? `tempC: ${it.tempC}` : null,
      it.ph !== undefined ? `ph: ${it.ph}` : null,
      it.pct !== undefined ? `pct: ${it.pct}` : null,
      it.boiled ? 'boiled: true' : null,
      it.reagent ? `reagent: '${it.reagent}'` : null,
      `labelKey: '${it.labelKey}'`,
    ].filter(Boolean).join(', ');
    /**
     * **선에 붙어 있을 때만 도우미로 낸다.**
     *
     * 앞서는 늘 `shelf(x, {…})` 로 냈다. 그러면 어중간한 높이로 맞춰 둔 것이
     * **붙여 넣는 순간 선으로 되돌아간다** — 미세 조정한 것이 사라진다.
     * 선에서 1 mm 라도 벗어나 있으면 `at(x, y, {…})` 로 y 까지 적는다.
     *
     * ★ `at` 의 둘째 인자는 **윗변(y)** 이다. 「바닥」으로 두면 같은 숫자가 다른 자리를
     * 가리키게 되어, 배치를 옮겨 붙일 때 조용히 어긋난다. 정본과 뜻을 맞춰 둔다.
     */
    const line = LINES.find((l) => l.key === fn);
    const onLine = Math.abs((it.y + heightMm(it.asset)) - line.mm) < 1;
    return onLine
      ? `    ${fn}(${Math.round(it.x)}, { ${props} }),`
      : `    at(${Math.round(it.x)}, ${Math.round(it.y)}, { ${props} }),`;
  });
  return `// src/ui/bench.js 의 defaultItems() 안, 배열 자리에 그대로 붙여 넣습니다.\n${lines.join('\n')}`;
}

/**
 * @param {HTMLElement} root
 * @param {{getState:Function, dispatch:Function, subscribe:Function}} store
 * @param {{edit?:boolean}} handlers
 *   edit — 배치를 옮겨 보는 모드. 조작은 일어나지 않고 물건이 놓인 자리에 그대로 남는다.
 *
 * 이 실험에는 **확대 뷰가 없다.** 손끝으로 값을 정하는 조작(몇 방울인가, 몇 도로 덮는가)이
 * 없기 때문이다 — 조건은 물건을 골라 잡는 것으로 정해진다 (NEW-EXPERIMENT.md §3.5).
 */
export function createBench(root, store, { edit = false } = {}) {
  root.classList.add('bench');
  // 배경과 물건을 같은 무대 안에 둔다. 무대가 4:3 을 지키므로 둘이 함께 스케일된다.
  // 안내 말풍선은 무대 바로 아래에 둔다 — 물건 층(.bench-tokens)은 조작할 때마다
  // 통째로 다시 그려지므로, 그 안에 두면 말풍선이 같이 사라진다.
  root.innerHTML = `
    <div class="bench-bar">
      <button type="button" id="undo">${UI.undo.label}</button>
      <span id="undo-left"></span>
      <button type="button" id="take-out" hidden></button>
      <button type="button" id="record">${UI.bench.record}</button>
      <span id="clock"></span>
      <span id="trials"></span>
    </div>
    <!-- 관찰 창. 실험대의 작은 비커 토큰에서는 원반이 떠오르는 것이 보이지 않는다 —
         이 실험에서 **보는 것이 결과 전부**라 크게 그릴 자리가 따로 있어야 한다. -->
    <div class="bench-watch" id="bench-watch"></div>
    <div class="bench-stage">
      <div class="bench-bg" aria-hidden="true"></div>
      <div class="bench-tokens"></div>
      <div class="bench-tip" id="bench-tip" role="tooltip" hidden></div>
      <div class="bench-lock" id="bench-lock" hidden>
        <div class="bench-lock-card">
          <b>${UI.bench.lock.title}</b>
          <p>${UI.bench.lock.lead}</p>
          <ul id="bench-lock-left"></ul>
        </div>
      </div>
    </div>
    ${edit ? `
      <div class="edit-panel" id="edit-panel">
        <div class="edit-head">
          <b>${UI.edit.heading}</b>
          <button type="button" id="edit-copy">${UI.edit.copy}</button>
          <button type="button" id="edit-reset">${UI.edit.reset}</button>
        </div>
        <p class="edit-note">${UI.edit.note}</p>
        <p class="edit-warn" id="edit-warn"></p>
        <table class="edit-table"><tbody id="edit-rows"></tbody></table>
      </div>` : ''}`;
  root.querySelector('.bench-bg').innerHTML = ASSETS.bench.render({});
  const layer = root.querySelector('.bench-tokens');
  const tipEl = root.querySelector('.bench-tip');
  const takeOutBtn = root.querySelector('#take-out');

  root.querySelector('#undo').addEventListener('click', () => store.dispatch('UNDO', {}));
  takeOutBtn.addEventListener('click', () => store.dispatch('TAKE_FROM_BATH', {}));
  root.querySelector('#record').addEventListener('click', () => store.dispatch('RECORD_TRIAL', {}));

  const DROPS = dropTable(store);
  const TAPS = tapTable(store);

  const items = defaultItems();
  for (const item of items) { item.homeX = item.x; item.homeY = item.y; }
  let drag = null;

  /* ---------------- 편집 모드 ---------------- */

  /**
   * **놓은 자리에 그대로 둔다.** 실험대 밖으로만 안 나가게 잡는다.
   *
   * 앞서는 두 선(선반·작업면) 중 가까운 쪽에 바닥을 붙였다. 그런데 선생님이
   * 「준비물들 위치 가능한 포지션을 너가 정해두지마. 내가 미세하게 조정할거야」라고
   * 하셨다 (2026-08-29). 붙여 주면 미세 조정이 안 된다 — 1 mm 를 옮겨도 도로 선으로 끌려간다.
   *
   * 그래서 자리는 사람이 정하고, 코드는 **밖으로 나가는 것만** 막는다.
   * `bottom` 은 더 쓰지 않지만 남겨 둔다 — 선반 위인지 작업면 위인지를 묻는 코드가 있다.
   */
  function placeFreely(item) {
    const h = heightMm(item.asset);
    item.x = clamp(item.x, 0, STAGE_W_MM - CONTRACT[item.asset].realSizeMm);
    item.y = clamp(item.y, 0, STAGE_H_MM - h);
    // 어느 선에 가까운지는 그대로 기록해 둔다. 붙이지는 않는다.
    item.bottom = LINES.find((l) => l.key === whichLine(item)).mm;
  }

  /**
   * 서로 겹치는 물건 짝. 겹치면 **뒤에 그려진 쪽이 앞엣것의 클릭을 가로챈다.**
   * 재는 것은 그려진 부분이다 — 포인터를 받는 것도 그 부분이다.
   */
  function overlaps() {
    const box = (it) => {
      const d = drawnBoxMm(it.asset);
      return { x: it.x + d.dx, y: it.y + d.dy, w: d.w, h: d.h };
    };
    const bad = new Set();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = box(items[i]);
        const b = box(items[j]);
        if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) {
          bad.add(items[i].id);
          bad.add(items[j].id);
        }
      }
    }
    return bad;
  }

  /**
   * 좌표 입력칸 하나. **끌어서도, 숫자로도 옮길 수 있어야 한다** (사장님 지시 2026-09-03).
   *
   * 끌기만 되면 1 mm 를 맞추려고 화면을 확대했다 줄였다 하게 된다. 숫자를 직접 치거나
   * 위·아래 화살표로 1 mm 씩 미는 길을 함께 둔다 — y 도 x 와 똑같이.
   * 이름표는 `x`·`y` 와 단위뿐이라 문자열 파일로 뺄 말이 없다.
   */
  function numCell(it, axis) {
    return `<input type="number" class="edit-num" data-axis="${axis}" step="1"
      value="${Math.round(it[axis])}" aria-label="${it.id} ${axis} (mm)"
      style="width:5.2em;font:inherit;text-align:right;padding:1px 4px;border:1px solid currentColor;
             border-radius:4px;background:transparent;color:inherit">`;
  }

  function renderEditPanel() {
    if (!edit) return;
    const bad = overlaps();
    root.querySelector('#edit-rows').innerHTML = items.map((it) => {
      const d = drawnBoxMm(it.asset);
      return `
      <tr data-row="${it.id}">
        <td>${it.id}</td>
        <td class="edit-line"></td>
        <td class="edit-x">${numCell(it, 'x')}</td>
        <td class="edit-x">${numCell(it, 'y')}</td>
        <td class="edit-span"></td>
        <td class="edit-flag"></td>
      </tr>`;
    }).join('');
    syncEditPanel();
  }

  /** 표에 적는 선 이름. 칸을 다시 그릴 때와 값만 맞출 때가 같은 말을 해야 한다. */
  function lineLabel(it) {
    return `${UI.edit[whichLine(it)]}`;
  }

  /**
   * 표의 **읽는 칸**만 다시 칠한다. 입력칸은 값만 맞추되 **지금 손이 가 있는 칸은 건드리지
   * 않는다** — 타이핑 도중 값을 덮으면 커서가 튀어 두 자리 수를 칠 수가 없다.
   */
  function syncEditPanel() {
    if (!edit) return;
    const bad = overlaps();
    for (const it of items) {
      const tr = root.querySelector(`#edit-rows tr[data-row="${it.id}"]`);
      if (!tr) continue;
      const d = drawnBoxMm(it.asset);
      tr.classList.toggle('edit-bad', bad.has(it.id));
      tr.querySelector('.edit-line').textContent = lineLabel(it);
      tr.querySelector('.edit-flag').textContent = bad.has(it.id) ? UI.edit.overlap : '';
      tr.querySelector('.edit-span').textContent = `~${Math.round(it.x + d.dx + d.w)}`;
      for (const axis of ['x', 'y']) {
        const input = tr.querySelector(`input[data-axis="${axis}"]`);
        if (input && document.activeElement !== input) input.value = String(Math.round(it[axis]));
      }
    }
    root.querySelector('#edit-warn').textContent = bad.size ? UI.edit.overlapWarn(bad.size) : '';
  }

  if (edit) {
    root.querySelector('#edit-copy').addEventListener('click', async (e) => {
      await navigator.clipboard.writeText(layoutCode(items));
      e.target.textContent = UI.edit.copied;
      setTimeout(() => { e.target.textContent = UI.edit.copy; }, 1500);
    });
    /*
     * 숫자로 옮기기. `input` 으로 듣는다 — 화살표를 누르는 순간 물건이 따라 움직여야
     * 「이만큼이 1 mm 구나」가 눈에 보인다. 값을 지우는 중(빈 칸)에는 아무 일도 하지 않는다.
     */
    root.querySelector('#edit-rows').addEventListener('input', (e) => {
      const input = e.target.closest('.edit-num');
      if (!input) return;
      const item = items.find((it) => it.id === input.closest('tr')?.dataset.row);
      const v = Number(input.value);
      if (!item || input.value.trim() === '' || !Number.isFinite(v)) return;
      item[input.dataset.axis] = v;
      placeFreely(item);
      renderTokens();
      syncEditPanel();
    });
    root.querySelector('#edit-reset').addEventListener('click', () => {
      for (const [i, it] of defaultItems().entries()) Object.assign(items[i], it);
      renderTokens();
      renderEditPanel();
    });
    // 스크린샷만으로 배치를 옮겨 적을 수 있어야 한다. 콘솔에도 한 벌 남긴다 —
    // 붙여 넣기가 막힌 환경(권한 거부)에서도 길이 하나는 남는다.
    window.__layoutCode = () => layoutCode(items);
  }

  /**
   * 물건 하나를 그릴 때 애셋에 넘길 상태.
   *
   * **이 함수가 상태를 그림으로 옮기는 유일한 자리다.** 여기 없는 것은 화면에 안 나타나고,
   * 화면에 안 나타나는 상태는 학생에게 없는 것과 같다.
   */
  function assetState(item) {
    const st = store.getState();
    const b = st.bench.beaker;
    switch (item.kind) {
      case 'bottleH2O2':
        return { kind: 'H2O2', pct: item.pct, level: 0.7 };
      case 'bottleBuffer':
        return { kind: 'BUFFER', ph: item.ph, level: 0.7 };
      case 'bottleAcid':
        return { kind: 'ACID', level: 0.7 };
      case 'bottleBase':
        return { kind: 'BASE', level: 0.7 };
      case 'extract':
        return { level: 0.55, contents: item.boiled ? 'POTATO_BOILED' : 'POTATO' };
      case 'beaker':
        // 「아직 안 부었다」와 「부었다」가 그림에서 갈려야 한다 — 액체가 있고 없고로 보인다.
        return { level: b.h2o2Pct === null ? 0 : 0.6, contents: 'H2O2', cracked: b.cracked };
      case 'waterbath':
        return { tempC: item.tempC };
      case 'filterpaper':
        // 뚫은 자국이 쌓인다. **한 일이 그림에 남아야** 방금 누른 것이 먹혔는지 알 수 있다.
        return { punched: st.session.log.filter((l) => l.action === 'PUNCH_DISC').length };
      case 'forceps':
        return { closed: st.bench.disc.held, holding: st.bench.disc.punched ? 'disc' : null };
      case 'stopwatch':
        return { seconds: b.elapsedS, running: isRunning(b) };
      case 'waste':
        return { level: 0.2 };
      default:
        return {};
    }
  }

  /**
   * 화면에서 감추는 물건.
   *
   * 이 실험에는 없다. 바나나랩에서는 재물대에 올라간 받침 유리가 실험대에서 사라졌는데,
   * 여기서는 비커가 수조에 들어가도 **실험대 위에 그대로 있다** — 수조도 실험대 위이기 때문이다.
   * 어디 들어가 있는지는 막대의 「수조에서 꺼내기」 버튼이 말한다.
   */
  function isHidden() {
    return false;
  }

  const elFor = (id) => layer.querySelector(`[data-id="${id}"]`);

  /**
   * 놓기 판정에 쓰는 사각형. 그림이 작아도 최소 MIN_HIT_PX 는 잡아 준다 —
   * 화면에서 눌리는 영역(.token::after)과 같은 크기여야 손에 잡히는 대로 동작한다.
   */
  function hitRect(el, assetName) {
    const r = el.getBoundingClientRect();
    // 프레임이 아니라 **그려진 부분**을 잰다. 개수대 프레임(380 mm)은 휴지 프레임과 겹치는데,
    // 그림은 한참 떨어져 있다 — 프레임으로 재면 휴지 그림을 겨눠도 개수대가 잡힌다.
    const c = CONTENT_BOX[assetName];
    const [, , vw, vh] = CONTRACT[assetName].viewBox.split(/\s+/).map(Number);
    const left = r.left + r.width * (c.x0 / vw);
    const top = r.top + r.height * (c.y0 / vh);
    const dw = r.width * ((c.x1 - c.x0) / vw);
    const dh = r.height * ((c.y1 - c.y0) / vh);
    // 그림이 손가락보다 작으면 최소 크기까지 넓혀 준다 (덮개 유리 통·받침 유리).
    const w = Math.max(dw, MIN_HIT_PX);
    const h = Math.max(dh, MIN_HIT_PX);
    const cx = left + dw / 2;
    const cy = top + dh / 2;
    return { left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2 };
  }

  /**
   * 드래그가 시작될 때 다른 물건들의 판정 사각형을 한 번만 재어 둔다.
   * 드래그 중에는 끄는 물건 말고는 아무것도 움직이지 않으므로(재렌더도 건너뛴다) 안전하고,
   * 포인터가 움직일 때마다 열몇 개를 다시 재는 일을 없앤다.
   */
  function captureRects(selfId) {
    const rects = new Map();
    for (const other of items) {
      if (other.id === selfId || isHidden(other)) continue;
      const oe = elFor(other.id);
      if (oe) rects.set(other.id, hitRect(oe, other.asset));
    }
    return rects;
  }

  /** 끄는 물건의 **그림** 중심 아래 있는 첫 토큰. 프레임 중심은 그림 밖일 수 있다. */
  /**
   * 지금 끌고 있는 것이 **어느 물건 위에 있는가.**
   *
   * 앞서는 목록에서 **먼저 오는 것이 이겼다.** 판정 사각형은 `MIN_HIT_PX`(44) 까지 넓혀
   * 주므로 작은 그림들은 서로 포개지는데, 그러면 겨눈 것이 아니라 **`items` 배열에서 앞선 것**이
   * 잡힌다. 배열 순서는 배치를 옮기면 바뀌는 값이라, 맞는지 여부가 **우연**에 걸려 있었다.
   *
   * **여기서는 어긋나는 것을 재현하지 못했다.** 수조 다섯을 가운데·가장자리로 나눠 겨눠 봤고,
   * 감자즙 통 넷도 그렇게 해 봤는데 전부 겨눈 것이 잡혔다. 끌면서 앱이 무엇을 짚는지
   * (`.token--target-hot`) 지켜본 결과도 같았다 — 그림 밖으로 나가면 **아무것도 안 짚는다.**
   *
   * (처음엔 재현했다고 생각했다. 37 ℃ 수조 가장자리를 겨눴더니 비커가 20 ℃ 로 나왔기 때문이다.
   * 그런데 그것은 **아무 데도 안 놓인 것**이었다 — 20 ℃ 는 수조 밖 비커의 원래 온도다.
   * 「엉뚱한 데 놓였다」와 「안 놓였다」를 결과 숫자만 보고 갈랐던 것이 잘못이었다.)
   *
   * 그래도 순서 대신 **거리**로 가르게 바꿨다. 고장을 봐서가 아니라 **순서가 판정 기준이
   * 될 이유가 없어서**다. 이 저장소는 `?edit=1` 로 배치를 옮기게 해 두었으니, 언젠가 두
   * 판정 사각형이 같은 점을 품는 배치가 나온다. 그때 무엇이 이길지가 배열 순서로 정해지면
   * **화면을 봐서는 알 수 없는 규칙**이 된다. 거리로 정하면 눈에 보이는 대로다.
   * (chromatography-lab 세션은 자기 저장소에서 이것을 **실제로** 겪었다 — 거기는 작은 화면에서
   *  그림이 14~38 px 로 줄어 판정 사각형이 서로 포개진다.
   *
   *  ★ **여기도 이제 같다.** 이 주석을 쓸 때는 실험대가 820 px 고정이라 「화면이 좁아져도
   *  물건이 안 줄어서 같은 일이 안 났다」고 적어 두었는데, 그 뒤 여덟 랩을 같은 방식으로
   *  맞추라는 지시로 **화면 폭을 따라 줄어들게** 바꿨다 (2026-08-29). 배포본에서 재 보면
   *  320 px 폰에서 가장 작은 것이 **14 px** 다 — 저쪽과 같은 자리다.
   *  아래 `aimedAt` 이 그래서 필요하다. **면제받고 있다고 적어 둔 주석이 가장 위험하다.**)
   *
   * **받는 물건을 골라 주지는 않는다.** 폐액통을 겨눴으면 폐액통이 답해야 한다 —
   * 겨눈 곳을 바꾸는 것이 아니라, 겨눈 곳에 **가장 가까운 것**을 고를 뿐이다.
   */
  /**
   * 화면의 한 점을 짚었을 때 **어느 물건을 겨눈 것인가.**
   *
   * `.token::after` 가 잡는 자리를 `MIN_HIT_PX`(44) 까지 넓혀 준다 — 손가락으로 짚으려면
   * 그만큼은 있어야 하기 때문이다. 그런데 실험대가 화면에 맞춰 줄어들면서 물건이 10px 까지
   * 작아지자 **넓힌 자리들이 서로 포개졌다.** 그러면 DOM 이 나중에 그려진 것에 이벤트를 주므로
   * **1 % 병을 짚어도 2 % 병이 잡힌다.** 폰에서 열네 쌍, 1024px 에서도 났다.
   *
   * 조용히 옆 것이 잡히면 학생의 실험 조건이 바뀐 채로 시행이 기록된다 —
   * 화면을 봐서는 알 수 없고, 그래프에 찍힌 뒤에야 이상해 보인다.
   *
   * 그래서 **그림 한가운데가 가장 가까운 것**이 이긴다. `targetUnder()`(놓기 판정)와 같은 규칙이다.
   * **겨눈 것을 바꾸지 않는다** — 겨눈 곳에 가장 가까운 것을 고를 뿐이다.
   */
  function aimedAt(cx, cy) {
    let best = null;
    let bestD = Infinity;
    for (const item of items) {
      const el = elFor(item.id);
      if (!el || isHidden(item)) continue;
      const r = hitRect(el, item.asset);
      if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) continue;
      const ox = (r.left + r.right) / 2;
      const oy = (r.top + r.bottom) / 2;
      const d = (cx - ox) ** 2 + (cy - oy) ** 2;
      if (d < bestD) { bestD = d; best = item; }
    }
    return best;
  }

  /**
   * **짚은 자리를 가로챈 물건에서 겨눈 물건으로 돌려준다.**
   *
   * 잡는 자리가 포개지면 DOM 은 나중에 그려진 것에 이벤트를 준다. 여기서 먼저 받아
   * 가장 가까운 것을 찾고, 그것이 다른 물건이면 **그쪽으로 넘긴다.**
   * 잡는 영역을 좁히지 않는다 — 좁히면 손가락으로 짚기 어려워진다.
   */
  layer.addEventListener('pointerdown', (e) => {
    const el = e.target.closest?.('.token');
    if (!el || drag) return;
    const aimed = aimedAt(e.clientX, e.clientY);
    if (!aimed || aimed.id === el.dataset.id) return;
    const right = elFor(aimed.id);
    if (!right) return;
    e.stopPropagation();
    e.preventDefault();
    const item = items.find((i) => i.id === aimed.id);
    if (item) onPointerDown(e, item, right);
  }, true);

  function targetUnder() {
    const g = hitRect(drag.el, drag.item.asset);
    const cx = (g.left + g.right) / 2;
    const cy = (g.top + g.bottom) / 2;
    let best = null;
    let bestD = Infinity;
    for (const other of items) {
      const or_ = drag.rects.get(other.id);
      if (!or_) continue;
      if (cx < or_.left || cx > or_.right || cy < or_.top || cy > or_.bottom) continue;
      const ox = (or_.left + or_.right) / 2;
      const oy = (or_.top + or_.bottom) / 2;
      const d = (cx - ox) ** 2 + (cy - oy) ** 2;
      if (d < bestD) { bestD = d; best = other; }
    }
    return best;
  }

  /* ---------------------------------------------------------------- */
  /* 안내 말풍선 — 이름과 지금 할 수 있는 조작                          */
  /* ---------------------------------------------------------------- */

  /**
   * 키보드로 끌어다 놓기.
   *
   * 끌어다 놓는 조작에 키보드 경로가 없으면, 마우스를 쓰지 못하는 사람은 실험을
   * 시작조차 할 수 없다. 포커스로 말풍선이 떴을 때만 **놓을 곳 버튼**을 함께 낸다.
   * Tab 으로 들어가 Enter 로 놓는다.
   *
   * 이 실험에서는 마우스와 키보드가 **똑같은 일을 한다.** 손짓이 정하는 값(문지른 정도·
   * 덮는 각도 같은 것)이 없기 때문이다 — 조건은 전부 어느 물건을 잡느냐로 정해진다.
   * 그래서 바나나랩에 있던 「키보드로는 가운뎃값」 이라는 격차가 여기엔 없다.
   */

  function dropTargetsFor(item) {
    const accepts = DROPS[item.kind] ?? {};
    return items.filter((o) => o.id !== item.id && !isHidden(o) && accepts[o.kind]);
  }

  function runDrop(item, target) {
    const run = DROPS[item.kind]?.[target.kind];
    if (!run) return;
    run(item, target);
    renderTokens();
    // 놓고 나면 그 물건으로 포커스를 돌려준다. 그러지 않으면 포커스가 <body> 로 빠져
    // 키보드로 쓰는 사람은 매번 처음부터 Tab 해서 돌아와야 한다.
    // focus() 가 focus 이벤트를 쏘고, 그 핸들러가 말풍선을 다시 낸다 — 여기서 또 부르지 않는다.
    // 놓은 물건이 화면에서 사라졌으면(재물대에 올라간 받침 유리) **놓은 자리**로 옮긴다.
    // 그냥 두면 포커스가 <body> 로 빠져, 키보드로 쓰는 사람은 처음부터 Tab 해 돌아와야 한다.
    (elFor(item.id) ?? elFor(target.id))?.focus();
  }

  function showTip(item, withActions = false) {
    if (drag) return;
    tipFromKeyboard = withActions;
    clearTimeout(hideTimer);   // 옆 물건으로 옮겨 오는 중이었다면 예약된 닫기를 취소한다
    hideTimer = 0;
    const level = store.getState().session.level;
    const lines = UI.bench.hints[item.kind]?.[level] ?? [];
    // 편집 모드에서는 놓을 곳 버튼을 내지 않는다. 그 버튼은 실제 조작을 일으키므로
    // "조작은 일어나지 않습니다" 라고 적어 둔 화면에 있으면 안 된다.
    const targets = withActions && !edit ? dropTargetsFor(item) : [];
    const actions = targets.length ? `
      <div class="tip-actions">
        <span class="tip-actions-label">${UI.bench.keyboardPut}</span>
        ${targets.map((t) => `<button type="button" data-put="${item.id}" data-onto="${t.id}"
          >${t.label}</button>`).join('')}
      </div>` : '';
    tipEl.innerHTML =
      `<b>${item.label}</b>${lines.map((t) => `<span>${t}</span>`).join('')}${actions}`;
    // 이 말풍선이 **누구 것인가.** Tab 다리(아래 tipEl keydown)가 돌아갈 곳을 찾는 데 쓴다.
    tipEl.dataset.for = item.id;
    tipEl.querySelectorAll('[data-put]').forEach((b) => {
      b.addEventListener('click', () => {
        const from = items.find((i) => i.id === b.dataset.put);
        const onto = items.find((i) => i.id === b.dataset.onto);
        if (from && onto) runDrop(from, onto);
      });
    });
    // 무대 밖으로 밀려나지 않게 가로 위치를 안쪽으로 묶는다.
    const centerMm = item.x + CONTRACT[item.asset].realSizeMm / 2;
    tipEl.style.left = `${clamp(xPct(centerMm), 12, 88)}%`;
    // 위쪽에 있는 물건은 말풍선을 아래로 — 위로 띄우면 실험대 밖으로 나간다.
    const below = yPct(item.y) < 26;
    tipEl.dataset.below = String(below);
    tipEl.style.top = `${yPct(below ? item.y + heightMm(item.asset) : item.y)}%`;
    tipEl.hidden = false;
  }

  /** 닫기 예약. 새 포커스가 오면 showTip 이 취소한다. */
  let hideTimer = 0;

  /**
   * 지금 말풍선이 **키보드로 열린 것인가.**
   *
   * 마우스로 올려서 뜬 말풍선과 포커스로 뜬 말풍선은 생김새가 다르다 — 뒤엣것에만
   * 「여기에 놓기」 버튼이 붙고, 마우스를 못 쓰는 사람에게는 그 버튼이 끌어다 놓는 길의 전부다.
   * 그래서 **마우스가 그 말풍선을 빼앗지 못하게** 표시해 둔다. 아래 두 곳에서 쓴다.
   */
  let tipFromKeyboard = false;

  /**
   * **사람이 Esc 로 치운** 말풍선의 물건 id.
   *
   * 포커스로 뜬 말풍선은 포커스가 그 물건에 있는 한 계속 떠 있다. 그런데 말풍선은
   * 실험대를 가리므로, **포커스를 옮기지 않고 치울 수 있어야 한다** (WCAG 1.4.13).
   * 치웠다는 사실을 기억하지 않으면 focus 핸들러가 곧바로 다시 띄워 Esc 가 먹히지 않는다.
   * 다른 물건으로 옮기면 풀린다 — 치운 것은 그 물건의 말풍선 하나지 기능 전체가 아니다.
   */
  let dismissedId = null;

  function hideTip() {
    clearTimeout(hideTimer);
    hideTimer = 0;
    tipFromKeyboard = false;
    tipEl.hidden = true;
  }

  function hideTipSoon() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      // 말풍선 **안으로** 포커스가 옮겨 갔으면 닫지 않는다.
      // 키보드로 놓으려면 Tab 해서 「여기에 놓기」 버튼으로 들어가야 하는데,
      // 그때 토큰에서 blur 가 나므로 그대로 닫으면 버튼이 눈앞에서 사라진다.
      if (tipEl.contains(document.activeElement)) return;
      hideTip();
    }, 0);
  }

  // 실험대 아무 데나 누르면 말풍선을 닫는다.
  // 마우스에는 pointerleave 가 있지만 손가락에는 없다 — 물건 밖을 눌렀을 때
  // 닫히지 않으면 말풍선이 실험대 위에 그대로 남는다.
  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.token') || tipEl.contains(e.target)) return;
    hideTip();
  });

  /**
   * 다리의 말풍선 쪽 끝.
   *
   * 들어왔으면 나가는 길도 있어야 한다. 놓기 버튼이 일곱 개인 비커에서 Tab 만으로
   * 빠져나오려면 일곱 번을 눌러야 하고, 마지막 버튼에서 Tab 하면 DOM 순서대로
   * **탐구 노트로 튕겨 나가** 실험대를 벗어난다. 셋 다 손본다.
   *   · 마지막 버튼에서 Tab      → 원래 물건의 **다음 물건**으로 (자연스러운 순서)
   *   · 첫 버튼에서 Shift+Tab   → 원래 물건으로 되돌아간다
   *   · 아무 데서나 Esc         → 말풍선을 치우고 원래 물건으로. 일곱 번 안 눌러도 된다
   */
  tipEl.addEventListener('keydown', (e) => {
    const source = () => elFor(tipEl.dataset.for);
    if (e.key === 'Escape') {
      e.preventDefault();
      const back = source();
      dismissedId = tipEl.dataset.for;   // 돌아가는 포커스가 다시 띄우지 못하게
      hideTip();
      back?.focus();
      return;
    }
    if (e.key !== 'Tab') return;
    const btns = [...tipEl.querySelectorAll('[data-put]')];
    const i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.shiftKey && i === 0) {
      e.preventDefault();
      source()?.focus();
    } else if (!e.shiftKey && i === btns.length - 1) {
      const tokens = [...layer.querySelectorAll('.token')];
      const next = tokens[tokens.indexOf(source()) + 1];
      // 마지막 물건이었으면 **아무것도 하지 않는다** — 브라우저가 알아서 다음으로 보낸다.
      // 처음에는 여기서 blur() 를 불렀는데, 그러면 포커스가 <body> 로 떨어져
      // 키보드로 쓰는 사람이 페이지 맨 위부터 다시 Tab 해야 한다. 막을 때만 막는다.
      if (next) { e.preventDefault(); next.focus(); }
    }
  });

  // 말풍선 안 버튼에서 포커스가 완전히 빠져나가면 닫는다.
  tipEl.addEventListener('focusout', (e) => {
    if (tipEl.contains(e.relatedTarget) || layer.contains(e.relatedTarget)) return;
    hideTip();
  });

  /* ---------------------------------------------------------------- */
  /* 드래그                                                            */
  /* ---------------------------------------------------------------- */

  /** 지금 끄는 물건이 무언가 일으킬 수 있는 상대들을 표시한다. */
  function markTargets(item) {
    const accepts = DROPS[item.kind] ?? {};
    for (const other of items) {
      const oe = elFor(other.id);
      if (!oe || other.id === item.id) continue;
      oe.classList.toggle('token--target', Boolean(accepts[other.kind]));
      oe.classList.toggle('token--inert', !accepts[other.kind]);
    }
  }

  function clearMarks() {
    layer.querySelectorAll('.token').forEach((el) => {
      el.classList.remove('token--target', 'token--inert', 'token--target-hot');
    });
  }

  function onPointerDown(e, item, el) {
    if (e.button !== undefined && e.button !== 0) return;
    // 손가락으로 물건을 꾹 눌러 끌면, 브라우저가 그것을 **글자를 고르려는 동작**으로 읽고
    // 돋보기와 「복사」 메뉴를 띄운다. 그러면 끌기는 그 자리에서 끊긴다.
    // touch-action:none 은 스크롤·확대만 막을 뿐 이 선택 동작은 못 막는다 — 여기서 막는다.
    e.preventDefault();
    hideTip();
    el.setPointerCapture(e.pointerId);
    drag = {
      pointerId: e.pointerId, item, el,
      startClientX: e.clientX, startClientY: e.clientY,
      startX: item.x, startY: item.y,
      moved: false, lastDx: 0, lastDy: 0, prevTx: 0, prevTy: 0,
      rects: captureRects(item.id),
    };
    el.classList.add('token--dragging');
    // 편집 모드에서는 놓을 곳 표시가 없다. 조작이 일어나지 않으니 표시할 것도 없다.
    if (!edit) markTargets(item);
  }

  /** 화면에서 끈 픽셀을 실험대 위 밀리미터로 바꾼다. 무대가 커지든 작아지든 같은 거리를 옮긴다. */
  function pxToMm() {
    const w = layer.getBoundingClientRect().width || 1;
    return STAGE_W_MM / w;
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const tx = e.clientX - drag.startClientX;
    const ty = e.clientY - drag.startClientY;
    drag.lastDx = tx - drag.prevTx;
    drag.lastDy = ty - drag.prevTy;
    drag.prevTx = tx; drag.prevTy = ty;
    if (Math.hypot(tx, ty) > DRAG_THRESHOLD_PX) drag.moved = true;
    const k = pxToMm();
    drag.item.x = drag.startX + tx * k;
    drag.item.y = drag.startY + ty * k;
    drag.el.style.left = `${xPct(drag.item.x)}%`;
    drag.el.style.top = `${yPct(drag.item.y)}%`;

    if (edit) return;

    const target = targetUnder();
    // 지금 무엇 위에 있는지 표시한다.
    for (const other of items) elFor(other.id)?.classList.remove('token--target-hot');
    if (target && DROPS[drag.item.kind]?.[target.kind]) {
      elFor(target.id)?.classList.add('token--target-hot');
    }
  }

  /**
   * 마지막으로 **포인터로** 탭을 처리한 시각.
   *
   * 마우스로 누르면 pointerup 뒤에 click 이벤트가 이어서 온다. 둘 다 처리하면 한 번 눌렀는데
   * 두 번 일어난다. 그렇다고 click 을 안 들으면, 포인터를 쓰지 않고 `element.click()` 으로
   * 누르는 길(음성 제어·스크린리더 같은 보조기기)이 통째로 막힌다.
   * 그래서 click 은 듣되, 방금 포인터로 처리한 것이면 넘긴다.
   */
  let pointerTapAt = 0;
  const POINTER_TAP_GRACE_MS = 500;

  /**
   * 마지막으로 **포인터로** 물건을 탭한 시각 — 위와 뜻이 다르다.
   *
   * 위 `pointerTapAt` 은 「뒤따라올 합성 click 을 삼켜라」는 뜻이라 **Enter/Space 에서도** 찍는다.
   * 그런데 포커스 말풍선을 낼지 정하는 데 그 값을 같이 읽고 있었다. 그래서
   * **키보드로 물건을 한 번 조작하면 그 뒤로 「여기에 놓기」 버튼이 안 나왔다.**
   * 조작하면 다시 그리면서 포커스를 돌려주는데, 그 focus 가 방금 찍힌 값에 걸려 막혔다.
   * 포커스는 안 움직이므로 focus 가 다시 날 일도 없어서 — **그 물건에 서 있는 동안 계속** 막힌다.
   * 키보드로 실험하는 사람은 첫 조작에서 길이 끊긴다.
   *
   * 막고 싶었던 것은 **손가락·마우스로 눌렀을 때**뿐이다(누를 때마다 말풍선이 떠서
   * 안 사라지는 창이 된다). 그건 포인터 쪽에서만 찍으면 된다.
   * 같은 값을 두 뜻으로 읽으면 이렇게 된다. 뜻이 둘이면 값도 둘이어야 한다.
   *
   * ── 이 값이 지금 실제로 하는 일 ─────────────────────────────────
   * **크로뮴에서는 아무 일도 안 한다.** 재 봤다 — 마우스로 클릭해도 손가락으로 눌러도
   * 물건에 포커스가 가지 않는다(`activeElement` 가 `<body>` 그대로다).
   * `onPointerDown` 의 `preventDefault()` 가 막기 때문이다. 그래서 `focus` 핸들러는
   * 키보드와 보조기기에서만 돌고, 이 억제는 걸릴 일이 없다.
   *
   * 그래도 지우지 않고 뒀다. `preventDefault()` 가 포커스까지 막아 주는지는 엔진마다 다르고,
   * **아이패드(웹킷)에서 확인하지 못했다** — 이 기계에 웹킷이 깔려 있지 않다.
   * 거기서 포커스가 간다면 손가락으로 누를 때마다 말풍선이 떠서 안 사라지는 창이 된다.
   * **재 보지 못한 것을 「없다」고 적지 않는다.**
   *
   * 크로뮴에서 정말로 안 걸리는지는 `scripts/check-screen.mjs` 의
   * 「손가락으로 눌러도 물건에 포커스가 가지 않는다」가 지킨다 —
   * 그 줄이 빨간불이 되면 이 억제가 비로소 일하기 시작한 것이다.
   */
  let pointerHoldAt = 0;

  /** 탭(포인터로 움직임 없이 누르고 뗌) 또는 키보드 활성화(Enter/Space) 로 여는 동작. */
  function handleTap(item, el) {
    // 편집 모드에서 확대 뷰가 열리면 옮기던 흐름이 끊긴다. 자리만 옮기는 모드다.
    if (edit) return;
    TAPS[item.kind]?.(item, el);
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    // 손을 뗀 자리를 마지막으로 한 번 더 반영한다.
    //
    // 아주 빠르게 끌어 놓으면 중간 이동 이벤트가 한 번도 안 올 수 있다 (기기·브라우저에 따라
    // 눌렀다 뗀 두 지점만 온다). 그때 이동만 보고 판정하면 실제로 끌었는데도 제자리 탭으로
    // 처리돼 아무 일도 일어나지 않는다. **누른 곳과 뗀 곳이 얼마나 떨어졌는가**로 가른다.
    onPointerMove(e);
    const { item, el, moved } = drag;
    el.releasePointerCapture(e.pointerId);
    el.classList.remove('token--dragging');
    clearMarks();

    if (!moved) {
      // 움직이지 않았다면 조작이 아니라 탭이다.
      drag = null;
      pointerTapAt = performance.now();
      pointerHoldAt = performance.now();
      handleTap(item, el);
      renderTokens();
      return;
    }

    // 편집 모드 — 조작은 일어나지 않고, 놓은 자리에 그대로 남는다.
    if (edit) {
      placeFreely(item);
      item.homeX = item.x;
      item.homeY = item.y;
      drag = null;
      renderTokens();
      renderEditPanel();
      return;
    }

    const target = targetUnder();
    const run = target ? DROPS[item.kind]?.[target.kind] : null;
    if (run) run(item, target);

    // 쓴 물건은 언제나 제자리로 돌아간다.
    //
    // 놓인 자리는 결과에 아무 영향을 주지 않는데, 물건이 놓인 채로 남으면 자리가 뜻을 갖는 것처럼
    // 보인다 — 현미경 위에 얹힌 받침 유리는 재물대에 올라간 것처럼 보인다(실제로는 아니다).
    // 재물대에 올라가 화면에서 사라진 받침 유리도 마찬가지로 되돌려 둔다.
    // 그러지 않으면 내렸을 때 현미경 위에 겹쳐 나타나 다시 집을 수가 없다.
    item.x = item.homeX;
    item.y = item.homeY;
    drag = null;
    renderTokens();
  }

  function renderTokens() {
    // 키보드 활성화(Enter/Space)로 조작하면 상태가 바뀌어 여기로 다시 들어오는데,
    // 매번 새 <button> 을 만들면 포커스가 <body> 로 빠져 Tab 흐름이 끊긴다.
    // 같은 id 를 가진 새 요소로 포커스를 옮겨 준다.
    const focusedId = layer.contains(document.activeElement) ? document.activeElement.dataset.id : null;
    layer.innerHTML = '';
    for (const item of items) {
      if (isHidden(item)) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `token token--${item.kind}`;
      el.dataset.id = item.id;
      el.dataset.tool = item.asset;
      el.dataset.kind = item.kind;
      // 크기와 위치를 전부 무대 비율로 낸다. 배경 애셋과 같은 자로 재어지므로
      // 창 크기가 바뀌어도 realSizeMm 비례와 배경 위 자리가 함께 유지된다.
      el.style.left = `${xPct(item.x)}%`;
      el.style.top = `${yPct(item.y)}%`;
      el.style.width = `${widthPct(item.asset)}%`;
      // 잡는 영역을 **그려진 부분**에 맞춰 준다 (`index.html` 의 `.token::after`).
      // 그림에 포인터를 맡기면 칠해지지 않은 여백까지 받아, 눈에는 떨어져 보이는 물건이
      // 옆엣것의 클릭을 가로챈다 — 휴지 여백이 핀셋 한가운데를 가로챈 적이 있다.
      {
        const c = CONTENT_BOX[item.asset];
        const [, , vw, vh] = CONTRACT[item.asset].viewBox.split(/\s+/).map(Number);
        el.style.setProperty('--hit-x', `${(((c.x0 + c.x1) / 2) / vw) * 100}%`);
        el.style.setProperty('--hit-y', `${(((c.y0 + c.y1) / 2) / vh) * 100}%`);
        el.style.setProperty('--hit-w', `${((c.x1 - c.x0) / vw) * 100}%`);
        el.style.setProperty('--hit-h', `${((c.y1 - c.y0) / vh) * 100}%`);
      }
      el.setAttribute('aria-label', item.label);
      el.setAttribute('aria-describedby', 'bench-tip');
      el.innerHTML = ASSETS[item.asset].render(assetState(item));
      // 이름표는 **그림 아래**에 붙는다. 프레임 아래가 아니다 — 애셋마다 여백이 달라서
      // 프레임 기준으로 달면 어떤 것은 물건에 붙고 어떤 것은 한참 떨어진다.
      const c = CONTENT_BOX[item.asset];
      const [, , vw, vh] = CONTRACT[item.asset].viewBox.split(/\s+/).map(Number);
      el.insertAdjacentHTML('beforeend',
        `<i class="token-name" style="left:${((c.x0 + c.x1) / 2 / vw) * 100}%;`
        + `top:${(c.y1 / vh) * 100}%">${UI.bench.shortNames[item.labelKey] ?? item.label}</i>`);
      // 스크린샷 한 장으로 자리를 읽을 수 있어야 한다. 물건마다 x(mm)를 달아 둔다.
      if (edit) el.insertAdjacentHTML('beforeend', `<i class="edit-x-tag">${Math.round(item.x)}, ${Math.round(item.y)}</i>`);

      el.addEventListener('pointerdown', (e) => onPointerDown(e, item, el));
      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', onPointerUp);
      el.addEventListener('pointercancel', onPointerUp);

      // 말풍선은 **마우스로 올렸을 때만** 뜬다.
      //
      // 손가락에는 hover 가 없다. 그런데 브라우저는 터치에도 pointerenter 를 한 번 쏘므로,
      // 이걸 그대로 받으면 스마트폰에서 물건을 누를 때마다 말풍선이 떴다가
      // 화면 어딘가를 다시 누를 때까지 남아 실험대를 가린다. 실제로 그랬다.
      /**
       * 마우스를 올리면 말풍선 — **키보드로 열어 둔 것은 빼앗지 않는다.**
       *
       * 조작을 하면 실험대가 통째로 다시 그려지는데, 그때 **가만히 있던 마우스 포인터 밑에
       * 새 물건이 들어서면 브라우저가 `pointerenter` 를 다시 쏜다.** 그러면 키보드로 다른
       * 물건에 포커스를 주어 띄워 둔 「여기에 놓기」 버튼이, 마우스가 움직이지도 않았는데
       * **엉뚱한 물건의 말풍선으로 덮였다.** 마우스를 못 쓰는 사람에게는 그 버튼이
       * 끌어다 놓는 길의 전부인데, 옆에 마우스가 놓여 있다는 이유로 길이 닫힌 것이다.
       *
       * 검사가 여섯 번에 두세 번 그 자리에서 멈춰서 잡혔다. 멈춘 화면을 찍어 보니
       * **포커스는 핀셋인데 말풍선은 「비커」**였다. 사람 눈으로 볼 수 있는 종류가 아니다.
       *
       * 마우스끼리는 서로 덮어써도 된다. 지키는 것은 **키보드로 연 것** 하나뿐이다.
       */
      el.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        if (tipFromKeyboard && layer.contains(document.activeElement)) return;
        // 사람이 Esc 로 치운 말풍선은 **마우스도 되살리지 못한다.**
        // 이게 없으면 Esc 가 그때뿐이다 — 마우스를 물건 위에 얹어 둔 채로 조작하면
        // 다시 그릴 때 pointerenter 가 다시 쏘여 치운 말풍선이 도로 뜬다.
        // 시행이 도는 동안에는 시계가 갈 때마다 그러므로 **치워도 계속 돌아온다.**
        //
        // 대신 이런 자리가 남는다 — Esc 로 치운 물건에 **마우스를 새로 올려도 안 뜬다.**
        // 아래 pointerleave 가 풀어 주므로, 한 번 벗어났다 오면 정상으로 돌아온다.
        // 「마우스가 움직였는가」로 가르면 이 자리도 없앨 수 있지만, 그러면 손을 살짝
        // 스치기만 해도 치운 말풍선이 되살아난다 — 그게 애초에 고치려던 그 버그다.
        // **덜 뜨는 쪽으로 틀리는 것**을 골랐다. 가려서 못 보는 것보다 낫다.
        if (dismissedId === item.id) return;
        showTip(item);
      });
      // 나갈 때도 같은 기준이다 — 마우스가 지나갔다고 키보드 쪽 말풍선을 닫지 않는다.
      el.addEventListener('pointerleave', () => {
        // 마우스가 실제로 물건을 벗어났으면 「치웠다」를 푼다 — 다시 올리면 또 보여야 한다.
        // 치운 것은 그 자리에서 가리지 말라는 뜻이지 다시는 보지 않겠다는 뜻이 아니다.
        if (dismissedId === item.id) dismissedId = null;
        if (tipFromKeyboard && layer.contains(document.activeElement)) return;
        hideTip();
      });
      /**
       * 포커스로 뜬 말풍선에는 **놓을 곳 버튼**이 함께 나온다 — 키보드로 놓는 유일한 길이다.
       *
       * 예전에는 `el.matches(':focus-visible')` 로 걸렀다. 뜻은 맞았는데 —
       * 손가락으로 눌러도 `<button>` 은 포커스를 받으므로 그때까지 띄우면 안 사라지는 창이 된다 —
       * **`:focus-visible` 은 브라우저가 「지금 키보드를 쓰는 중인가」를 어림잡는 값**이다.
       * 마우스를 쓴 뒤 `focus()` 에 이게 안 붙는 조합이 있으면 보조기기로 물건을 짚었을 때
       * 버튼이 안 나온다. **다만 그런 조합을 실제로 본 적은 없다** — 여기서도, 같은 코드를
       * 쓰는 다른 두 실험에서도 재현되지 않았다(Chromium 은 잘 쳐 줬다). 적어 두는 이유는
       * 「고칠 이유가 있다」와 「버그를 봤다」가 다른 말이기 때문이다.
       *
       * 막고 싶었던 것은 「손가락 탭 직후」 하나뿐이고, 그것은 이미 `pointerTapAt` 으로
       * 재고 있다. 어림값 대신 **우리가 실제로 아는 것**을 본다.
       */
      el.addEventListener('focus', () => {
        if (performance.now() - pointerHoldAt < POINTER_TAP_GRACE_MS) return;
        // 다른 물건으로 옮겨 왔으면 「치웠다」를 푼다.
        if (dismissedId !== item.id) dismissedId = null;
        if (dismissedId === item.id) return;
        showTip(item, true);
      });
      // 포커스가 옮겨 갈 때 blur 가 focus 보다 먼저 온다. 여기서 곧바로 닫으면
      // 옆 물건으로 Tab 한 순간 말풍선이 닫혔다가 다시 열리며 서로를 지운다.
      // 닫기를 한 프레임 미루고, 그 사이 새 포커스가 오면 취소한다.
      el.addEventListener('blur', () => hideTipSoon());

      // 포인터를 거치지 않고 눌리는 경우 — 보조기기의 element.click() 등.
      // 방금 포인터로 처리했으면 같은 누름이므로 넘긴다.
      el.addEventListener('click', () => {
        if (performance.now() - pointerTapAt < POINTER_TAP_GRACE_MS) return;
        handleTap(item, el);
      });

      // 키보드 활성화(Enter/Space).
      // 브라우저는 <button> 에서 Enter/Space 를 click 으로도 바꿔 주지만, 그 전에
      // Space 가 페이지를 스크롤시킨다. preventDefault 하려면 keydown 을 직접 들어야 한다.
      el.addEventListener('keydown', (e) => {
        /**
         * Tab → 말풍선의 「여기에 놓기」 버튼으로. **다리를 놓지 않으면 닿을 수 없다.**
         *
         * 말풍선은 DOM 에서 물건들 **뒤**에 있다. 그래서 그냥 Tab 하면 옆 물건으로 가고,
         * 그 물건의 focus 가 말풍선을 제 것으로 갈아 끼워 **방금 열려 있던 버튼이 사라진다.**
         * 물건을 하나씩 지나 말풍선 자리에 닿을 즈음에는 마지막 물건의 말풍선만 남아 있다.
         *
         * 재 보고 알았다 — Tab 을 여든 번 눌러도 **어느 물건에서도 놓기 버튼에 닿지 못했다.**
         * 버튼은 화면에 멀쩡히 떠 있고 눌리기도 하는데, 키보드로는 갈 수가 없었다.
         * 검사는 통과하고 있었다. `.click()` 으로 직접 눌렀기 때문이다 —
         * **사람이 못 가는 버튼을 검사만 누르고 있었다.**
         *
         * 마우스를 못 쓰는 사람에게 이 버튼은 실험을 시작하는 유일한 길이다.
         */
        // 포커스를 그대로 둔 채 말풍선만 치운다. 말풍선이 옆 물건을 가려서 안 보일 때 쓴다.
        if (e.key === 'Escape' && !tipEl.hidden) {
          e.preventDefault();
          dismissedId = item.id;
          hideTip();
          return;
        }
        if (e.key === 'Tab' && !e.shiftKey && !tipEl.hidden) {
          const first = tipEl.querySelector('[data-put]');
          if (first) { e.preventDefault(); first.focus(); return; }
        }
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        pointerTapAt = performance.now();   // 뒤따라올 click 을 삼킨다
        handleTap(item, el);
      });

      layer.appendChild(el);
    }
    layoutNames();
    if (focusedId) layer.querySelector(`[data-id="${focusedId}"]`)?.focus();
  }

  /**
   * 이름표가 서로 겹치면 아래 줄로 내린다.
   *
   * 물건 사이가 좁으면 이름표끼리 부딪혀 글자가 겹쳐 읽을 수 없게 된다.
   * 배치는 사람이 편집 모드에서 정하는 것이라 어떤 간격이 올지 여기서는 알 수 없다 —
   * 그러니 배치를 제한하지 말고, 부딪히는 것만 한 줄 내린다.
   * 왼쪽부터 훑으며 줄마다 "지금까지 찬 오른쪽 끝"을 기억해 첫 빈 줄에 앉힌다.
   */
  const NAME_ROW_PX = 15;   // index.html 의 .token-name 이 한 줄에 내려가는 거리와 같아야 한다
  const NAME_GAP_PX = 4;

  /**
   * **폭이 바뀌면 이름표를 다시 흩는다.**
   *
   * `layoutNames()` 는 그릴 때 한 번만 돈다. 그래서 넓게 열어 둔 창을 좁히면
   * 이름표가 그 자리에 그대로 남아 겹친다 — 재 봤더니 1400px 에서 0짝이던 것이
   * 390px 으로 줄이자 **7짝**이 됐다(「100 ℃↔비커」…). 다시 그릴 일이 없으니 아무도 안 흩는다.
   *
   * ★ **폭이 그대로면 아무것도 안 한다.** 이름표를 옮기면 그 자체가 크기 변화로 잡혀
   * 다시 부르고, 그러면 돌고 돈다. 잰 폭이 같으면 그 자리에서 돌아선다.
   */
  let lastStageW = 0;
  const stageEl = root.querySelector('.bench-stage');
  if (stageEl && typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      const w = Math.round(stageEl.getBoundingClientRect().width);
      if (w === lastStageW) return;
      lastStageW = w;
      layoutNames();
    }).observe(stageEl);
  }

  function layoutNames() {
    const names = [...layer.querySelectorAll('.token-name')];
    if (names.length === 0) return;
    for (const n of names) n.style.removeProperty('--name-row');
    // 선반 이름표와 작업면 이름표는 서로 부딪힐 일이 없다. 가로만 보고 밀면
    // 한참 위아래로 떨어진 둘을 겹친 것으로 치고 애먼 이름표를 내려 보낸다 — 실제로 그랬다.
    // 가로·세로를 함께 본다.
    const placed = [];
    const sorted = names
      .map((n) => ({ el: n, r: n.getBoundingClientRect() }))
      .sort((a, b) => a.r.left - b.r.left);
    for (const { el, r } of sorted) {
      let row = 0;
      const clash = (dy) => placed.some((p) =>
        r.left < p.right + NAME_GAP_PX && r.right + NAME_GAP_PX > p.left
        && r.top + dy < p.bottom && r.bottom + dy > p.top);
      while (clash(row * NAME_ROW_PX)) row++;
      const dy = row * NAME_ROW_PX;
      placed.push({ left: r.left, right: r.right, top: r.top + dy, bottom: r.bottom + dy });
      if (row > 0) el.style.setProperty('--name-row', row);
    }
  }

  /**
   * 실험대는 탐구 노트를 읽기 전에는 열리지 않는다.
   *
   * 이것은 **조작을 막는 것이 아니다.** 조작이 시작되기 전, 무엇을 하려는 실험인지
   * 읽는 자리를 만드는 것이다 — 열린 뒤로는 어떤 조작도 막지 않는다 (AGENTS.md §2.1).
   * 앞서는 실험대와 탐구 노트가 따로 놀아서, 노트를 한 번도 열지 않고 물건부터 끄는
   * 학생이 대부분이었다.
   *
   * 배치 편집 모드(`?edit=1`)는 자물쇠를 걸지 않는다 — 거기는 학생 화면이 아니다.
   */
  function lockState() {
    if (edit) return { locked: false, left: [] };
    const read = store.getState().session.readStages ?? [];
    const left = UI.bench.lock.required.filter((id) => !read.includes(id));
    return { locked: left.length > 0, left };
  }

  const lockEl = root.querySelector('#bench-lock');

  function renderLock() {
    const { locked, left } = lockState();
    lockEl.hidden = !locked;
    root.classList.toggle('bench--locked', locked);
    if (!locked) return;
    const titleOf = (id) => UI.notebook.stages.find((st) => st.id === id)?.title ?? id;
    root.querySelector('#bench-lock-left').innerHTML =
      left.map((id) => `<li>${id}. ${titleOf(id)}</li>`).join('');
  }

  /**
   * 실험대 위 막대. **지금 시행이 어떻게 되고 있는지**를 늘 보여 준다.
   *
   * 시계가 화면에 없으면 학생 눈에는 시간이 저절로 나오는 것처럼 보인다.
   * 이 실험에서 재는 것이 시간 하나뿐이라 그러면 안 된다.
   */
  function renderBar() {
    const st = store.getState();
    const b = st.bench.beaker;
    const C = UI.bench.clock;
    const undosLeft = st.session.undosLeft;
    root.querySelector('#undo-left').textContent =
      undosLeft === Infinity ? UI.undo.unlimited : UI.undo.left(undosLeft);

    takeOutBtn.hidden = !b.inBath;
    if (b.inBath) takeOutBtn.textContent = UI.bench.takeOut(b.tempC);

    root.querySelector('#clock').textContent = !b.disc ? C.idle
      : b.floated ? C.floated(b.floatedAtS)
        : b.elapsedS >= OBSERVE_LIMIT_S ? C.notFloated(OBSERVE_LIMIT_S)
          : `${C.running(b.elapsedS)} · ${C.speed(CLOCK_SPEED)}`;

    root.querySelector('#trials').textContent = UI.bench.trials(st.trials.length);
  }

  /**
   * 관찰 창 — 비커 안에서 원반이 떠오르는 그림.
   *
   * 실험대의 비커 토큰은 화면에서 40 px 남짓이라 원반이 보이지 않는다. 이 실험은
   * **보는 것이 결과 전부**이므로 크게 그릴 자리가 따로 있어야 한다.
   */
  function renderWatch() {
    const b = store.getState().bench.beaker;
    root.querySelector('#bench-watch').innerHTML = renderBeaker({
      conditions: beakerConditions(b),
      elapsedS: b.elapsedS,
      hasDisc: Boolean(b.disc),
      seed: store.getState().session.seed,
    }, { idPrefix: 'watch' });
  }

  // 드래그 도중에는 다시 그리지 않는다. TICK 처럼 사용자와 무관하게 들어오는 상태 변경이
  // DOM 을 새로 만들면 setPointerCapture 가 무효화돼 드래그가 조용히 끊긴다.
  // 드래그가 끝나면 onPointerUp 이 최신 상태로 어차피 다시 그린다.
  store.subscribe(() => {
    renderBar();
    renderWatch();
    renderLock();
    if (!drag) renderTokens();
  });
  renderTokens();
  renderBar();
  renderWatch();
  renderLock();
  renderEditPanel();
}
