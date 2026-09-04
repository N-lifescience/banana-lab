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
import { excess } from '../sim/state.js';
import { UI, emphasize } from './strings.js';

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

/** 애셋 그림의 세로/가로 비. 이 저장소는 전 애셋이 400×300 이다. */
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

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

/**
 * 점에서 사각형까지의 거리(제곱). **사각형 안이면 0.**
 *
 * 겹친 물건 중 누가 이기는지를 「**그림 한가운데**까지의 거리」로 가르면
 * **크거나 긴 그림이 불리하다** — 자기 가장자리는 자기 한가운데보다 옆 물건 한가운데에
 * 더 가깝기 때문이다. 개수대처럼 넓은 그림은 자기 그림 위를 짚었는데도 이웃에게 진다.
 * 여기서도 320 px 에서 개수대 그림 위 세 점이 그렇게 샜다.
 *
 * 「**그림까지**의 거리」로 가르면 자기 그림 위에서는 언제나 0 이라 절대 지지 않는다.
 */
function distTo(r, x, y) {
  const dx = Math.max(r.left - x, 0, x - r.right);
  const dy = Math.max(r.top - y, 0, y - r.bottom);
  return dx * dx + dy * dy;
}

/**
 * 실험대 위 배치. 좌표는 전부 **mm** 다.
 * `x` 는 왼쪽 끝, `bottom` 은 물건이 바닥을 대는 높이 — 선반 위인지 작업면 위인지.
 * 위쪽 좌표(y)는 실물 크기에서 계산하므로, `realSizeMm` 을 고치면 자리도 알아서 따라온다.
 */
