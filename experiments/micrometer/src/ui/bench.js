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
import { ITEM_IDS } from '../sim/state.js';
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
const SURFACE_MM = (LANDMARKS.surfaceFrontY / 300) * STAGE_H_MM; // 작업면 앞 모서리

const DRAG_THRESHOLD_PX = 6;

/**
 * 잡을 수 있는 최소 크기 (px). `.token::after` 가 화면에서 보장하는 값과 같아야 한다.
 * 덮개 유리는 실물 22 mm 라 그림이 아주 작은데, 놓기 판정을 그림 크기로 하면
 * 눈에 보이는 넓은 영역에 갖다 대도 아무 일이 안 일어난다 — 잡히지 않는 것처럼 보인다.
 */
const MIN_HIT_PX = 44;

/**
 * 문질러 바르기 — 받침 유리 **위에서 움직인 거리**(mm)로 두께가 정해진다.
 *
 * 누르고 있던 시간이 아니다. 허공에 오래 들고 있었다고 두껍게 발릴 수는 없고,
 * 실제로 문지르는 동작은 왕복 운동이기 때문이다.
 * 이 거리만큼 움직이면 가장 두껍게 발린다 (받침 유리 긴 변이 76 mm 이므로 여러 번 왕복).
 */
const SMEAR_FULL_MM = 700;
const SMEAR_MIN = 0.12;
const SMEAR_MAX = 0.9;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

/**
 * 실험대 위 배치. 좌표는 전부 **mm** 다.
 * `x` 는 왼쪽 끝, `bottom` 은 물건이 바닥을 대는 높이 — 선반 위인지 작업면 위인지.
 * 위쪽 좌표(y)는 실물 크기에서 계산하므로, `realSizeMm` 을 고치면 자리도 알아서 따라온다.
 */
function defaultItems() {
  /**
   * 선 위가 아닌 자리 — 편집 모드에서 미세 조정한 것이 이 모양으로 나온다.
   *
   * ★ **둘째 인자는 `y` 다** (편집 표의 두 번째 칸과 같은 값). 앞서는 `bottom`(바닥이 닿는
   *   높이)이었는데, 편집 모드가 화면에 적어 주는 것도 「코드 복사」가 뱉는 것도 `y` 라
   *   그 숫자를 그대로 붙여 넣으면 **애셋 높이만큼 어긋난 자리**에 놓였다.
   *   화면이 말한 숫자와 코드가 받는 숫자가 같아야 옮겨 적기가 성립한다.
   */
  const at = (x, y, rest) => ({ x, bottom: y + heightMm(rest.asset), ...rest });
  const I = UI.bench.items;
  return [
    // 상단 선반 — 왼쪽에서 오른쪽으로 **쓰는 순서**다. 접안 마이크로미터를 먼저 끼우고,
    // 대물 마이크로미터로 눈금값을 구하고, 표본을 잰다. 탐구 노트의 절차와 같은 순서라
    // 학생이 노트와 실험대 사이를 오갈 때 눈이 같은 방향으로 움직인다.
    //
    // 접안 마이크로미터 통. **통 애셋을 그린다** — 앞서는 `ocular` 애셋에 `inCase` 상태를
    // 켜서 통을 대신했는데, 원판에 테두리가 한 겹 더 생길 뿐이라 실험대에서 통으로 읽히지
    // 않았다 (「접안 마이크로미터 통이 통 같지 않아」). 통이라고 말하는 것은 색이 아니라 선이다.
    // 자리는 **이름표가 한 줄에 다 앉도록** 잡았다. 그림은 작아도 이름표는 그림보다
    // 훨씬 넓어서(「접안 마이크로미터 통」 이 173 mm), 그림 간격만 보고 벌리면 이름표가
    // 서로 밀려 아래 줄로 내려가고 선반이 지저분해진다. 이름표 폭을 재어 중심 간격을 잡고
    // 거기서 그림 위치를 거꾸로 냈다.
    //
    // ★ 아래 일곱 좌표는 **사장님이 편집 모드(`?edit=1`)에서 직접 잡아 보내신 값**이다
    //   (2026-09-03). 「내가 미세하게 조정할거야. 내 마음대로 할거야.」 — 보기 좋게
    //   다시 정렬하거나 선에 붙이지 말 것. 옮길 일이 생기면 편집 모드에서 다시 받는다.
    at(312, 203, { id: 'ocularCase', asset: 'ocularbox', kind: 'ocularBox', labelKey: 'ocularCase' }),
    // 접안 마이크로미터 **원판**. 통 바로 옆에 꺼내 둔 채로 시작한다.
    // 통만 놓여 있으면 학생은 통을 현미경에 끌어다 놓는다 — 통을 끼우는 그림이 되고,
    // 「렌즈 안에 들어가는 것은 원판」이라는 이 실험의 중심이 첫 조작부터 흐려진다.
    at(455, 199, { id: 'ocular', asset: 'ocular', kind: 'ocular', labelKey: 'ocular' }),
    // 대물 마이크로미터 보관함. 금이 갔을 때 새것을 꺼내는 곳이기도 한데, 앞서는 그 자리가
    // 표본 상자뿐이었다 — 대물 마이크로미터를 표본 상자에서 꺼내는 그림은 거짓말이고,
    // 학생은 그 거짓말을 실험 순서로 배운다.
    at(679, 175, { id: 'stageMicBox', asset: 'stagemicbox', kind: 'stageMicBox', labelKey: 'stageMicBox' }),
    at(837, 198, { id: 'stageMic', asset: 'stagemic', kind: 'stageMic', item: 'stageMic', labelKey: 'stageMic' }),
    // 표본 상자. 다 쓴 표본을 도로 넣는 자리이자 깨졌을 때 새것을 꺼내는 자리다.
    // 받침 유리 통 그림을 그대로 쓴다 — 실제로 같은 물건(슬라이드를 세워 담는 상자)이다.
    at(1089, 169, { id: 'specimenBox', asset: 'slidebox', kind: 'specimenBox', labelKey: 'specimenBox' }),
    at(1232, 199, { id: 'specimen', asset: 'specimen', kind: 'specimen', item: 'specimen', labelKey: 'specimen' }),
    at(880, 337, { id: 'microscope', asset: 'microscope', kind: 'microscope', labelKey: 'microscope' }),
    /**
     * 쓰레기통 — **깨진 표본·대물 마이크로미터를 버리는 곳**.
     *
     * 작업면 왼쪽 끝에 둔다. 현미경(그림 x 956~1135)과 한참 떨어져 있어야 재물대에
     * 올리려다 잘못 놓는 일이 없고, 재물대에서 내려놓는 자리(`UNMOUNT_SPOT`, x 620·740)
     * 와도 안 겹친다. 겹치면 뒤엣것이 앞엣것의 클릭을 가로챈다.
     */
    at(200, 401, { id: 'bin', asset: 'bin', kind: 'bin', labelKey: 'bin' }),
  ].map((it) => ({ ...it, label: I[it.labelKey], y: it.bottom - heightMm(it.asset) }));
}

