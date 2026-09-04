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
import { isRunning, mixPct } from '../sim/state.js';
import {
  OBSERVE_LIMIT_MIN, GLUCOSE_POUR_ML, YEAST_POUR_ML, KOH_POUR_ML,
} from '../sim/fermentation.js';
import { renderTube, tubeAssetState, gasNow, tubeContents } from '../render/tube.js';
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
const SHELF_MM = (LANDMARKS.shelfTopY / 300) * STAGE_H_MM;       // 위 선반 상판 윗면
const SHELF2_MM = (LANDMARKS.shelf2TopY / 300) * STAGE_H_MM;     // 아래 선반 상판 윗면
const SURFACE_MM = (LANDMARKS.surfaceFrontY / 300) * STAGE_H_MM; // 작업면 앞 모서리

/**
 * 어느 선에 서 있는가. **가장 가까운 선**으로 답한다.
 *
 * 편집 모드에서 물건을 놓은 자리에 그대로 두므로(`placeFreely`) 「붙인 선」이 없다.
 * 그래도 편집 표에는 어디쯤인지 적어야 하니, 셋 중 가까운 쪽 이름을 낸다.
 */
function whichLine(bottom) {
  const lines = [[SHELF_MM, 'shelf'], [SHELF2_MM, 'shelf2'], [SURFACE_MM, 'surface']];
  return lines.reduce((a, c) => (Math.abs(bottom - c[0]) < Math.abs(bottom - a[0]) ? c : a))[1];
}

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
 * 관찰 시간이 20 분이라 실제 시간으로 두면 화면 앞에서 20 분을 보게 된다.
 *
 * 40 으로 둔 것은 **한 시행이 30 초 안에 끝나야** 조건을 서너 가지 바꿔 볼 수 있기
 * 때문이다. 그렇다고 더 올리면 기체가 차오르는 것이 눈에 안 보이고 — 그것이 이 실험의
 * 결과 그림이다 — 「20분」이라는 절차의 감각도 사라진다.
 *
 * **배속을 화면에 적는다** (`UI.bench.clock.speed`). 안 적으면 학생이 분을 잘못 읽는다.
 */
export const CLOCK_SPEED = 40;

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
 * 이 실험은 실험대에 물건이 열여섯 개 놓인다 — 조건마다 하나씩 있어야 하기 때문이다
 * (시약병 다섯 · 항온기 다섯 · 잔 도구 여섯). 열여섯 개의 x 를 손으로 적으면 하나를 옮길
 * 때마다 그 오른쪽이 전부 밀리고, 겹치거나 실험대 밖으로 나간 것을 눈으로 찾게 된다.
 * 이웃 실험에서 첫 배치가 그렇게 깨졌다 — 비커가 수조를 덮었고 쓰레기통이 실험대 밖에 있었다.
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
/*
 * 「코드 복사」가 뱉는 세 이름. **붙여 넣는 자리에 이것들이 있어야 코드가 돈다** —
 * 없으면 복사한 코드가 그대로는 안 붙고, 옮긴 사람이 손으로 고치다 틀린다.
 * 선이 셋이 되면서 `shelf2` 가 늘었다.
 */
const shelf = (x, rest) => ({ x, bottom: SHELF_MM, ...rest });
const shelf2 = (x, rest) => ({ x, bottom: SHELF2_MM, ...rest });
const surface = (x, rest) => ({ x, bottom: SURFACE_MM, ...rest });

/**
 * 선에 매이지 않은 자리. **둘째 인자는 「윗변」(y)이다.**
 *
 * 편집 모드는 놓은 자리에 그대로 둔다(`placeFreely`). 그런데 「코드 복사」가 `shelf2(x)`
 * 처럼 **선 이름으로** 뱉으면, 붙여 넣는 순간 그 선으로 도로 끌려간다 — 선 사이에 두려고
 * 옮긴 수고가 통째로 사라진다. 실제로 휴지를 373 mm 로 내렸는데 코드는 `shelf2(1144)` 였다.
 */
const at = (x, y, rest) => ({ x, y, bottom: y + heightMm(rest.asset), ...rest });