function defaultItems() {
  const shelf = (x, rest) => ({ x, bottom: SHELF_MM, ...rest });
  const surface = (x, rest) => ({ x, bottom: SURFACE_MM, ...rest });
  /*
   * 두 선 어디에도 안 걸치는 자리. 편집 모드에서 자유롭게 옮긴 것을 **코드로 적으려면**
   * 이게 있어야 한다 — `shelf(x)`·`surface(x)` 만으로는 x 밖에 못 적어서,
   * 애써 맞춘 높이가 붙여 넣는 순간 선으로 되돌아간다.
   *
   * **두 번째 인자는 `shelf`·`surface` 와 달리 「윗변」이다.** 정본과 맞춘 것이다 —
   * 처음에는 「바닥」으로 썼는데, 스스로는 왕복해도 저장소끼리 뜻이 갈리면 배치를 옮겨
   * 붙일 때 조용히 어긋난다. 바닥은 여기서 키로 계산한다.
   */
  const at = (x, y, rest) => ({ x, bottom: y + heightMm(rest.asset), ...rest });
  const I = UI.bench.items;
  return [
    // 상단 선반 — 만드는 데 쓰는 것
    // 왼쪽에서 오른쪽으로 (가)·(나)·(다) 순이다. 탐구 노트와 보고서가 어디서나
    // (가)→(다) 로 읽히므로 실험대만 거꾸로면 매번 왼쪽 끝으로 돌아가야 한다.
    shelf(40, { id: 'onion', asset: 'onion', kind: 'onion', labelKey: 'onion' }),
    shelf(150, { id: 'blade', asset: 'blade', kind: 'blade', labelKey: 'blade' }),
    shelf(310, { id: 'slideA', asset: 'slide', kind: 'slide', slide: 'A', labelKey: 'slideA' }),
    shelf(430, { id: 'slideB', asset: 'slide', kind: 'slide', slide: 'B', labelKey: 'slideB' }),
    shelf(550, { id: 'slideC', asset: 'slide', kind: 'slide', slide: 'C', labelKey: 'slideC' }),
    // 받침 유리 통과 덮개 유리 통을 나란히 둔다 — 둘 다 "통에서 꺼내 쓰는 것" 이라
    // 한 쌍으로 읽혀야 한다.
    shelf(672, { id: 'slidebox', asset: 'slidebox', kind: 'slidebox', labelKey: 'slidebox' }),
    shelf(775, { id: 'coverbox', asset: 'coverbox', kind: 'coverslip', labelKey: 'coverbox' }),
    // 용액병 다섯. **증류수를 맨 왼쪽에 두고 설탕 용액을 농도 순으로 늘어놓는다.**
    // 순서가 섞여 있으면 「농도를 바꿔 가며」가 병을 찾는 일이 되고, 학생은 어느 농도를
    // 이미 해 봤는지 기억으로만 좇아야 한다.
    shelf(860, { id: 'bottleWATER', asset: 'bottle', kind: 'bottle', solution: 'WATER', labelKey: 'bottleWATER' }),
    shelf(952, { id: 'bottleS05', asset: 'bottle', kind: 'bottle', solution: 'S05', labelKey: 'bottleS05' }),
    shelf(1044, { id: 'bottleS10', asset: 'bottle', kind: 'bottle', solution: 'S10', labelKey: 'bottleS10' }),
    shelf(1136, { id: 'bottleS15', asset: 'bottle', kind: 'bottle', solution: 'S15', labelKey: 'bottleS15' }),
    shelf(1228, { id: 'bottleS20', asset: 'bottle', kind: 'bottle', solution: 'S20', labelKey: 'bottleS20' }),
    // 작업면 — 손에 쥐는 것과 씻고 버리는 곳
    surface(0, { id: 'bin', asset: 'bin', kind: 'bin', labelKey: 'bin' }),
    surface(160, { id: 'waste', asset: 'waste', kind: 'waste', labelKey: 'waste' }),
    surface(300, { id: 'sink', asset: 'sink', kind: 'sink', labelKey: 'sink' }),
    surface(560, { id: 'tissue', asset: 'tissue', kind: 'tissue', labelKey: 'tissue' }),
    surface(740, { id: 'microscope', asset: 'microscope', kind: 'microscope', labelKey: 'microscope' }),
    // 거름종이를 현미경 **옆**에 둔다. 치환은 슬라이드를 재물대에 올려 둔 채로 하는 일이라,
    // 손이 현미경과 이 사이를 오간다.
    surface(1120, { id: 'filterpaper', asset: 'filterpaper', kind: 'filterpaper', labelKey: 'filterpaper' }),
    surface(1290, { id: 'dropper', asset: 'dropper', kind: 'dropper', labelKey: 'dropper' }),
    surface(1400, { id: 'forceps', asset: 'forceps', kind: 'forceps', labelKey: 'forceps' }),
    // 이름은 키로만 적어 둔다. 편집 모드가 배치를 다시 코드로 뱉을 때
    // `label: I.onion` 을 되살리려면 어느 키였는지를 알아야 한다.
  ].map((it) => ({ ...it, label: I[it.labelKey], y: it.bottom - heightMm(it.asset) }));
}

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
    // 비늘잎에 5×5 mm 칼집을 낸다. 칼집이 없으면 표피가 통째로 찢겨 두껍게 벗겨진다.
    blade: {
      onion: () => store.dispatch('CUT_SCALE', {}),
    },
    dropper: {
      bottle: (item, target) => store.dispatch('FILL_DROPPER', { solution: target.solution }),
      // 받침 유리에 대면 확대 뷰가 열린다 — 방울은 거기서 고무를 눌러 한 방울씩 떨어뜨린다.
      // 덮개 유리가 덮여 있으면 액은 가장자리에 고인다. 그것도 거기서 본다.
      slide: (item, target) => openZoom('slide', target.slide, 'dropper'),
      // 재물대에 올린 채로도 가장자리에 댈 수 있어야 한다 (filterpaper 주석 참조).
      // 여기서는 확대 뷰를 열지 않는다 — 보고 있는 화면은 시야이지 받침 유리가 아니다.
      microscope: () => store.dispatch('APPLY_SOLUTION', { slide: store.getState().microscope.stage }),
      waste: () => store.dispatch('RINSE_DROPPER', {}),
    },
    forceps: {
      // **어느 면을 벗기는가**가 이 실험의 변인이라 손끝 일이다. 확대 뷰에서 고른다.
      onion: () => openZoom('onion', null, 'forceps'),
      coverslip: () => store.dispatch('PICK_COVERSLIP', {}),
      // 표피를 펴 올리는 것도, 덮는 것도, 들어내는 것도 손끝 일이다.
      slide: (item, target) => openZoom('slide', target.slide, 'forceps'),
      // 쓴 덮개 유리는 고형 폐기물이다. 폐액통이 아니라 쓰레기통에 버린다.
      bin: () => store.dispatch('DISCARD_COVERSLIP', {}),
    },
    /**
     * 거름종이를 덮개 유리 **반대쪽**에 댄다. 이 실험의 중심 조작이다.
     *
     * 여기서 「가장자리에 용액을 먼저 대세요」로 막지 않는다. 댈 것이 없으면
     * 규칙 엔진이 어디에 무엇을 하면 되는지 답해 준다 — 그 답을 듣는 것이 배우는 내용이다.
     *
     * ── 현미경에도 댈 수 있어야 한다 ──────────────────────────────
     * 재물대에 올린 받침 유리는 실험대에서 **사라진다** (그 자리에 있으니까).
     * 그런데 이 실험의 치환은 **슬라이드를 재물대에 둔 채로** 하는 일이다 —
     * 같은 세포가 변해 가는 것을 보는 것이 전부이기 때문이다.
     * 슬라이드에만 댈 수 있게 두었더니 **치환에 닿을 방법이 아예 없었다.**
     * 직접 플레이해서 잡았다 (`PLAYBOOK.md` §8 「반드시 직접 플레이한다」).
     */
    filterpaper: {
      slide: (item, target) => store.dispatch('WICK', { slide: target.slide }),
      microscope: () => store.dispatch('WICK', { slide: store.getState().microscope.stage }),
    },
    // 휴지로 대물렌즈를 닦는다. 덮개 유리 없이 고배율로 올려 렌즈가 더러워졌을 때
    // 되돌릴 길이 여태 없었다 — 한 번의 실수로 현미경을 못 쓰게 두지 않는다.
    tissue: {
      microscope: () => store.dispatch('CLEAN_LENS', {}),
    },
    slide: {
      /**
       * 재물대에 올린다.
       *
       * 1단계는 여기서 저배율 초점까지 **대신 맞춰 주고** 400배로 올려 준다.
       * 나사 조작을 잘못하면 슬라이드가 깨져 되돌릴 길이 좁아지는데, 1단계는 그걸
       * 감당하는 자리가 아니다. 2·3단계는 저배율부터 직접 올라간다.
       *
       * **순서가 전부다.** 조동나사는 고배율에서 돌리면 슬라이드를 깨뜨린다.
       * 배율은 슬라이드를 바꿔도 그대로 남아 있으므로, 앞 슬라이드를 400배로 보다가
       * 새것을 올리면 곧바로 400배에서 조동나사를 돌리는 셈이 된다 — 올리자마자 깨진다.
       * 그래서 저배율로 **먼저 내리고**, 초점을 맞추고, 그다음 올린다.
       * 이 순서라야 `SET_OBJECTIVE` 가 "저배율에서 초점을 맞추지 않고 올렸습니다" 라는,
       * 학생이 한 적 없는 일로 나무라지도 않는다.
       */
      microscope: (item) => {
        const r = store.dispatch('MOUNT', { slide: item.slide });
        /*
         * **안 올라갔으면 맞춰 줄 것도 없다.** 금 간 유리는 `MOUNT` 가 막는데, 그 뒤에도
         * 배율·초점을 맞추는 세 조작이 그대로 돌아서 빨간 「금이 갔습니다」 바로 뒤에
         * 초록 「대물렌즈를 10배로 바꿨습니다」가 떴다 — 막힌 직후에 잘됐다는 말이 따라오면
         * 학생은 올라간 줄 안다. osmosis 플레이테스트(2026-09-02)에서 잡았다.
         */
        if (r.outcome === 'blocked') return;
        if (store.getState().session.level !== 1) return;
        store.dispatch('SET_OBJECTIVE', { objective: 4 });
        store.dispatch('COARSE_FOCUS', { delta: -store.getState().microscope.coarse });
        // **400배가 아니라 100배로 올려 준다.** 이 관찰이 재는 것은 「몇 개 중 몇 개」라
        // 시야에 셀 만큼의 세포가 있어야 한다 (quality.magnificationFactor).
        store.dispatch('SET_OBJECTIVE', { objective: 10 });
      },
      sink: (item) => store.dispatch('RINSE_SLIDE', { slide: item.slide }),
      // 금이 간 유리는 씻어도 그대로다. 통에 대면 그 자리를 새것이 대신한다.
      slidebox: (item) => store.dispatch('NEW_SLIDE', { slide: item.slide }),
      // 깨진 유리는 고형 폐기물이다. 버리는 손짓이 먼저 나오는 학생도 있으므로 같은 길을 연다.
      bin: (item) => store.dispatch('NEW_SLIDE', { slide: item.slide }),
    },
  };
}