/**
 * 재물대에서 내린 물건이 놓이는 자리 (mm). **선반의 제자리가 아니다.**
 *
 * 사장님 지시(2026-09-03): 「깨진 것을 선반에 도로 꽂는 그림은 틀렸다. 내리면 현미경
 * 왼쪽 실험대 위에 놓여야 한다.」 거기서 학생이 쓰레기통으로 끌어다 버린다.
 * 현미경 x 는 880 이므로 그 **왼쪽**, 작업면 높이에 둘을 나란히 둔다 —
 * 둘이 같은 자리면 하나가 다른 하나의 클릭을 가로챈다.
 */
const UNMOUNT_SPOT = {
  stageMic: { x: 620, bottom: SURFACE_MM },
  specimen: { x: 740, bottom: SURFACE_MM },
};

/**
 * 끌어다 놓았을 때 무슨 일이 일어나는가. **종류 쌍**으로만 적는다.
 *
 * 상태(핀셋이 지금 덮개 유리를 들고 있는가 같은 것)는 여기서 보지 않는다.
 * 빈손 핀셋을 받침 유리에 대면 rules.js 가 "손으로 집으려 하니 미끄러집니다" 라고 답해 주는데,
 * 그 답을 듣는 것이 이 실험에서 배우는 내용이다. 여기서 미리 걸러 내면 들을 기회가 사라진다.
 * 그래서 드래그 중 하이라이트는 "된다" 가 아니라 **"여기에 무언가 일어난다"** 는 표시다.
 *
 * 이 표 하나가 세 곳에 함께 쓰인다 — 실제 실행, 드래그 중 대상 하이라이트, 안내 문구 유무.
 * 셋을 따로 적으면 조작을 하나 늘릴 때마다 세 곳이 어긋난다.
 */
export function dropTable(store, openZoom = () => {}) {
  return {
    // 접안 마이크로미터를 현미경에 대면 확대 뷰가 열린다. **끼우는 방향을 거기서 고른다** —
    // 실험대에서 끌어다 대는 것만으로는 뒤집혔는지 아닌지를 정할 길이 없다.
    ocular: {
      microscope: () => openZoom('ocular', null, 'ocular'),
      // 제자리는 자기 통이다. 누르는 것과 끌어다 놓는 것, 두 길 다 열어 둔다 —
      // 정리는 늦게라도 하면 위반 기록에서 지워지는 일이라 길이 막히면 안 된다.
      ocularBox: () => store.dispatch('PUT_AWAY_OCULAR', {}),
    },
    /**
     * 재물대에 올린다. **순서를 강제하지 않는다** — 표본을 먼저 올려도 막지 않고,
     * 견줄 눈금자가 없다는 것이 시야에 그대로 보인다.
     *
     * ★ **접안 마이크로미터와 같은 모양이다** (사장님 지시 2026-09-03) —
     *   ① 자기 상자(도로 넣기) ② 현미경(재물대에 올리기). 거기에 ③ 쓰레기통이 붙는다.
     *   원판에는 쓰레기통이 없다 — 렌즈 안에 있는 것이라 깨지지 않는다.
     *
     *   상자에 놓는 것이 앞서는 `NEW_ITEM`(새것 꺼내기)이었다. 그러면 **다 쓴 것을
     *   정리하려고 상자에 넣었는데 새것이 튀어나온다** — 넣는 손짓이 꺼내는 일이 된다.
     *   이제 넣는 것은 넣는 것이고(`PUT_AWAY_ITEM`), 꺼내는 것은 상자를 눌러 연 화면의
     *   「꺼내기」다.
     */
    stageMic: {
      microscope: (item) => store.dispatch('PLACE_ON_STAGE', { item: item.item }),
      // 제자리는 **자기 보관함**이다. 표본 상자로 가던 것을 여기로 옮겼다 —
      // 대물 마이크로미터를 표본 상자에 넣는 그림은 거짓말이고, 그 거짓말이 실험 순서로 남는다.
      stageMicBox: (item) => store.dispatch('PUT_AWAY_ITEM', { item: item.item }),
      bin: (item) => store.dispatch('DISCARD_ITEM', { item: item.item }),
    },
    specimen: {
      microscope: (item) => store.dispatch('PLACE_ON_STAGE', { item: item.item }),
      // 상자에 도로 넣는다. 금 간 것을 치우는 길은 쓰레기통이다.
      specimenBox: (item) => store.dispatch('PUT_AWAY_ITEM', { item: item.item }),
      bin: (item) => store.dispatch('DISCARD_ITEM', { item: item.item }),
    },
  };
}

/**
 * 물건을 클릭(또는 Enter/Space)했을 때. 끌어다 놓는 조작과 달리 대상이 필요 없는 것들.
 *
 * 시약병·폐액통·휴지의 안전 수칙은 늦게라도 하면 자기 평가의 위반 기록에서 지워진다
 * (rules.js 의 safetyAction). 그 셋을 부르는 곳이 여기 말고는 없다 —
 * 없으면 위반 기록이 한 번 남고 영영 지워지지 않는다.
 */