function row(entries, { from, to, bottom }) {
  const drawn = entries.map((e) => drawnBoxMm(e.asset));
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
 * 5 % 포도당 수용액은 **다 만들어 놓지 않았다.** 만든 병을 빈 채로 두고 학생이 희석해서
 * 채운다 — 「같은 부피를 더하면 농도가 절반」이 이 실험에서 배울 것 중 하나라,
 * 채워 놓으면 그 절차가 사라진다.
 *
 * 줄 안의 **순서**에는 뜻이 있다. 항온기가 오름차순이라 계열을 훑는 순서와
 * 화면을 훑는 순서가 같다.
 */
function defaultItems() {
  const I = UI.bench.items;
  const bottle = (id, kind, extra = {}) => ({ id, asset: 'bottle', kind, labelKey: id, ...extra });
  const items = [
    /*
     * **선반 둘로 나눈다.** 여덟을 한 줄에 세우면 좁은 화면에서 잡는 자리(최소 44 px)가
     * 서로 겹친다 — 320 px 에서 열네 짝이었다. 위에는 **시약병**, 아래에는 **도구**를 둔다.
     * 물건 성격으로 갈라야 학생이 「어디를 봐야 하는지」를 한 번에 안다.
     */
    ...row([
      bottle('glucose10', 'bottleGlucose', { pct: 10 }),
      bottle('water', 'bottleWater'),
      // 만든 병은 **비어 있는 채로 시작한다.** 5 % 를 다 만들어 놓고 두면
      // 「같은 부피를 더하면 절반」이라는 배울 것이 사라진다 (state.js 의 initialMix).
      bottle('mix', 'bottleMix'),
      bottle('yeast', 'bottleYeast'),
      bottle('koh', 'bottleKoh'),
    ], { from: 20, to: STAGE_W_MM - 20, bottom: SHELF_MM }),

    ...row([
      { id: 'cotton', asset: 'cotton', kind: 'cotton', labelKey: 'cotton' },
      { id: 'dropper', asset: 'dropper', kind: 'dropper', labelKey: 'dropper' },
      { id: 'tissue', asset: 'tissue', kind: 'tissue', labelKey: 'tissue' },
    ], { from: 20, to: STAGE_W_MM - 20, bottom: SHELF2_MM }),

    ...row([
      // 항온기 다섯이 오름차순이라, 계열을 훑는 순서와 화면을 훑는 순서가 같다.
      { id: 'inc10', asset: 'incubator', kind: 'incubator', tempC: 10, labelKey: 'inc10' },
      { id: 'inc20', asset: 'incubator', kind: 'incubator', tempC: 20, labelKey: 'inc20' },
      { id: 'inc30', asset: 'incubator', kind: 'incubator', tempC: 30, labelKey: 'inc30' },
      { id: 'inc40', asset: 'incubator', kind: 'incubator', tempC: 40, labelKey: 'inc40' },
      { id: 'inc55', asset: 'incubator', kind: 'incubator', tempC: 55, labelKey: 'inc55' },
      { id: 'tube', asset: 'fermtube', kind: 'fermtube', labelKey: 'tube' },
      // 개수대는 두지 않는다. **효모액과 수산화 칼륨 폐액은 개수대에 버리지 않는다** —
      // 비운 것은 전부 폐액통으로 간다. 손은 휴지 쪽에서 씻는다.
      { id: 'waste', asset: 'waste', kind: 'waste', labelKey: 'waste' },
      { id: 'bin', asset: 'bin', kind: 'bin', labelKey: 'bin' },
    ], { from: 10, to: STAGE_W_MM - 10, bottom: SURFACE_MM }),
    // 이름은 키로만 적어 둔다. 편집 모드가 배치를 다시 코드로 뱉을 때
    // `label: I.tube` 를 되살리려면 어느 키였는지를 알아야 한다.
  ];
  return items.map((it) => ({ ...it, label: I[it.labelKey], y: it.bottom - heightMm(it.asset) }));
}

/**
 * 끌어다 놓았을 때 무슨 일이 일어나는가. **종류 쌍**으로만 적는다.
 *
 * 상태(만든 병에 지금 무엇이 들었는가 같은 것)는 여기서 보지 않는다.
 * 빈 병을 발효관에 대면 `rules.js` 가 「만든 병이 비어 있습니다. 선반의 10 % 포도당
 * 수용액과 증류수를 이 병에 끌어다 넣어 만드세요」라고 답해 주는데,
 * **그 답을 듣는 것이 이 실험에서 배우는 내용이다.**
 * 여기서 미리 걸러 내면 들을 기회가 사라진다.
 * 그래서 드래그 중 하이라이트는 「된다」가 아니라 **「여기에 무언가 일어난다」**는 표시다.
 *
 * 이 표 하나가 세 곳에 함께 쓰인다 — 실제 실행, 드래그 중 대상 하이라이트, 안내 문구 유무.
 * 셋을 따로 적으면 조작을 하나 늘릴 때마다 세 곳이 어긋난다.
 */
export function dropTable(store) {
  return {
    /**
     * 병에 적힌 농도가 그대로 들어간다. 병을 잘못 고르는 것을 막지 않는다 — 통제변인이다.
     *
     * 「만든 병」에 대면 **희석용으로 10 mL 만** 옮긴다. 발효관에 직접 대면 표준량(20 mL)을 붓는다.
     * 같은 병이 어디에 닿느냐로 하는 일이 달라지는 것은, 실제로도 그렇기 때문이다.
     */
    bottleGlucose: {
      fermtube: (item) => store.dispatch('POUR_GLUCOSE', { pct: item.pct, ml: GLUCOSE_POUR_ML }),
      bottleMix: () => store.dispatch('ADD_TO_MIX', { kind: 'glucose' }),
    },
    /**
     * 증류수는 두 가지 일을 한다 — **묽히는 것**과 **대조군에서 효모액 자리를 채우는 것**.
     * 발효관에 대면 뒤엣것이다. 총 부피를 같게 맞추려고 넣는 것이라 효모액과 같은 양을 넣는다.
     */
    bottleWater: {
      fermtube: () => store.dispatch('POUR_WATER', { ml: YEAST_POUR_ML }),
      bottleMix: () => store.dispatch('ADD_TO_MIX', { kind: 'water' }),
    },
    bottleMix: {
      fermtube: () => store.dispatch('POUR_MIX', { ml: GLUCOSE_POUR_ML }),
    },
    bottleYeast: {
      fermtube: () => store.dispatch('POUR_YEAST', { ml: YEAST_POUR_ML }),
    },
    bottleKoh: {
      fermtube: () => store.dispatch('ADD_KOH', { ml: KOH_POUR_ML }),
    },
    cotton: {
      fermtube: () => store.dispatch('PLUG_TUBE', {}),
    },
    dropper: {
      fermtube: () => store.dispatch('DRAIN_TUBE', {}),
    },
    fermtube: {
      incubator: (item, target) => store.dispatch('PUT_IN_INCUBATOR', { tempC: target.tempC }),
      // 비운 것은 폐액통으로 간다. 개수대에 버리지 않는다 (defaultItems 주석 참조).
      waste: () => store.dispatch('EMPTY_TUBE', {}),
    },
  };
}

/**
 * 물건을 클릭(또는 Enter/Space)했을 때 — **그 물건의 화면이 열린다.** 상태는 바뀌지 않는다.
 *
 * **누르면 본다, 끌면 옮긴다, 단추로 한다** (docs/09-uniformity.md §2).
 * 앞서는 발효관을 누르면 솜마개가 빠지고(UNPLUG_TUBE), 만든 병을 누르면 비워졌다(EMPTY_MIX).
 * 둘은 이제 물건 화면(`zoom.js`)의 단추다 — 막힘 문구가 「솜마개를 빼세요」라고 하면
 * 발효관 화면에 그 단추가 있다. 나머지는 눌러도 아무 일이 없었다 — 그 침묵은 고장과
 * 구별되지 않는다. 모든 물건이 자기 화면을 연다. 「무엇을 받는 곳인지」를 그 화면이 말한다.
 * 실험대에서 상태를 바꾸는 손짓은 끌어다 놓기(`dropTable`)뿐이다.
 */
export function tapTable(store, onOpenZoom = () => {}) {
  const view = (item, el) => onOpenZoom('item', item.id, el);
  return {
    bottleGlucose: view, bottleWater: view, bottleMix: view, bottleYeast: view, bottleKoh: view,
    cotton: view, dropper: view, tissue: view, incubator: view, fermtube: view, waste: view, bin: view,
  };
}

/** 실험대 물건 하나. 확대 뷰가 종류·농도·온도를 읽는 데 쓴다. */
export function itemById(id) {
  return defaultItems().find((it) => it.id === id) ?? null;
}

/**
 * 물건 하나를 그릴 때 애셋에 넘길 상태.
 *
 * **이 함수가 상태를 그림으로 옮기는 유일한 자리다.** 여기 없는 것은 화면에 안 나타나고,
 * 화면에 안 나타나는 상태는 학생에게 없는 것과 같다. 실험대와 확대 뷰가 같은 함수를 쓴다 —
 * 두 곳에서 따로 만들면 상태를 하나 늘릴 때 한쪽이 조용히 옛 그림을 그린다.
 */
export function assetState(store, item) {
  const st = store.getState();
  const t = st.bench.tube;
  switch (item.kind) {
    case 'bottleGlucose':
      return { kind: 'GLUCOSE', pct: item.pct, level: 0.7 };
    case 'bottleWater':
      return { kind: 'WATER', level: 0.8 };
    case 'bottleMix': {
      // **만든 병은 지금 든 것을 말해야 한다.** 라벨이 「빔」인지 「5 %」인지가
      // 골라 쓸 수 있느냐를 가른다. 비어 있으면 pct 를 주지 않는다 —
      // 0 을 주면 「포도당 0 % 가 든 병」으로 읽힌다.
      const pct = mixPct(st.bench.mix);
      const total = st.bench.mix.glucoseMl + st.bench.mix.waterMl;
      return pct === null
        ? { kind: 'MIX', level: 0 }
        : { kind: 'MIX', pct, level: Math.min(total / 30, 1) };
    }
    case 'bottleYeast':
      return { kind: 'YEAST', level: 0.7 };
    case 'bottleKoh':
      return { kind: 'KOH', level: 0.6 };
    case 'fermtube':
      // 실험대의 발효관과 관찰 창의 발효관이 **같은 함수**를 쓴다.
      // 두 곳에서 따로 만들면 상태를 하나 늘릴 때 한쪽이 조용히 옛 그림을 그린다.
      return tubeAssetState(t);
    case 'incubator':
      return { tempC: item.tempC };
    case 'dropper':
      return { holds: t.drained ? 'BREW' : null, level: t.drained ? 0.6 : 0 };
    case 'waste':
      return { level: 0.2 };
    default:
      return {};
  }
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
    return { id: it.id, kind: it.kind, x: it.x + d.dx, y: it.y + d.dy, w: d.w, h: d.h };
  });
}