/**
 * 물건을 클릭(또는 Enter/Space)했을 때.
 *
 * **누르면 본다, 끌면 옮긴다, 단추로 한다** (docs/09-uniformity.md §2).
 * 눌러서 상태가 바뀌는 물건은 하나도 없다 — 칼집·표피 벗기기도 비늘잎 화면의 단추다.
 * 모든 물건이 누르면 자기 화면을 연다. 「무엇을 받는 곳인지」를 그 화면이 말한다.
 * 실험대에서 상태를 바꾸는 손짓은 끌어다 놓기(`dropTable`)뿐이다.
 *
 * 용액병·폐액통·휴지의 안전 수칙 탭(마개 닫기·폐액 버리기·손 씻기)은 걷어냈다 — 가상 실험에서
 * 그것을 따지면 안전 습관이 아니라 화면 속 단추를 눌렀다는 사실을 평가하게 된다.
 */
export function tapTable(store, onOpenZoom) {
  const view = (item, el) => onOpenZoom('item', item.id, el);
  return {
    // 어느 면을 벗길지 고르고 벗기는 것은 손끝 일이다. 비늘잎 화면에서 한다.
    onion: (item, el) => onOpenZoom('onion', null, el),
    slide: (item, el) => onOpenZoom('slide', item.slide, el),
    microscope: (item, el) => onOpenZoom('scope', store.getState().microscope.stage, el),
    blade: view, coverslip: view, slidebox: view, dropper: view, forceps: view,
    filterpaper: view, bottle: view, waste: view, sink: view, tissue: view, bin: view,
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

/** 실험대에 놓인 물건들. 배치를 몰라도 종류만 알면 되는 검사에 쓴다. */
export const BENCH_KINDS = [
  'onion', 'blade', 'slide', 'coverslip', 'slidebox', 'dropper', 'forceps',
  'bottle', 'filterpaper', 'microscope', 'waste', 'sink', 'bin', 'tissue',
];

/**
 * 배치를 다시 코드로 뱉는다 — 편집 모드에서 옮긴 자리를 그대로 `defaultItems()` 에 붙여 넣는다.
 *
 * 눈으로 옮긴 것을 손으로 숫자로 옮겨 적는 일은 반드시 어딘가 틀린다.
 * 옮긴 사람이 스크린샷만 보내면 되도록, 화면이 스스로 좌표를 말하게 한다.
 */
function layoutCode(items) {
  const lines = items.map((it) => {
    /*
     * 선 위에 있으면 `shelf`/`surface` 로, **아니면 `at(x, y)`** 로 적는다.
     * 자유 배치가 되면서 y 를 적을 수 있어야 한다 — 안 그러면 미세 조정이 붙여 넣는 순간
     * 사라진다. 정본은 아직 x 만 적는다(허브에 알렸다).
     */
    const onShelf = Math.abs(it.bottom - SHELF_MM) < 1;
    const onSurface = Math.abs(it.bottom - SURFACE_MM) < 1;
    const fn = onShelf ? 'shelf' : (onSurface ? 'surface' : 'at');
    const props = [
      `id: '${it.id}'`,
      `asset: '${it.asset}'`,
      `kind: '${it.kind}'`,
      it.slide ? `slide: '${it.slide}'` : null,
      it.solution ? `solution: '${it.solution}'` : null,
      `labelKey: '${it.labelKey}'`,
    ].filter(Boolean).join(', ');
    // `at` 의 둘째 인자는 **윗변**이다 (정본과 같은 뜻). 바닥은 붙여 넣는 쪽에서 키로 구한다.
    const args = fn === 'at' ? `${Math.round(it.x)}, ${Math.round(it.y)}` : `${Math.round(it.x)}`;
    return `    ${fn}(${args}, { ${props} }),`;
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
  unmountBtn.addEventListener('click', () => store.dispatch('UNMOUNT', {}));

  // 확대 뷰를 열 때 「어디서 열었는가」를 넘긴다 — 닫으면 그 자리로 포커스가 돌아간다.
  // 받침 유리는 id 가 `slideA` 처럼 슬라이드 번호에 매여 있고, 비늘잎은 하나뿐이다.
  const DROPS = dropTable(store, (mode, id, tool) =>
    onOpenZoom(mode, id, elFor(mode === 'onion' ? 'onion' : `slide${id}`), tool));

  const TAPS = tapTable(store, onOpenZoom);

  const items = defaultItems();
  for (const item of items) { item.homeX = item.x; item.homeY = item.y; }
  let drag = null;

  /* ---------------- 편집 모드 ---------------- */

  /**
   * **놓은 자리에 그대로 둔다.** 실험대 밖으로만 안 나가게 한다.
   *
   * 앞서는 두 선(선반·작업면) 중 가까운 쪽에 바닥을 붙였다. 사장님 말씀 —
   * 「**준비물들 위치 가능한 포지션을 너가 정해두지마. 내가 미세하게 조정할거야.**」
   * 붙여 주는 것이 도움이 아니라 방해였다.
   */
  function placeFreely(item) {
    const h = heightMm(item.asset);
    item.x = clamp(item.x, 0, STAGE_W_MM - CONTRACT[item.asset].realSizeMm);
    item.y = clamp(item.y, 0, STAGE_H_MM - h);
    // `bottom` 은 배치 코드가 읽는 값이라 계속 낸다 — 이제 「붙인 선」이 아니라 **바닥 높이**다.
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
    return `${Math.abs(it.bottom - SHELF_MM) < 1 ? UI.edit.shelf : UI.edit.surface}`;
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

  function slideRenderState(slideId) {
    const s = store.getState().slides[slideId];
    return {
      sample: s.sample,
      // 지금 덮개 유리 아래에 있는 용액. **농도로 색을 가르지 않는다** — 설탕 용액은
      // 넷 다 같은 색이다. 병 색만 보고 농도를 알게 되면 이름표를 읽을 일이 없어진다.
      medium: s.medium?.id ?? null,
      // 넘친 액은 실험대에서도 보여야 한다. 확대 뷰를 열어야만 보이면
      // 열여섯 방울을 떨어뜨린 학생이 실험대만 보고는 아무 일도 없다고 여긴다.
      excess: excess(s),
      coverslip: s.coverslip.placed,
      bubbles: s.coverslip.bubbles,
      seed: s.seed,
    };
  }

  function assetState(item) {
    const st = store.getState();
    switch (item.kind) {
      case 'onion':
        // 지금 위를 향한 면은 핀셋에 물린 조각이 있으면 그 면, 없으면 바깥쪽이 기본이다.
        // 어느 면인지가 색으로 드러나야 학생이 실험대만 보고도 고른 것을 확인할 수 있다.
        return {
          side: st.tools.epidermis?.side ?? 'outer',
          cut: st.tools.onion.cut,
          peeled: st.tools.epidermis ? 1 : 0,
        };
      case 'filterpaper':
        return { wet: 0 };
      case 'slide':
        return slideRenderState(item.slide);
      case 'coverslip':
        return {};
      case 'dropper':
        return { holds: st.tools.dropper.holds, level: st.tools.dropper.level };
      case 'forceps':
        return { holding: st.tools.forceps.holding };
      case 'bottle':
        return { kind: item.solution, level: 0.7 };
      case 'microscope':
        return {
          objective: st.microscope.objective, coarse: st.microscope.coarse, fine: st.microscope.fine,
          diaphragm: st.microscope.diaphragm, lamp: st.microscope.lamp, stage: st.microscope.stage,
        };
      case 'waste':
        return { level: 0.2 };
      default:
        return {};
    }
  }

  /**
   * 재물대에 올라간 받침 유리는 실험대에서 사라진다 — 그 자리에 있으니까.
   *
   * 덮개 유리는 사라지지 않는다. 한 상자에서 계속 꺼내 쓰는 물건이고,
   * 석 장을 세고 있다가 잘못 덮은 뒤 씻고 다시 하면 곧바로 바닥나 막다른 길이 된다.
   */
  function isHidden(item) {
    return item.kind === 'slide' && store.getState().microscope.stage === item.slide;
  }

  const elFor = (id) => layer.querySelector(`[data-id="${id}"]`);

  /**
   * 놓기 판정에 쓰는 사각형. 그림이 작아도 최소 MIN_HIT_PX 는 잡아 준다 —
   * 화면에서 눌리는 영역(.token::after)과 같은 크기여야 손에 잡히는 대로 동작한다.
   *
   * **넓힌 자리(잡히는 곳)와 그림 자리를 함께 낸다.** 겹쳤을 때 누가 이기는지는
   * 넓힌 자리가 아니라 **그림**으로 가려야 하기 때문이다 (`distTo` 주석 참조).
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
      drawn: { left: cx - dw / 2, right: cx + dw / 2, top: cy - dh / 2, bottom: cy + dh / 2 },
    };
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
   * 끄는 물건의 **그림** 중심 아래 있는 토큰. 프레임 중심은 그림 밖일 수 있다.
   *
   * 겹쳤을 때 **가장 가까운 것**이 이긴다. 예전에는 `items` 순서에서 첫 번째를 집었는데,
   * 그러면 어느 것이 잡히는지가 **배열 순서**로 정해진다 — 손이 어디를 겨눴는지와 무관하게.
   * 넓힌 판정 자리(MIN_HIT_PX)는 좁은 화면에서 실제로 겹친다 (`aimedAt` 주석 참조).
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
      const d = distTo(or_.drawn, cx, cy);
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
   * 끌어다 놓는 조작에는 키보드 경로가 없었다 — 칼집 내기·채우기·집기·올리기가 전부
   * 마우스 전용이라, 마우스를 쓰지 못하면 실험을 시작조차 할 수 없었다.
   *
   * 포커스로 말풍선이 떴을 때만 **놓을 곳 버튼**을 함께 낸다. Tab 으로 들어가 Enter 로 놓는다.
   *
   * 이 실험에서 놓기는 손짓의 세기나 방향을 보지 않는다 — 손끝으로 정하는 것(덮개 유리 각도,
   * 떨어뜨리는 방울 수)은 전부 확대 뷰에서 하므로, 키보드로도 같은 자리에서 같게 할 수 있다.
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
   * 지금 뜬 말풍선이 **키보드로 연 것**인가.
   *
   * 포커스로 뜬 말풍선에만 「여기에 놓기」 버튼이 붙는다. 마우스를 못 쓰는 사람에게는
   * 그 버튼이 **끌어다 놓는 길의 전부**다. 그런데 마우스가 지나가기만 해도 닫혔다 —
   * 포커스는 그대로인데 길만 사라졌다. 마우스끼리는 서로 덮어써도 되지만,
   * **키보드로 연 것은 지킨다.** (catalase-lab 세션이 짚어 줬고 여기서 재현했다.)
   */
  let tipFromKeyboard = false;

  /**
   * Esc 로 치운 말풍선의 물건 id.
   *
   * 말풍선은 실험대를 가린다. **포커스를 옮기지 않고 치울 수 있어야 한다** (WCAG 1.4.13).
   * 그런데 치우기만 해서는 모자란다 — 마우스를 물건에 얹어 둔 채로 조작하면 다시 그릴 때
   * `pointerenter` 가 다시 쏘여 **치운 말풍선이 도로 뜬다.** 시간이 흐르는 동안에는
   * 틱마다 그러니 치워도 치워도 돌아온다. 1.4.13 이 막으려는 바로 그 모양이다.
   * 그래서 「어느 물건의 것을 치웠는지」를 들고 있다가 그 물건에는 다시 안 띄운다.
   * 다른 물건으로 옮기거나 포커스로 짚으면 풀린다.
   */
  let tipDismissedFor = null;

  /** 말풍선이 지금 키보드 사용자의 것인가 — 포커스가 아직 실험대 안에 있어야 한다. */
  const tipIsKeyboards = () => tipFromKeyboard && layer.contains(document.activeElement);

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
      `<b>${item.label}</b>${lines.map((t) => `<span>${emphasize(t)}</span>`).join('')}${actions}`;
    const puts = [...tipEl.querySelectorAll('[data-put]')];
    puts.forEach((b, i) => {
      b.addEventListener('click', () => {
        const from = items.find((x) => x.id === b.dataset.put);
        const onto = items.find((x) => x.id === b.dataset.onto);
        if (from && onto) runDrop(from, onto);
      });
      /*
       * 말풍선 안에서 나가는 길. 없으면 **들어온 곳으로 돌아갈 수도, 다음으로 갈 수도** 없다.
       *   Shift+Tab (첫 버튼)  → 들어온 물건
       *   Tab       (끝 버튼)  → **다음 물건** (그냥 두면 탐구 노트로 튕겨 나간다)
       *   Esc                  → 포커스는 그대로 두고 말풍선만 치운다 (WCAG 1.4.13)
       */
      b.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const back = elFor(item.id);
          if (dismissTip()) { e.preventDefault(); back?.focus(); }
          return;
        }
        if (e.key !== 'Tab') return;
        if (e.shiftKey && i === 0) {
          e.preventDefault();
          elFor(item.id)?.focus();
          return;
        }
        if (!e.shiftKey && i === puts.length - 1) {
          const all = tokenEls();
          const at = all.findIndex((x) => x.dataset.id === item.id);
          const next = at >= 0 ? all[at + 1] : null;
          if (next) { e.preventDefault(); next.focus(); }
        }
      });
    });
    // 무대 밖으로 밀려나지 않게 가로 위치를 안쪽으로 묶는다.
    const centerMm = item.x + CONTRACT[item.asset].realSizeMm / 2;
    tipEl.style.left = `${clamp(xPct(centerMm), 12, 88)}%`;
    // 위쪽에 있는 물건은 말풍선을 아래로 — 위로 띄우면 실험대 밖으로 나간다.
    const below = yPct(item.y) < 26;
    tipEl.dataset.below = String(below);
    tipEl.style.top = `${yPct(below ? item.y + heightMm(item.asset) : item.y)}%`;
    // 이 말풍선이 **누구 것인지**. Tab 다리가 이 값으로 돌아갈 물건을 찾는다.
    tipEl.dataset.for = item.id;
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

  /** Esc — 포커스를 옮기지 않고 치운다. 그 물건에는 다시 안 뜬다 (WCAG 1.4.13). */
  function dismissTip() {
    if (tipEl.hidden) return false;
    tipDismissedFor = tipEl.dataset.for ?? null;
    hideTip();
    return true;
  }

  /** 실험대에 놓인 차례대로의 물건 단추들. Tab 다리가 「다음 물건」을 찾는 데 쓴다. */
  const tokenEls = () => [...layer.querySelectorAll('.token')];

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

  /**
   * 누른 자리에서 **실제로 겨눈 물건**을 고른다.
   *
   * 판정 자리는 손가락에 잡히도록 `MIN_HIT_PX` 까지 넓혀 준다. 그런데 화면이 좁아지면
   * **그림만 줄고 이 최소 크기는 그대로**라, 이웃끼리 포개진다. 그러면 브라우저는 위에
   * 그려진 쪽을 주고, **그림 한가운데를 정확히 눌러도 옆 것이 집힌다.**
   *
   * 재 보니 폰 393 px 에서 용액병 다섯이 통째로 한 칸씩 밀렸다 — 증류수를 눌렀는데 5 % 가
   * 집힌다. **어느 용액을 썼는지가 전부인 실험**이라 결과가 통째로 달라진다. 그런데
   * 데스크톱에서는 안 겹쳐서 영영 안 보인다. 교실에서 쓰는 것은 태블릿과 폰이다.
   *
   * 그래서 **그림 한가운데가 가장 가까운 것**으로 바꿔 준다.
   * 겹치지 않는 화면에서는 자기 자신이 뽑히므로 아무것도 달라지지 않는다.
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
      const d = distTo(r.drawn, e.clientX, e.clientY);
      // **같은 거리면 나중에 그려진 것**(위에 보이는 것)이 이긴다.
      // 그림 두 개가 겹친 자리는 둘 다 0 이라 흔한데, 그때 손이 짚은 것은 위에 보이는 쪽이다.
      if (d <= bestDist) { bestDist = d; best = other; }
    }
    return best;
  }

  function onPointerDown(e, item, el) {
    if (e.button !== undefined && e.button !== 0) return;
    // 넓힌 자리가 겹쳤으면 **겨눈 것**으로 바꾼다.
    const aimed = aimedAt(e, item);
    if (aimed.id !== item.id) {
      const ael = elFor(aimed.id);
      if (ael) { item = aimed; el = ael; }
    }
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
      moved: false,
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
  /**
   * 방금 포인터로 처리한 탭. 뒤따라올 합성 `click` 을 삼키는 데 쓴다.
   * **키보드 Enter/Space 에서도 찍힌다** — 거기서도 합성 click 이 따라오기 때문이다.
   */
  let pointerTapAt = 0;

  /**
   * 방금 **손가락으로** 탭했는가. 포커스 말풍선을 참는 데에만 쓴다.
   *
   * ── 왜 따로 두는가 ────────────────────────────────────────────────
   * 위 `pointerTapAt` 을 그대로 쓰면 **키보드로 한 번 조작한 뒤 0.5초 동안
   * 「여기에 놓기」 버튼이 다시 안 나온다.** 키보드로 쓰는 사람은 두 번째 조작을
   * 그만큼 기다려야 한다. 재현했다 — 용액병에서 Enter 를 누른 뒤 곧바로 거름종이로
   * 옮기면 버튼이 없었다.
   *
   * 참고 싶은 것은 **손가락 탭 하나뿐**이다 (손가락으로 눌러도 <button> 은 포커스를
   * 받는데, 그때 띄우면 누를 때마다 떠서 안 사라지는 창이 된다).
   * 두 값은 목적이 다르므로 따로 잰다. (banana-lab 허브 세션이 짚어 줬다.)
   */
  let fingerTapAt = 0;
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
      if (e.pointerType !== 'mouse') fingerTapAt = performance.now();
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
      //
      // **키보드로 연 말풍선은 마우스가 빼앗지 못한다.** 조작할 때마다 실험대가 다시 그려지는데,
      // 가만히 있던 포인터 밑에 새 물건이 들어서면 브라우저가 `pointerenter` 를 다시 쏜다 —
      // 마우스는 움직이지도 않았는데 키보드 사용자의 놓기 버튼이 사라졌다. 실제로 재현했다.
      //
      // **이름표도 겨눈 것을 말해야 한다.** 브라우저가 준 `item` 을 그대로 띄우면,
      // 넓힌 자리가 겹치는 좁은 화면에서 **손이 짚은 것과 이름이 다른 것**을 가리킨다 —
      // 그러고는 눌러 보면 또 다른 것이 집힌다(누르기는 `aimedAt` 을 지나므로).
      // 이름과 손이 어긋나는 것이 겹침 자체보다 나쁘다. 같은 `aimedAt` 을 쓴다.
      const hoverTip = (e) => {
        if (e.pointerType !== 'mouse') return;
        if (drag) return;                       // 끄는 중에는 이름표를 내지 않는다
        if (tipIsKeyboards()) return;
        const aimed = aimedAt(e, item);
        // Esc 로 치운 물건이면 다시 띄우지 않는다. 다른 물건으로 옮기면 풀린다.
        if (tipDismissedFor === aimed.id) return;
        tipDismissedFor = null;
        // 겨눈 것이 그대로면 다시 그리지 않는다 — 움직일 때마다 깜빡인다.
        if (!tipEl.hidden && tipEl.dataset.for === aimed.id) return;
        showTip(aimed);
      };
      el.addEventListener('pointerenter', hoverTip);
      // 겹친 자리 안에서 움직이면 겨눈 것이 바뀐다. `pointerenter` 는 그때 안 쏘인다.
      el.addEventListener('pointermove', hoverTip);
      el.addEventListener('pointerleave', () => {
        if (tipIsKeyboards()) return;
        hideTip();
      });
      // 포커스로 뜬 말풍선에는 **놓을 곳 버튼**이 함께 나온다 — 키보드로 놓는 길이다.
      //
      // 막고 싶은 것은 **손가락 탭 직후** 하나뿐이다 (손가락으로 눌러도 <button> 은 포커스를
      // 받는데, 그때 띄우면 누를 때마다 떠서 안 사라지는 창이 된다).
      // 앞서는 `:focus-visible` 로 막았는데 그건 브라우저가 「지금 키보드를 쓰는 중인가」를
      // **어림잡는 값**이라, 보조기기가 `element.focus()` 로 짚었을 때 안 쳐 줄 수 있다.
      // 재고 싶은 것은 `fingerTapAt` 으로 **직접 재고 있다** — 그것을 쓴다.
      // (`pointerTapAt` 을 쓰면 안 된다. 그 값은 키보드 Enter 에서도 찍힌다.)
      el.addEventListener('focus', () => {
        if (performance.now() - fingerTapAt < POINTER_TAP_GRACE_MS) return;
        /*
         * Esc 로 치운 물건에는 **포커스가 거기 머무는 동안** 다시 띄우지 않는다.
         *
         * 조작하면 실험대를 다시 그리는데, 그때 포커스를 제자리로 되돌린다
         * (`renderTokens` 끝). 그 되돌림도 `focus` 라서, 그냥 두면 **Esc 로 치운
         * 말풍선이 조작할 때마다 도로 떴다.** 재현했다.
         *
         * 포커스가 다른 물건으로 갔다가 돌아오면 다시 뜬다 — WCAG 1.4.13 이
         * 「hover/focus 가 걷힐 때까지 치운 채로 둔다」고 하는 것이 그 뜻이다.
         */
        if (tipDismissedFor === item.id) return;
        tipDismissedFor = null;
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
        // Esc — 말풍선이 실험대를 가린다. **포커스를 옮기지 않고** 치울 수 있어야 한다.
        if (e.key === 'Escape') {
          if (dismissTip()) e.preventDefault();
          return;
        }
        /*
         * Tab — **놓기 버튼으로 건너간다.**
         *
         * 말풍선(`.bench-tip`)은 DOM 에서 물건들(`.bench-tokens`) **뒤**에 있다.
         * 그래서 그냥 두면 물건에서 Tab 하면 **옆 물건**으로 가고, 그 물건의 focus 가
         * 말풍선을 제 것으로 갈아 끼워 **방금 열려 있던 버튼을 지운다.**
         * 물건을 다 지나 말풍선에 닿을 즈음엔 마지막 물건의 버튼만 남아 있다 —
         * 즉 **자기 물건의 놓기 버튼에는 영영 못 닿는다.** 재현했다:
         * 거름종이에서 Tab 세 번이면 핀셋의 버튼이 나왔다.
         *
         * 마우스를 못 쓰는 사람에게 그 버튼은 물건을 옮기는 길의 전부다. 다리를 놓는다.
         */
        if (e.key === 'Tab' && !e.shiftKey && !tipEl.hidden && tipEl.dataset.for === item.id) {
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

  /*
   * **실험대 크기가 바뀌면 다시 앉힌다.**
   *
   * 이 계산은 물건을 다시 그릴 때만 돌았다. 그런데 이름표가 부딪히는지는 **화면 폭**에
   * 달렸고, 창 크기는 아무것도 다시 그리지 않고 바뀐다 — 태블릿을 돌리거나 창을 좁히면
   * **옛 배치가 그대로 남아 이름표가 겹친다.** 새로 고치면 멀쩡해진다.
   *
   * 배포본을 폰 폭으로 줄여 보다가 찾았다. 1280 에서 열어 375 로 줄이면 **일곱 쌍**이
   * 겹쳤고, 그중 다섯이 **용액병끼리**였다 — 준비물 쪽에 「색은 다 같으니 이름표를 보고
   * 고릅니다」라고 적어 둔 실험이라, 이름표가 겹치면 어느 병인지 알 방법이 없어진다.
   *
   * `window` 의 resize 가 아니라 실험대 자체를 본다. 좁은 화면에서 노트가 아래로 내려가면
   * 창 크기가 그대로여도 실험대 폭이 바뀐다.
   */
  const nameObserver = typeof ResizeObserver === 'undefined' ? null
    : new ResizeObserver(() => layoutNames());
  nameObserver?.observe(layer);

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
      unmountBtn.textContent = UI.bench.unmount(UI.slideShort[st.microscope.stage]);
    }
  }

  // 드래그 도중에는 다시 그리지 않는다. TICK 처럼 사용자와 무관하게 들어오는 상태 변경이
  // DOM 을 새로 만들면 setPointerCapture 가 무효화돼 드래그가 조용히 끊긴다.
  // 드래그가 끝나면 onPointerUp 이 최신 상태로 어차피 다시 그린다.
  store.subscribe(() => { renderBar(); renderLock(); if (!drag) renderTokens(); });
  renderTokens();
  renderBar();
  renderLock();
  renderEditPanel();
}