export function tapTable(store, onOpenZoom) {
  return {
    // 현미경을 누르면 확대 뷰가 열린다. 여기서 눈금을 보고, 세고, 기록한다.
    microscope: (item, el) => onOpenZoom('scope', store.getState().microscope.stage, el),
    /**
     * 통·상자 셋은 **한 화면으로 통일했다** (사장님 지시 2026-09-03).
     *
     * 누르면 **열린 통 안**이 보이고, 단추는 「꺼내기」 하나다. 앞서는 접안 통만 다른
     * 화면(원판 그림 + 단추 넷)이었고, 대물 보관함·표본 상자는 「기구 살펴보기」였다 —
     * 셋이 같은 일을 하는데 화면이 셋 다 달랐다.
     *
     * 누르는 것만으로 되돌아갈 수 없는 자리가 생기면 안 된다 (AGENTS.md §2.1).
     * 넣는 것은 손짓(`dropTable`)이 하고, 꺼내는 것은 이 화면이 한다.
     */
    ocularBox: (item, el) => onOpenZoom('box', 'ocularBox', el),
    specimenBox: (item, el) => onOpenZoom('box', 'specimenBox', el),
    stageMicBox: (item, el) => onOpenZoom('box', 'stageMicBox', el),
    /**
     * 꺼낸 물건 셋도 **누르면 자기 화면이 열린다** — 셋이 같은 손짓, 같은 화면이다
     * (사장님 지시 2026-09-03).
     *
     * ★ 앞서는 셋 다 눌러도 아무 일이 없었다. 원판 화면은 **통을 눌러야** 열렸고
     *   (통 화면에서 렌즈에 끼우는 그림이 됐다), 유리판·표본 화면은 **상자를 눌러야**
     *   열렸다. 물건을 눌러 물건을 보는 길이 어디에도 없었다.
     *   방향(뒤집어 끼우기)은 여전히 여기서 안 정한다 — 그 화면에서 학생이 고른다.
     */
    ocular: (item, el) => onOpenZoom('item', 'ocular', el),
    stageMic: (item, el) => onOpenZoom('item', 'stageMic', el),
    specimen: (item, el) => onOpenZoom('item', 'specimen', el),
    /**
     * 쓰레기통은 눌러도 아무것도 열지 않는다 — **버리는 일은 끌어다 놓는 손짓뿐**이다.
     * 누르면 버려지게 하면, 스쳐 누른 것 하나로 표본이 사라진다.
     * 말풍선이 무엇을 받는 곳인지 말하고, 키보드로는 물건 쪽 「여기에 놓기」로 간다.
     */
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
    return { id: it.id, x: it.x + d.dx, y: it.y + d.dy, w: d.w, h: d.h };
  });
}

/**
 * 실험대 배치의 **날 좌표** (mm). 편집 모드 표에 뜨는 두 칸(x, y)과 같은 값이다.
 *
 * 사장님이 편집 모드에서 잡아 보내신 숫자가 코드에 그대로 들어갔는지 검사가 물을 수 있어야
 * 한다 — `benchLayout()` 은 그림 여백(dx·dy)을 더한 뒤라 그 숫자와 다르다.
 */
export function benchItems() {
  return defaultItems().map((it) => ({ id: it.id, kind: it.kind, x: it.x, y: it.y }));
}

/**
 * 재물대에서 내려놓은 물건들의 mm 사각형. `benchLayout()` 과 같은 재는 법을 쓴다.
 *
 * 이 자리는 `defaultItems()` 에 없어서 겹침 검사가 지나친다 — 그런데 여기가 겹치면
 * 금 간 유리를 집으려는 순간 옆엣것이 잡힌다. 검사가 볼 수 있게 따로 내보낸다.
 */
export function unmountLayout() {
  const byItem = Object.fromEntries(defaultItems().filter((it) => it.item).map((it) => [it.item, it]));
  return Object.entries(UNMOUNT_SPOT).map(([itemId, spot]) => {
    const asset = byItem[itemId].asset;
    const d = drawnBoxMm(asset);
    return {
      id: `${itemId}@unmount`,
      x: spot.x + d.dx,
      y: spot.bottom - heightMm(asset) + d.dy,
      w: d.w,
      h: d.h,
    };
  });
}

/** 실험대에 놓인 물건들. 배치를 몰라도 종류만 알면 되는 검사에 쓴다. */
export const BENCH_KINDS = ['ocular', 'ocularBox', 'stageMic', 'stageMicBox', 'specimen', 'specimenBox', 'microscope', 'bin'];

/**
 * 배치를 다시 코드로 뱉는다 — 편집 모드에서 옮긴 자리를 그대로 `defaultItems()` 에 붙여 넣는다.
 *
 * 눈으로 옮긴 것을 손으로 숫자로 옮겨 적는 일은 반드시 어딘가 틀린다.
 * 옮긴 사람이 스크린샷만 보내면 되도록, 화면이 스스로 좌표를 말하게 한다.
 */
function layoutCode(items) {
  const lines = items.map((it) => {
    /*
     * ★ **한 가지 모양으로만 적는다 — `at(x, y)`.**
     *
     * 앞서는 선 위에 딱 선 것만 `shelf`/`surface` 로 짧게 적고 나머지는 `at(x, bottom)` 으로
     * 적었다. 두 가지 탈이 났다. 하나는 **화면에 적힌 숫자(y)와 코드가 받는 숫자(bottom)가
     * 달라서** 표를 보고 손으로 옮겨 적으면 애셋 높이만큼 어긋난 것. 다른 하나는 선에서
     * 0.5 mm 떨어진 자리를 `shelf(x)` 로 적어 **선생님이 맞춰 둔 몇 밀리미터가 적히는
     * 순간 사라진 것.** 이제 표의 두 칸(x, y)을 그대로 적는다.
     */
    const call = `at(${Math.round(it.x)}, ${Math.round(it.y)}`;
    const props = [
      `id: '${it.id}'`,
      `asset: '${it.asset}'`,
      `kind: '${it.kind}'`,
      it.slide ? `slide: '${it.slide}'` : null,
      it.reagent ? `reagent: '${it.reagent}'` : null,
      `labelKey: '${it.labelKey}'`,
    ].filter(Boolean).join(', ');
    return `    ${call}, { ${props} }),`;
  });
  return `// src/ui/bench.js 의 defaultItems() 안, 배열 자리에 그대로 붙여 넣습니다.\n${lines.join('\n')}`;
}

/**
 * @param {HTMLElement} root
 * @param {{getState:Function, dispatch:Function, subscribe:Function}} store
 * @param {{onOpenZoom:Function, edit?:boolean}} handlers
 *   edit — 배치를 옮겨 보는 모드. 조작은 일어나지 않고 물건이 놓인 자리에 그대로 남는다.
 */