/** 실험대에 놓인 물건들. 배치를 몰라도 종류만 알면 되는 검사에 쓴다. */
export const BENCH_KINDS = [
  'bottleGlucose', 'bottleWater', 'bottleMix', 'bottleYeast', 'bottleKoh',
  'cotton', 'dropper', 'tissue', 'incubator', 'fermtube', 'waste', 'bin',
];

/**
 * 배치를 다시 코드로 뱉는다 — 편집 모드에서 옮긴 자리를 그대로 `defaultItems()` 에 붙여 넣는다.
 *
 * 눈으로 옮긴 것을 손으로 숫자로 옮겨 적는 일은 반드시 어딘가 틀린다.
 * 옮긴 사람이 스크린샷만 보내면 되도록, 화면이 스스로 좌표를 말하게 한다.
 */
function layoutCode(items) {
  const lines = items.map((it) => {
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
    // **자리를 그대로 낸다.** 선 이름으로 뱉으면 붙여 넣을 때 그 선으로 끌려간다.
    return `    at(${Math.round(it.x)}, ${Math.round(it.y)}, { ${props} }),`;
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
export function createBench(root, store, { edit = false, onOpenZoom = () => {} } = {}) {
  root.classList.add('bench');
  // 배경과 물건을 같은 무대 안에 둔다. 무대가 4:3 을 지키므로 둘이 함께 스케일된다.
  // 안내 말풍선은 무대 바로 아래에 둔다 — 물건 층(.bench-tokens)은 조작할 때마다
  // 통째로 다시 그려지므로, 그 안에 두면 말풍선이 같이 사라진다.
  root.innerHTML = `
    <div class="bench-bar">
      <button type="button" id="undo">${UI.undo.label}</button>
      <span id="undo-left"></span>
      <button type="button" id="take-out" hidden></button>
      <button type="button" id="record">${UI.zoom.capture}</button>
      <span id="clock"></span>
      <span id="trials"></span>
      <span id="tube-contents"></span>
    </div>
    <!-- 관찰 창. 실험대의 작은 발효관 토큰에서는 맹관부에 기체가 고이는 것이 보이지 않는다 —
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
  takeOutBtn.addEventListener('click', () => store.dispatch('TAKE_FROM_INCUBATOR', {}));
  root.querySelector('#record').addEventListener('click', () => store.dispatch('RECORD_TRIAL', {}));

  const DROPS = dropTable(store);
  const TAPS = tapTable(store, onOpenZoom);

  const items = defaultItems();
  for (const item of items) { item.homeX = item.x; item.homeY = item.y; }
  let drag = null;

  /* ---------------- 편집 모드 ---------------- */

  /**
   * 편집 모드에서 놓은 자리에 **그대로** 둔다.
   *
   * 예전에는 두 선(선반·작업면) 중 가까운 쪽으로 **빨아들였다.** 그런데 배치를 잡는 사람은
   * 「선반보다 조금 아래」처럼 **선 사이**에 두어 보고 싶어 한다 — 빨려 들어가면 그걸 할 수가
   * 없고, 끌어 놓을 때마다 손이 정한 자리가 무시된다. 선생님이 배치를 잡으시는 화면이므로
   * **손이 정한 자리가 이긴다.**
   *
   * 실험대 밖으로 나가는 것만 막는다. 그건 자리가 아니라 화면 밖이다.
   */
  function placeFreely(item) {
    const h = heightMm(item.asset);
    item.x = clamp(item.x, 0, STAGE_W_MM - CONTRACT[item.asset].realSizeMm);
    item.y = clamp(item.y, 0, STAGE_H_MM - h);
    item.bottom = item.y + h;
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
    return `${UI.edit[whichLine(it.bottom)]}`;
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
   * 이름표에 **지금 든 것**을 적는다.
   *
   * ── 왜 고정 이름으로 두면 안 되나 ─────────────────────────────────
   * 「만든 병」은 학생이 직접 채우는 병이라, 지금 몇 % 가 들었는지가 **고를 수 있느냐를
   * 가른다.** 이름표가 늘 「만든 병」이면 10 % 를 두 번 넣었는지 증류수를 두 번 넣었는지
   * 화면 어디에도 안 나오고, 학생은 병을 열어 볼 방법이 없다.
   * 브라우저 검사에서 실제로 이것이 잡혔다 — 5 % 를 만들어 놓고도 화면은 「만든 병」이었다.
   *
   * 나머지 물건은 든 것이 안 바뀌므로 `shortNames` 를 그대로 쓴다.
   */
  function shortNameOf(item) {
    if (item.kind === 'bottleMix') {
      const pct = mixPct(store.getState().bench.mix);
      return pct === null ? UI.bench.mixEmpty : UI.bench.mixLabel(pct);
    }
    return UI.bench.shortNames[item.labelKey] ?? item.label;
  }

  /** 읽어 주는 기기에 나가는 긴 이름. 이름표와 **같은 것을 말해야 한다.** */
  function longNameOf(item) {
    if (item.kind === 'bottleMix') {
      const pct = mixPct(store.getState().bench.mix);
      return pct === null ? item.label : UI.bench.mixLabel(pct);
    }
    return item.label;
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
  function targetUnder() {
    const g = hitRect(drag.el, drag.item.asset);
    const cx = (g.left + g.right) / 2;
    const cy = (g.top + g.bottom) / 2;
    for (const other of items) {
      const or_ = drag.rects.get(other.id);
      if (!or_) continue;
      if (cx >= or_.left && cx <= or_.right && cy >= or_.top && cy <= or_.bottom) return other;
    }
    return null;
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

  /**
   * 지금 말풍선이 **키보드 포커스로** 뜬 것인가 (놓기 단추가 들어 있는가).
   * 물건에서 Tab 을 눌렀을 때 그 단추로 들어가게 하는 조건이다.
   */
  let tipFromKeyboard = false;
  /** Esc 로 치운 물건. 그 물건에 포커스가 남아 있는 동안은 다시 띄우지 않는다. */
  let dismissedId = null;

  function showTip(item, withActions = false) {
    if (drag) return;
    clearTimeout(hideTimer);   // 옆 물건으로 옮겨 오는 중이었다면 예약된 닫기를 취소한다
    hideTimer = 0;
    tipFromKeyboard = withActions;
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
    tipEl.hidden = true;
    tipFromKeyboard = false;
  }

  /** 말풍선의 놓기 단추들. 없으면 빈 배열. */
  const tipButtons = () => [...tipEl.querySelectorAll('[data-onto]')];

  /**
   * **단추까지 가는 다리.**
   *
   * `#bench-tip` 은 DOM 에서 `.bench-tokens` 뒤에 있다. 그래서 물건에서 Tab 하면 옆 물건으로
   * 가고, 그 물건의 focus 가 말풍선을 제 것으로 갈아 끼워 **방금 열려 있던 단추를 지운다.**
   * 물건 열여섯을 다 지나 말풍선에 닿을 즈음엔 마지막 물건(쓰레기통)의 말풍선만 남아 있다.
   *
   * 즉 **단추는 화면에 떠 있는데 키보드로는 아예 닿을 수 없었다.** 플레이테스트에서 진짜 Tab 을
   * 쳐 보고서야 나왔다 — 앞선 검사는 `btn.focus()` 를 불러서 「거기까지 갈 수 있는가」를
   * 못 봤다. 바나나랩이 같은 자리에서 물렸고, 그쪽 다리를 그대로 옮겨 왔다.
   */
  function focusFirstPut() {
    const [first] = tipButtons();
    if (!first) return false;
    first.focus();
    return true;
  }

  /**
   * 말풍선 안에서의 키. **양쪽 끝에서 실험대로 되돌려 준다.**
   * 첫 단추에서 Shift+Tab 은 원래 물건으로, 마지막 단추에서 Tab 은 그 물건의 **다음 물건**으로.
   * Esc 는 말풍선을 치우고 포커스를 물건에 돌려준다.
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
      el.setAttribute('aria-label', longNameOf(item));
      el.setAttribute('aria-describedby', 'bench-tip');
      el.innerHTML = ASSETS[item.asset].render(assetState(store, item));
      // 이름표는 **그림 아래**에 붙는다. 프레임 아래가 아니다 — 애셋마다 여백이 달라서
      // 프레임 기준으로 달면 어떤 것은 물건에 붙고 어떤 것은 한참 떨어진다.
      const c = CONTENT_BOX[item.asset];
      const [, , vw, vh] = CONTRACT[item.asset].viewBox.split(/\s+/).map(Number);
      el.insertAdjacentHTML('beforeend',
        `<i class="token-name" style="left:${((c.x0 + c.x1) / 2 / vw) * 100}%;`
        + `top:${(c.y1 / vh) * 100}%">${shortNameOf(item)}</i>`);
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
      el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTip(item); });
      el.addEventListener('pointerleave', () => hideTip());
      // 포커스로 뜬 말풍선에는 **놓을 곳 버튼**이 함께 나온다 — 키보드로 놓는 길이다.
      // :focus-visible 일 때만 낸다. 손가락으로 눌러도 <button> 은 포커스를 받는데,
      // 그때까지 이 말풍선을 띄우면 누를 때마다 떠서 안 사라지는 창이 된다.
      el.addEventListener('focus', () => {
        // 다른 물건으로 옮겨 갔으면 「Esc 로 치웠다」는 기억을 푼다.
        if (dismissedId && dismissedId !== item.id) dismissedId = null;
        if (dismissedId === item.id) return;
        if (el.matches(':focus-visible')) showTip(item, true);
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
        // Tab 으로 **놓기 단추에 들어간다.** 브라우저의 기본 Tab 은 옆 물건으로 가는데,
        // 그러면 그 물건의 focus 가 말풍선을 갈아 끼워 여기 단추가 사라진다 (`focusFirstPut` 주석).
        if (e.key === 'Tab' && !e.shiftKey && tipFromKeyboard && focusFirstPut()) {
          e.preventDefault();
          return;
        }
        // Esc 로 말풍선을 치운다 (WCAG 1.4.13). 포커스는 물건에 그대로 남는다.
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
   * **폭이 바뀌면 이름표를 다시 앉힌다.**
   *
   * `layoutNames()` 는 물건을 다시 그릴 때만 돌았다. 그런데 창 폭이 바뀌면 물건은
   * 그대로인데 **사이가 좁아진다** — 넓게 열어 두었다가 줄이면 이름표가 겹친 채로 남는다.
   * 320 px 에서 실제로 한 짝이 겹쳤고, 그 상태로 아무리 기다려도 안 풀렸다.
   *
   * **폭이 그대로면 아무것도 하지 않는다.** `ResizeObserver` 는 높이만 바뀌어도,
   * 이름표를 내리는 그 동작 때문에도 다시 불린다 — 문지기가 없으면 스스로를 깨워
   * 끝없이 돈다.
   */
  /**
   * 막대 높이를 CSS 에 알려 준다 — 말풍선이 그 아래에 서게 하려고.
   *
   * 막대는 `position:sticky; top:0` 이라 **화면 맨 위에 붙는다.** 말풍선도 위에 떴으니
   * 좁은 화면에서 정확히 겹쳤다 — 「이 시행 기록하기」가 390 px 에서 **95 %** 가렸다.
   * 하필 「20분이 지났습니다」를 띄우는 그 말풍선이 **그 말대로 누를 단추**를 덮었다.
   *
   * 아래로 내리는 것으로는 못 고친다. 좁은 화면에서는 노트 탭이 화면 아래에 오므로
   * **이번엔 탭을 100 % 덮는다** — 실제로 그렇게 만들었다가 되돌렸다.
   * 위도 아래도 막혀 있으니 **막대 바로 밑**, 즉 비어 있는 가운데에 세운다.
   *
   * 높이를 숫자로 박지 않는다 — 폭에 따라 57·87·117 로 달라진다. 재서 알려 준다.
   */
  const barEl = root.querySelector('.bench-bar');
  if (barEl) {
    let lastBar = '';
    const publish = () => {
      const bar = barEl.getBoundingClientRect();
      const col = root.getBoundingClientRect();
      const key = `${Math.round(bar.height)}|${Math.round(col.left)}|${Math.round(col.width)}`;
      if (key === lastBar) return;         // 그대로면 아무것도 안 한다 (자기를 깨우지 않게)
      lastBar = key;
      const st = document.documentElement.style;
      st.setProperty('--bench-bar-h', `${Math.round(bar.height)}px`);
      st.setProperty('--bench-left', `${Math.round(col.left)}px`);
      st.setProperty('--bench-w', `${Math.round(col.width)}px`);
    };
    const obs = new ResizeObserver(publish);
    obs.observe(barEl);
    obs.observe(root);
    publish();
  }

  let lastNameWidth = 0;
  const nameObserver = new ResizeObserver(() => {
    const w = Math.round(layer.getBoundingClientRect().width);
    if (w === lastNameWidth) return;
    lastNameWidth = w;
    layoutNames();
  });
  nameObserver.observe(layer);

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

  /**
   * 실험대 위 막대. **지금 시행이 어떻게 되고 있는지**를 늘 보여 준다.
   *
   * 시계가 화면에 없으면 학생 눈에는 시간이 저절로 나오는 것처럼 보인다.
   * 이 실험에서 재는 것이 시간 하나뿐이라 그러면 안 된다.
   */
  function renderBar() {
    const st = store.getState();
    const t = st.bench.tube;
    const C = UI.bench.clock;
    const undosLeft = st.session.undosLeft;
    root.querySelector('#undo-left').textContent =
      undosLeft === Infinity ? UI.undo.unlimited : UI.undo.left(undosLeft);

    takeOutBtn.hidden = !t.inIncubator;
    if (t.inIncubator) takeOutBtn.textContent = UI.bench.takeOut(t.tempC);

    root.querySelector('#clock').textContent = t.runConditions === null ? C.idle
      : t.elapsedMin >= OBSERVE_LIMIT_MIN ? C.done(OBSERVE_LIMIT_MIN, gasNow(t))
        : `${C.running(t.elapsedMin, gasNow(t))} · ${C.speed(CLOCK_SPEED)}`;

    // **발효관에 무엇이 들었는지 늘 보인다.** 채우다 보면 무엇을 넣었는지 잊는데,
    // 이 실험에서 잊으면 총 부피가 어긋나고 그 시행은 견줄 수 없게 된다.
    const parts = tubeContents(t);
    root.querySelector('#tube-contents').textContent =
      parts.length === 0 ? UI.bench.tubeEmpty : UI.bench.tubeContents(parts.join(' · '));

    root.querySelector('#trials').textContent = UI.bench.trials(st.trials.length);
  }

  /**
   * 관찰 창 — 맹관부에 기체가 모이는 그림.
   *
   * 실험대의 발효관 토큰은 화면에서 작아 맹관부의 기체가 보이지 않는다. 이 실험은
   * **보는 것이 결과 전부**이므로 크게 그릴 자리가 따로 있어야 한다.
   */
  function renderWatch() {
    const t = store.getState().bench.tube;
    root.querySelector('#bench-watch').innerHTML = renderTube(t, { idPrefix: 'watch' });
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
