/**
 * 자(ruler) 애셋 — 라인 + 플랫 구현.
 *
 * 투명한 플라스틱 자. 눈금이 얹히는 자리만 반투명이 아니라 **뿌연 띠**(paper)로 두어
 * 눈금선이 밑에 놓인 물건과 겹쳐도 읽히게 했다 — 실제 자도 눈금 부분만 무광이다.
 *
 * 눈금은 **1 mm 간격**이고, 5 mm 마다 조금 길게, 10 mm 마다 길게 그리고 그 자리에만
 * **cm 숫자**를 적는다. 숫자는 눈금 숫자뿐이다 — **결과 수치를 미리 말하는 글자는 넣지 않는다.**
 * 적혈구층 길이도, 헤마토크릿도 이 그림이 먼저 말하지 않는다. 재는 것은 학생이 한다.
 *
 * docs/01-art-direction.md 및 docs/02-asset-contract.md 규칙을 준수합니다.
 */

import { PALETTE, INK, STROKE, GROUND_SHADOW, PATH_ATTRS, paint } from '../style/tokens.js';

export const NODES = ['#body', '#body-shade', '#ticks'];

const SVG_NS = 'http://www.w3.org/2000/svg';

/** 눈금 기하 — 1 mm 당 2.2 단위. 0 mm 가 x=34 에 온다. */
const TICK = {
  // 마지막 숫자(15)가 무광 띠 안에 들어오도록 잡은 값이다. 띠는 x 26~366.
  x0: 32,
  pitchMm: 2.15,
  mmCount: 150,   // 자의 눈금 범위 (mm)
  top: 118,
  minorLen: 6,
  midLen: 12,
  majorLen: 20,
  numberY: 152,
};

/**
 * 눈금 하나하나의 좌표. 순수 함수라 렌더러와 갱신이 같은 그림을 만든다.
 * 난수를 쓰지 않는다 — 자의 눈금은 결정론적이어야 한다.
 */
export function tickShapes() {
  const out = [];
  for (let mm = 0; mm <= TICK.mmCount; mm++) {
    const x = +(TICK.x0 + mm * TICK.pitchMm).toFixed(2);
    const major = mm % 10 === 0;
    const mid = !major && mm % 5 === 0;
    out.push({
      x,
      y1: TICK.top,
      y2: TICK.top + (major ? TICK.majorLen : mid ? TICK.midLen : TICK.minorLen),
      width: major ? STROKE.detail : STROKE.hair,
      label: major ? String(mm / 10) : null,
    });
  }
  return out;
}

function tickMarkup() {
  return tickShapes()
    .map((t) => {
      const line = `    <line x1="${t.x}" y1="${t.y1}" x2="${t.x}" y2="${t.y2}" stroke="${INK}" stroke-width="${t.width}" ${PATH_ATTRS}/>`;
      if (!t.label) return line;
      return `${line}\n    <text x="${t.x}" y="${TICK.numberY}" font-size="11" text-anchor="middle" fill="${INK}">${t.label}</text>`;
    })
    .join('\n');
}

/**
 * 자 SVG 문자열 렌더링
 *
 * @param {object} _state  자는 상태가 없다.
 */
export function render(_state = {}) {
  return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" data-asset="ruler">
  <!-- 접지 그림자 -->
  <ellipse cx="200" cy="196" rx="180" ry="9" fill="${GROUND_SHADOW.fill}" opacity="${GROUND_SHADOW.opacity}"/>

  <!-- 자 몸통 -->
  <g id="body">
    <rect x="18" y="110" width="364" height="80" rx="8" ${paint('glass')}/>
    <!-- 눈금이 얹히는 무광 띠 -->
    <rect x="26" y="116" width="340" height="44" rx="3" ${paint('paper', { stroke: 'detail' })}/>
    <!-- 자 가운데 홈 -->
    <line x1="30" y1="174" x2="370" y2="174" stroke="${INK}" stroke-width="${STROKE.hair}" ${PATH_ATTRS}/>
  </g>

  <!-- 몸통 우측 · 하단 음영 (광원 좌상단 45°) -->
  <path id="body-shade" d="M 18,178 L 366,178 L 366,110 L 372,110 Q 382,110 382,120 L 382,180 Q 382,190 372,190 L 28,190 Q 18,190 18,180 Z" fill="${PALETTE.glass[1]}"/>

  <!-- mm 눈금. 10 mm 마다 cm 숫자를 적는다 — 적는 숫자는 눈금뿐이다. -->
  <g id="ticks">
${tickMarkup()}
  </g>
</svg>`;
}

/**
 * 이미 DOM에 렌더링된 SVG를 상태에 맞게 갱신합니다.
 *
 * 자에는 상태가 없어서 평소에는 할 일이 없다. 계약이 `#ticks` 의 children 을 열어 둔 것은
 * 나중에 눈금 범위를 바꿔 끼울 여지를 남긴 것이라, 여기서도 노드로 다시 쌓는다.
 * 문자열(`innerHTML`)을 밀어 넣지 않는다.
 */
export function applyState(root, _state = {}) {
  const g = root.querySelector('#ticks');
  if (!g || g.childElementCount > 0) return;
  const doc = g.ownerDocument ?? document;
  for (const t of tickShapes()) {
    const line = doc.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(t.x));
    line.setAttribute('y1', String(t.y1));
    line.setAttribute('x2', String(t.x));
    line.setAttribute('y2', String(t.y2));
    line.setAttribute('stroke', INK);
    line.setAttribute('stroke-width', String(t.width));
    line.setAttribute('stroke-linejoin', 'round');
    line.setAttribute('stroke-linecap', 'round');
    g.appendChild(line);
    if (!t.label) continue;
    const text = doc.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', String(t.x));
    text.setAttribute('y', String(TICK.numberY));
    text.setAttribute('font-size', '11');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', INK);
    text.textContent = t.label;
    g.appendChild(text);
  }
}