export function createBench(root, store, { onOpenZoom, edit = false }) {
  root.classList.add('bench');
  // 배경과 물건을 같은 무대 안에 둔다. 무대가 4:3 을 지키므로 둘이 함께 스케일된다.
  // 안내 말풍선은 무대 바로 아래에 둔다 — 물건 층(.bench-tokens)은 조작할 때마다
  // 통째로 다시 그려지므로, 그 안에 두면 말풍선이 같이 사라진다.
  root.innerHTML = `
    <div class="bench-bar">
      <button type="button" id="undo">${UI.undo.label}</button>
      <span id="undo-left"></span>
      <button type="button" id="unmount" hidden></button>
    </div>
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
  const unmountBtn = root.querySelector('#unmount');

  root.querySelector('#undo').addEventListener('click', () => store.dispatch('UNDO', {}));
  unmountBtn.addEventListener('click', () => store.dispatch('REMOVE_FROM_STAGE', {}));

  const DROPS = dropTable(store, (mode, id, tool) => onOpenZoom(mode, id, elFor(`slide${id}`), tool));

  const TAPS = tapTable(store, onOpenZoom);

  const items = defaultItems();
  for (const item of items) { item.homeX = item.x; item.homeY = item.y; }
  let drag = null;

  /* ---------------- 편집 모드 ---------------- */

  /**
   * 놓은 자리에 **그대로** 둔다.
   *
   * 앞서는 두 선(선반 위·작업면 위) 중 가까운 쪽으로 바닥을 붙였다. 그런데 선생님이
   * 플레이해 보시고 말씀하셨다 — 「**준비물들 위치 가능한 포지션을 너가 정해두지마.
   * 내가 미세하게 조정할거야.**」 붙여 버리면 몇 밀리미터를 옮길 수가 없다.
   *
   * 남기는 것은 **실험대 밖으로 나가지 않게 하는 것** 하나뿐이다 —
   * 그림 밖에 놓인 물건은 아무도 집을 수 없어서 자리가 아니라 사고다.
   */
  function placeFreely(item) {
    const h = heightMm(item.asset);
    item.x = clamp(item.x, 0, STAGE_W_MM - CONTRACT[item.asset].realSizeMm);
    item.y = clamp(item.y, 0, STAGE_H_MM - h);
    item.bottom = item.y + h;      // 두 선 중 하나가 아니라 **놓인 자리**다
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
    return `${Math.abs(it.bottom - SHELF_MM) < 1 ? UI.edit.shelf
              : Math.abs(it.bottom - SURFACE_MM) < 1 ? UI.edit.surface
              : Math.round(it.bottom)}`;
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
   * 재물대에 오르는 기구가 실험대에서 어떻게 그려지는가.
   *
   * 바나나랩은 슬라이드 한 장에 시료·시약·덮개 유리가 얹혀 상태가 여섯 가지였다.
   * 여기서는 **금이 갔는가** 하나뿐이다 — 영구표본이라 학생이 만들 것이 없다.
   */
  function itemRenderState(id) {
    const it = store.getState().items[id];
    return { cracked: it.cracked, seed: it.seed };
  }

  function assetState(item) {
    const st = store.getState();
    switch (item.kind) {
      /**
       * 접안 마이크로미터 통.
       *
       * `empty` — 접안렌즈에 끼워져 있으면 통은 비어 있다. **이 실험의 중심 구분이
       * 실험대에도 남아야 한다** — 지금 자는 재물대가 아니라 렌즈 안에 있다.
       * `open` — 뚜껑은 정리했을 때 닫힌다 (`PUT_AWAY_OCULAR` 가 남기는 기록을 본다).
       * 그래야 「넣었습니다」 라는 말과 화면이 같은 것을 말한다.
       */
      case 'ocularBox':
        // 통은 **꺼내 놓은 동안 비어 있고 열려 있다.** 넣으면 채워지고 닫힌다.
        // `session.tidy` 를 보면 안 된다 — 한 번 넣었다 다시 꺼낸 뒤에도 계속
        // 「들어 있다」고 그리게 된다. 지금 어디 있는지는 `stowed` 하나가 말한다.
        return { empty: !st.eyepiece.stowed, open: !st.eyepiece.stowed };
      case 'ocular':
        return { flipped: st.eyepiece.flipped, inCase: false };
      /**
       * 대물 마이크로미터 보관함.
       *
       * `empty` — 재물대에 올라가 있으면 상자가 비어 있다.
       * `open` — 실험 내내 열어 둔다. 대물 마이크로미터에는 「제자리에 넣기」 정리 동작이
       * 없어서(`rules.js` 에 그 액션이 없다) 뚜껑을 닫을 계기가 상태에 없다.
       * 덮은 그림은 계약에 남겨 둔다 — 나중에 그 동작이 생기면 그때 이어 붙인다.
       */
      // 상자가 비었는가는 **상자 안에 있는가**(`stowed`) 하나가 말한다. 앞서는
      // 「재물대에 올라가 있는가」로 봤는데, 그러면 선반에 꺼내 놓은 동안에도 상자가
      // 가득 차 보여 **같은 유리판이 두 곳에** 있는 그림이 됐다.
      case 'stageMicBox':
        return { empty: !st.items.stageMic.stowed, open: true };
      case 'stageMic':
      case 'specimen':
        return itemRenderState(item.item);
      // 쓰레기통은 버린 것이 있으면 안이 찬다. 버린 것이 어디로 갔는지가 눈에 남는다.
      case 'bin':
        return { fill: ITEM_IDS.some((id) => st.items[id].discarded) ? 1 : 0 };
      case 'microscope':
        return {
          objective: st.microscope.objective, coarse: st.microscope.coarse, fine: st.microscope.fine,
          diaphragm: st.microscope.diaphragm, lamp: st.microscope.lamp, stage: st.microscope.stage,
        };
      default:
        return {};
    }
  }

  /**
   * 재물대에 올라간 것은 실험대에서 사라진다 — 그 자리에 있으니까.
   * 케이스와 상자는 사라지지 않는다. 계속 꺼내 쓰는 자리다.
   *
   * 상자에 넣은 것(`stowed`)과 버린 것(`discarded`)도 사라진다. 「통에 넣었습니다」라고
   * 말해 놓고 선반에 그대로 그리면 화면이 거짓말을 한다 (사장님 지시 2026-09-03).
   */
  function isHidden(item) {
    const st = store.getState();
    // 접안 마이크로미터는 재물대에 오르지 않는다 — **렌즈 안**이거나 통 안이면 실험대에서 사라진다.
    // 이 비대칭이 실험의 중심이라 숨기는 조건도 다른 곳을 본다.
    if (item.kind === 'ocular') return st.eyepiece.micrometer || st.eyepiece.stowed;
    if (!item.item) return false;
    const it = st.items[item.item];
    return st.microscope.stage === item.item || Boolean(it.stowed) || Boolean(it.discarded);
  }

  /**
   * 물건이 **쉬는 자리**. 선반의 제자리이거나, 재물대에서 내려놓은 현미경 옆자리다.
   *
   * 끌어 놓은 뒤 물건이 돌아갈 곳이자 다시 그릴 때 앉는 곳이라, 두 곳에서 따로 계산하면
   * 「끌었다 놓으면 딴 데로 간다」가 된다. 여기 한 함수만 본다.
   */
  function restPos(item) {
    const spot = item.item ? UNMOUNT_SPOT[item.item] : null;
    if (spot && store.getState().items[item.item]?.unmounted) {
      return { x: spot.x, y: spot.bottom - heightMm(item.asset) };
    }
    return { x: item.homeX, y: item.homeY };
  }

  /** 끌고 있지 않은 물건을 쉬는 자리에 맞춘다. 편집 모드에서는 사람이 자리를 정한다. */
  function syncPlaces() {
    if (edit) return;
    for (const item of items) {
      if (drag && drag.item.id === item.id) continue;
      const p = restPos(item);
      item.x = p.x;
      item.y = p.y;
    }
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
    return {
      left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2,
      // **그려진 부분**도 함께 돌려준다. 겹쳤을 때 누가 이기는지는 넓힌 자리가 아니라
      // 그림까지의 거리로 가른다 (`distTo`).
      drawn: { left, right: left + dw, top, bottom: top + dh },
    };
  }

  /**
   * 그 점이 **그림에서** 얼마나 떨어져 있는가. 그림 안이면 0.
   *
   * 「그림 **한가운데**까지의 거리」로 하면 **크거나 긴 그림이 불리하다** — 큰 그림의
   * 가장자리는 자기 한가운데보다 옆 물건의 한가운데가 더 가깝기 때문이다.
   * 그림 위를 눌렀는데 남이 집히는 것은 어떤 규칙으로도 옳지 않다.
   * 그래서 한가운데가 아니라 **그림까지의 거리**로 잰다.
   */
  function distTo(rect, x, y) {
    const d = rect.drawn ?? rect;
    const dx = Math.max(d.left - x, 0, x - d.right);
    const dy = Math.max(d.top - y, 0, y - d.bottom);
    return dx * dx + dy * dy;
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

  /**
   * 끄는 것이 지금 **어느 물건 위에** 있는가. 프레임 중심은 그림 밖일 수 있어 그림으로 잰다.
   *
   * 앞서는 **목록에서 먼저 오는 것**을 골랐다. 데스크톱에서는 물건이 충분히 떨어져 있어
   * 티가 안 나는데, 폰에서는 `MIN_HIT_PX` 로 넓힌 자리들이 서로 포개져 엉뚱한 것이 받는다.
   * 이제 **그림까지의 거리가 가장 가까운 것**이 이긴다.
   *
   * **받는 물건을 골라 주지는 않는다.** 「이 물건을 받아 줄 수 있는 것」만 후보로 두면
   * 겨눈 것 대신 옆엣것이 잡혀 엉뚱한 일이 일어난다. 겨눈 것이 답해야 한다 —
   * 못 받는 것을 겨눴으면 못 받는다는 말을 듣는 것이 옳다 (AGENTS.md §2.1).
   */
  function targetUnder() {
    const g = hitRect(drag.el, drag.item.asset);
    const cx = (g.left + g.right) / 2;
    const cy = (g.top + g.bottom) / 2;
    let best = null;
    let bestDist = Infinity;
    for (const other of items) {
      const or_ = drag.rects.get(other.id);
      if (!or_) continue;
      if (cx < or_.left || cx > or_.right || cy < or_.top || cy > or_.bottom) continue;
      const dist = distTo(or_, cx, cy);
      // 거리가 같으면 나중에 그려진 것 — 위에 보이는 것이 받는다.
      if (dist <= bestDist) { bestDist = dist; best = other; }
    }
    return best;
  }

  /**
   * 눌린 자리에서 **실제로 겨눈 물건**. 겹치지 않으면 자기 자신이 나온다.
   *
   * `.token::after` 가 그림을 `MIN_HIT_PX`(44) 까지 넓혀 손가락에 잡히게 한다.
   * 데스크톱에서는 물건이 충분히 떨어져 있어 넓혀도 안 겹치는데, **폰에서는 물건 자체가
   * 작아 넓힌 자리가 서로 포개진다.** 그때는 DOM 에서 **나중에 그려진 것**이 이벤트를
   * 가져가므로, 한가운데를 눌러도 겹쳐 있는 이웃이 집혔다 — 재어 보니 320 px 에서
   * 그림 안 175 점 중 **28 점**이 이웃에게 갔다. 데스크톱(768 px)에서는 0 점이라
   * 큰 화면에서만 재면 영영 안 보인다. 교실에서 쓰는 것은 태블릿이다.
   */
  function aimedAt(e, item) {
    let best = item;
    let bestDist = Infinity;
    for (const other of items) {
      if (isHidden(other)) continue;
      const oe = elFor(other.id);
      if (!oe) continue;
      const r = hitRect(oe, other.asset);
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) continue;
      const d = distTo(r, e.clientX, e.clientY);
      // **거리가 같으면 나중에 그려진 것이 이긴다.** 그림끼리 진짜로 겹치는 자리에서는
      // 둘 다 거리 0 이 되는데, 그때 앞선 것을 고르면 **눈에 보이는 것 뒤에 있는 것**이
      // 집힌다. 학생은 보이는 것을 겨눈다. `items` 는 그린 차례라 뒤가 위다.
      if (d <= bestDist) { bestDist = d; best = other; }
    }
    return best;
  }

  /* ---------------------------------------------------------------- */
  /* 안내 말풍선 — 이름과 지금 할 수 있는 조작                          */
  /* ---------------------------------------------------------------- */

  /**
   * 키보드로 끌어다 놓기.
   *
   * 끌어다 놓는 조작에는 키보드 경로가 없었다 — 문지르기·채우기·집기·올리기가 전부
   * 마우스 전용이라, 마우스를 쓰지 못하면 실험을 시작조차 할 수 없었다.
   *
   * 포커스로 말풍선이 떴을 때만 **놓을 곳 버튼**을 함께 낸다. Tab 으로 들어가 Enter 로 놓는다.
   * 마우스로는 손짓이 정하던 값(문지른 정도·덮는 각도)을 키보드로는 정할 수 없으므로
   * 가운뎃값을 쓴다 — 정할 수 있는 것과 아예 못 하는 것 사이의 격차는 남지만,
   * 못 하는 쪽보다는 낫다. 말풍선에 그 값을 적어 둔다.
   */
  const KEYBOARD_SMEAR_MM = 0;
  const KEYBOARD_ANGLE_DEG = 45;

  function dropTargetsFor(item) {
    const accepts = DROPS[item.kind] ?? {};
    return items.filter((o) => o.id !== item.id && !isHidden(o) && accepts[o.kind]);
  }

  function runDrop(item, target) {
    const run = DROPS[item.kind]?.[target.kind];
    if (!run) return;
    // 손짓이 정하던 값의 자리에 가운뎃값을 넣는다.
    const rad = (KEYBOARD_ANGLE_DEG * Math.PI) / 180;
    run(item, target, {
      smearMm: KEYBOARD_SMEAR_MM,
      lastDx: Math.cos(rad) * 10,
      lastDy: Math.sin(rad) * 10,
    });
    renderTokens();
    // 놓고 나면 그 물건으로 포커스를 돌려준다. 그러지 않으면 포커스가 <body> 로 빠져
    // 키보드로 쓰는 사람은 매번 처음부터 Tab 해서 돌아와야 한다.
    // focus() 가 focus 이벤트를 쏘고, 그 핸들러가 말풍선을 다시 낸다 — 여기서 또 부르지 않는다.
    // 놓은 물건이 화면에서 사라졌으면(재물대에 올라간 받침 유리) **놓은 자리**로 옮긴다.
    // 그냥 두면 포커스가 <body> 로 빠져, 키보드로 쓰는 사람은 처음부터 Tab 해 돌아와야 한다.
    (elFor(item.id) ?? elFor(target.id))?.focus();
  }

  /**
   * 지금 떠 있는 말풍선이 **키보드로 연 것인가.**
   *
   * 키보드로 연 말풍선에는 「여기에 놓기」 버튼이 함께 나오고, 마우스를 못 쓰는 사람에게는
   * **그 버튼이 물건을 옮기는 길의 전부다.** 마우스가 그것을 덮어 버리면 길이 사라진다.
   */
  let tipFromKeyboard = false;

  /**
   * Esc 로 치운 물건. **id 를 기억해 둬야 한다.**
   *
   * `hideTip()` 만으로는 안 된다 — 포커스가 그 물건에 남아 있어서 다시 그릴 때 `focus` 가
   * 새로 나 도로 뜨고, 마우스를 물건에 얹어 둔 채면 `pointerenter` 도 되살린다.
   * 그러면 Esc 가 아무 일도 안 한 것처럼 보인다.
   */
  let dismissedId = null;

  function showTip(item, withActions = false) {
    if (drag) return;
    // **Esc 로 치운 것은 여기 한 곳에서 막는다.**
    // 부르는 자리마다(pointerenter·focus·다시 그리기 뒤 포커스 복원) 따로 막으면
    // 반드시 한 곳이 샌다.
    if (dismissedId === item.id) return;
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

  function hideTip() {
    clearTimeout(hideTimer);
    hideTimer = 0;
    tipFromKeyboard = false;
    tipEl.hidden = true;
  }

  /** 키보드로 연 말풍선이 아직 살아 있는가 — 마우스가 덮으면 안 되는 상태. */
  function keyboardTipAlive() {
    return tipFromKeyboard && layer.contains(document.activeElement);
  }

  /** 말풍선의 놓기 버튼들. 없으면 빈 배열. */
  const tipButtons = () => [...tipEl.querySelectorAll('[data-onto]')];

  /**
   * **버튼까지 가는 다리.**
   *
   * `#bench-tip` 은 DOM 에서 `.bench-tokens` 뒤에 있다. 그래서 물건에서 Tab 하면 옆 물건으로
   * 가고, 그 물건의 focus 가 말풍선을 제 것으로 갈아 끼워 **방금 열려 있던 버튼을 지운다.**
   * 물건을 다 지나 말풍선 자리에 닿을 즈음엔 마지막 물건의 말풍선만 남아 있다.
   *
   * 즉 **버튼은 화면에 떠 있는데 키보드로는 아예 닿을 수 없었다.** Tab 을 마흔 번 눌러 확인했다.
   * 검사가 이걸 못 잡은 이유는 `btn.focus()` 를 **불렀기** 때문이다 — 그러면
   * 「누르면 동작하는가」만 알 수 있고 **「거기까지 갈 수 있는가」는 알 수 없다.**
   */
  function focusFirstPut() {
    const [first] = tipButtons();
    if (!first) return false;
    first.focus();
    return true;
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
   * 말풍선 안에서의 Tab. **양쪽 끝에서 실험대로 되돌려 준다.**
   *
   * 그냥 두면 마지막 버튼에서 Tab 했을 때 탐구 노트로 튕긴다 — 실험대를 다 돌기도 전에.
   * 첫 버튼에서 Shift+Tab 은 원래 물건으로, 마지막 버튼에서 Tab 은 **그 물건의 다음 물건**으로.
   */
  tipEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const src = tipEl.querySelector('[data-put]')?.dataset.put;
      e.preventDefault();
      dismissedId = src ?? null;
      hideTip();
      if (src) elFor(src)?.focus();
      return;
    }
    if (e.key !== 'Tab') return;
    const btns = tipButtons();
    const at = btns.indexOf(document.activeElement);
    if (at < 0) return;
    const srcId = document.activeElement.dataset.put;
    const tokens = [...layer.querySelectorAll('[data-id]')];
    const srcAt = tokens.findIndex((t) => t.dataset.id === srcId);

    if (e.shiftKey && at === 0) {
      e.preventDefault();
      tokens[srcAt]?.focus();
      return;
    }
    if (!e.shiftKey && at === btns.length - 1) {
      e.preventDefault();
      // 다음 물건으로. 마지막 물건이었으면 실험대 밖으로 보낸다 —
      // 여기서 첫 물건으로 감으면 키보드가 실험대에 갇힌다.
      const next = tokens[srcAt + 1];
      if (next) { dismissedId = null; next.focus(); }
      else { hideTip(); tipEl.blur(); }
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

  /** 문지르는 동안 얼마나 발렸는지 보여 준다. 안 보이면 문지르는 중인 줄을 모른다. */
  function updateSmearMeter() {
    let meter = drag.el.querySelector('.smear-meter');
    if (drag.smearMm <= 0) {
      meter?.remove();
      return;
    }
    if (!meter) {
      meter = document.createElement('div');
      meter.className = 'smear-meter';
      meter.innerHTML = '<i></i>';
      drag.el.appendChild(meter);
    }
    const t = clamp(drag.smearMm / SMEAR_FULL_MM, 0, 1);
    meter.querySelector('i').style.width = `${(t * 100).toFixed(0)}%`;
  }

  function onPointerDown(e, item, el) {
    if (e.button !== undefined && e.button !== 0) return;
    // 넓힌 자리가 겹쳤으면 **겨눈 것**으로 바꾼다. 안 겹치면 자기 자신이라 아무것도 안 바뀐다.
    const aimed = aimedAt(e, item);
    if (aimed.id !== item.id) {
      const ael = elFor(aimed.id);
      if (ael) { item = aimed; el = ael; }
    }
    // 손가락 탭인지 여기서 정확히 안다. focus 말풍선을 참을지 가르는 데 쓴다.
    if (e.pointerType !== 'mouse') fingerTapAt = performance.now();
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
      smearMm: 0,
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
    // 문지르기는 받침 유리 **위에서 움직인 거리**만 센다. 허공에서 흔든 것은 세지 않는다.
    if (drag.item.kind === 'banana' && target?.kind === 'slide') {
      drag.smearMm += Math.hypot(drag.lastDx, drag.lastDy) * k;
      drag.smearTarget = target;
      updateSmearMeter();
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
   * 마지막 **손가락** 탭 시각. `pointerTapAt` 과 따로 둔다 —
   * 그쪽은 「뒤따라올 click 을 삼킬까」이고, 이쪽은 「focus 말풍선을 참을까」다.
   * 손가락으로 눌러도 <button> 은 포커스를 받는데, 그때 놓기 버튼까지 띄우면
   * 누를 때마다 떠서 안 사라지는 창이 된다.
   */
  let fingerTapAt = 0;

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
    el.querySelector('.smear-meter')?.remove();
    clearMarks();

    if (!moved) {
      // 움직이지 않았다면 조작이 아니라 탭이다.
      drag = null;
      pointerTapAt = performance.now();
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

    let target = targetUnder();
    // 문지르다 보면 손을 뗄 때 받침 유리 밖에 있기 쉽다 — 왕복 운동이라 매번 가장자리를 넘어간다.
    // 받침 유리(76 mm)는 화면에서 40 px 남짓이라 자연스러운 왕복이 대부분 유리 밖에서 끝난다.
    // 여기서 놓쳐 버리면 계량기가 다 찼는데도 아무 일이 안 일어난다. 문지른 것은 문지른 것이다.
    if (!target && drag.smearMm > 0 && drag.smearTarget) target = drag.smearTarget;
    const run = target ? DROPS[item.kind]?.[target.kind] : null;
    if (run) run(item, target, { smearMm: drag.smearMm, lastDx: drag.lastDx, lastDy: drag.lastDy });

    // 쓴 물건은 언제나 **쉬는 자리**로 돌아간다.
    //
    // 놓인 자리는 결과에 아무 영향을 주지 않는데, 물건이 놓인 채로 남으면 자리가 뜻을 갖는 것처럼
    // 보인다 — 현미경 위에 얹힌 유리판은 재물대에 올라간 것처럼 보인다(실제로는 아니다).
    // 재물대에 올라가 화면에서 사라진 것도 마찬가지로 되돌려 둔다.
    // 그러지 않으면 내렸을 때 현미경 위에 겹쳐 나타나 다시 집을 수가 없다.
    drag = null;
    const back = restPos(item);
    item.x = back.x;
    item.y = back.y;
    renderTokens();
  }

  function renderTokens() {
    // 키보드 활성화(Enter/Space)로 조작하면 상태가 바뀌어 여기로 다시 들어오는데,
    // 매번 새 <button> 을 만들면 포커스가 <body> 로 빠져 Tab 흐름이 끊긴다.
    // 같은 id 를 가진 새 요소로 포커스를 옮겨 준다.
    const focusedId = layer.contains(document.activeElement) ? document.activeElement.dataset.id : null;
    // 재물대에서 내려놓은 물건은 선반이 아니라 현미경 옆에 선다. 그리기 직전에 맞춘다.
    syncPlaces();
    layer.innerHTML = '';
    for (const item of items) {
      if (isHidden(item)) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `token token--${item.kind}`;
      el.dataset.id = item.id;
      if (item.kind === 'slide') el.dataset.slide = item.slide;
      else el.dataset.tool = item.asset;
      if (item.kind === 'slide') el.dataset.zoom = 'slide';
      else if (item.kind === 'microscope') el.dataset.zoom = 'scope';
      // 크기와 위치를 전부 무대 비율로 낸다. 배경 애셋과 같은 자로 재어지므로
      // 창 크기가 바뀌어도 realSizeMm 비례와 배경 위 자리가 함께 유지된다.
      el.style.left = `${xPct(item.x)}%`;
      el.style.top = `${yPct(item.y)}%`;
      el.style.width = `${widthPct(item.asset)}%`;
      // 그림이 손가락보다 작으면 여백까지 잡을 수 있게 표시해 둔다 (`.token[data-small]`).
      // 화면 폭을 모르는 자리라 mm 로 잰다 — 44 px 는 실험대 1500 mm 를 화면 폭으로 나눈 값이다.
      if (drawnBoxMm(item.asset).w < MIN_HIT_PX * pxToMm()) el.dataset.small = 'true';
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
      // **말풍선은 집힐 물건의 이름을 말해야 한다.**
      // 넓힌 자리가 겹치면 `aimedAt` 이 겨눈 것으로 바꿔 집는데, 말풍선이 그걸 안 따라가면
      // 「접안 마이크로미터 통」 이라 적힌 것을 눌렀는데 **원판이 끌린다.**
      // 이름과 손이 다른 것을 가리키면 화면이 거짓말을 하는 것이고, 집는 것만 고쳤을 때보다
      // 더 헷갈린다 — 엉뚱한 일이 **이름표를 달고** 일어나기 때문이다.
      const hoverTip = (e) => {
        if (e.pointerType !== 'mouse') return;
        if (keyboardTipAlive()) return;
        // Esc 로 치운 물건은 showTip 이 알아서 막는다.
        showTip(aimedAt(e, item));
      };
      el.addEventListener('pointerenter', hoverTip);
      // 겹친 자리 안에서 조금 움직이면 겨눈 것이 바뀐다. 들어올 때 한 번만 재면
      // 그 사이 이름이 굳어 버린다. 끄는 중에는 말풍선을 안 쓰므로 그때는 넘긴다.
      el.addEventListener('pointermove', (e) => { if (!drag) hoverTip(e); });
      el.addEventListener('pointerleave', () => {
        // 마우스가 벗어나면 「치웠다」 는 기억을 푼다. 다시 올리면 떠야 한다.
        if (dismissedId === item.id) dismissedId = null;
        if (keyboardTipAlive()) return;
        hideTip();
      });
      // 포커스로 뜬 말풍선에는 **놓을 곳 버튼**이 함께 나온다 — 키보드로 놓는 길이다.
      //
      // 앞서는 `:focus-visible` 로 걸렀다. 뜻은 맞지만 그것은 **브라우저가 「지금 키보드를
      // 쓰는 중인가」를 어림잡는 값**이다. 막으려던 것은 「손가락 탭 직후」 하나뿐이고
      // 그건 `fingerTapAt` 이 **정확히** 알고 있으니, 어림값 대신 아는 값을 쓴다.
      el.addEventListener('focus', () => {
        // 다른 물건으로 옮겨 갔으면 「치웠다」 는 기억을 푼다.
        if (dismissedId && dismissedId !== item.id) dismissedId = null;
        // **손가락 탭 직후에만** 참는다. 키보드 Enter 는 참지 않는다 —
        // 참으면 키보드로 한 번 조작한 뒤 놓을 곳 버튼이 다시 안 나온다.
        if (performance.now() - fingerTapAt < POINTER_TAP_GRACE_MS) return;
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
        // Tab 으로 **놓기 버튼에 들어간다.** 브라우저의 기본 Tab 은 옆 물건으로 가는데,
        // 그러면 그 물건의 focus 가 말풍선을 갈아 끼워 여기 버튼이 사라진다.
        if (e.key === 'Tab' && !e.shiftKey && tipFromKeyboard && focusFirstPut()) {
          e.preventDefault();
          return;
        }
        // Esc 로 말풍선을 치운다 (WCAG 1.4.13). 놓을 곳이 여럿이면 Tab 을 그 수만큼
        // 눌러 빠져나가야 하는데, 그건 길이 아니다.
        if (e.key === 'Escape') {
          if (tipEl.hidden) return;
          e.preventDefault();
          dismissedId = item.id;
          hideTip();
          return;
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

  function renderBar() {
    const st = store.getState();
    const undosLeft = st.session.undosLeft;
    root.querySelector('#undo-left').textContent =
      undosLeft === Infinity ? UI.undo.unlimited : UI.undo.left(undosLeft);
    unmountBtn.hidden = !st.microscope.stage;
    if (st.microscope.stage) {
      unmountBtn.textContent = UI.bench.unmount(UI.stageShort[st.microscope.stage]);
    }
  }

  // 드래그 도중에는 다시 그리지 않는다. TICK 처럼 사용자와 무관하게 들어오는 상태 변경이
  // DOM 을 새로 만들면 setPointerCapture 가 무효화돼 드래그가 조용히 끊긴다.
  // 드래그가 끝나면 onPointerUp 이 최신 상태로 어차피 다시 그린다.
  store.subscribe(() => { renderBar(); renderLock(); if (!drag) renderTokens(); });
  renderTokens();

  /**
   * ★ **폭이 바뀌면 이름표를 다시 눕힌다.**
   *
   * `layoutNames()` 는 `renderTokens()` 안에서만 돌았고, 그것은 **상태가 바뀔 때만** 돈다.
   * 그런데 이름표가 부딪히는지는 **화면 폭**이 정한다 — 상태는 그대로인데 폭만 바뀌면
   * 다시 눕지 않는다. 재어 보니:
   *
   *     1400px 에서 열면          겹침 0쌍
   *     그 상태로 390px 로 줄이면  겹침 **6쌍**   ← 글자가 뭉개져 못 읽는다
   *     390px 로 **새로** 열면     겹침 0쌍
   *
   * 그래서 **처음부터 좁게 열면 안 잡힌다.** 넓게 열어서 줄여야 드러난다.
   * 학생이 폰을 돌리거나 창을 줄이면 그 자리에서 이름이 뭉갠다.
   *
   * `window` 의 `resize` 가 아니라 `ResizeObserver` 를 쓴다 — 창 크기가 그대로여도
   * **옆 칸(탐구 노트)이 늘고 줄 때** 실험대 폭이 바뀌기 때문이다. 그때도 다시 누워야 한다.
   * (chromatography 세션이 찾아 허브를 거쳐 넘겨 주었다)
   */
  if (typeof ResizeObserver === 'function') {
    let lastW = 0;
    new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      // 폭이 그대로면 아무것도 안 한다 — `layoutNames()` 가 다시 재는 것을 관찰기가
      // 또 잡아 되돌이가 되는 것을 막는다.
      if (w === lastW) return;
      lastW = w;
      layoutNames();
    }).observe(layer);
  }
  renderBar();
  renderLock();
  renderEditPanel();
}
