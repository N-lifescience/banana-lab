/**
 * 실제 실험용 **탐구 보고서 양식**의 틀. 아홉 장(실험 여덟 + 공용)이 이 하나에서 나온다.
 *
 * ── 왜 틀 하나인가 ─────────────────────────────────────────────────
 * 종이가 실험마다 다른 모양이면, 한 학기에 여덟 번 「이번엔 어디에 뭘 쓰지」를 다시 배운다.
 * `docs/09-uniformity.md` 가 화면에 대해 말하는 것과 같은 이유다 — **틀은 하나, 칸의 내용만
 * 실험 것.** 그래서 여기서 정하는 것은 차례와 생김새뿐이고, 무엇을 묻고 무엇을 재는지는
 * 실험의 `src/forms/spec.js` 가 정한다.
 *
 * ── 준비물은 **베껴 적지 않는다** ───────────────────────────────────
 * 그 실험의 `UI.notebook.materials` 를 그대로 읽어 ☐ 목록으로 만든다. 손으로 옮겨 적으면
 * 화면의 기구가 바뀌었을 때 종이만 옛것으로 남는다 — 그 어긋남은 아무도 못 본다.
 */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 손으로 쓰는 줄. 칸 수가 「이만큼 쓰라」는 말이 된다. */
const lines = (n, cls = '') => `<div class="lines ${cls}">${'<div></div>'.repeat(n)}</div>`;

const numbered = (n) => `<ol class="num">${'<li></li>'.repeat(n)}</ol>`;

/** 결과 칸의 생김새. 실험이 **무엇을 재는가**가 여기서 갈린다. */
function resultBlock(b) {
  switch (b.kind) {
    /* 표 — 조건과 측정값이 여러 줄인 실험 */
    case 'table': {
      const cols = b.head.map((h, i) => `<th${b.widths?.[i] ? ` style="width:${b.widths[i]}"` : ''}>${esc(h)}</th>`).join('');
      /*
       * `rowLabels` — 첫 칸이 **이미 정해져 있는** 표. 슬라이드 (가)(나)(다)나 모세관의 층처럼
       * 학생이 정할 것이 아니라 실험이 정한 것이면 미리 적어 준다. 빈칸으로 두면 학생마다
       * 다른 이름을 붙여, 모둠끼리 견줄 수 없다.
       */
      const rows = b.rowLabels
        ? b.rowLabels.map((l) => `<tr><td>${esc(l)}</td>${b.head.slice(1).map(() => '<td></td>').join('')}</tr>`).join('')
        : `<tr>${b.head.map(() => '<td></td>').join('')}</tr>`.repeat(b.rows);
      return `<table><tr>${cols}</tr>${rows}</table>`;
    }
    /* 시야 — 현미경을 쓰는 실험. 시야는 원이다 */
    case 'sketch':
      return `<div class="draw" style="grid-template-columns:repeat(${b.items.length},1fr)">${b.items.map((it) => `
        <figure>
          <div class="circle"></div>
          <figcaption>${esc(it)}${b.labels.map((l) => `<span>${esc(l)}</span><span class="u"></span>`).join('')}</figcaption>
        </figure>`).join('')}</div>`;
    /*
     * 네모 칸 — 모세관·크로마토그램처럼 원이 아닌 것을 그린다.
     * **칸의 비율이 실물을 닮아야 한다.** 크로마토그램은 길쭉하게 서 있고 모세관은 누워 있는데
     * 둘 다 같은 가로 칸에 그리게 하면, 학생이 종이에 맞춰 실물을 왜곡해 그린다.
     */
    case 'box':
      return `<div class="draw" style="grid-template-columns:repeat(${b.items.length},1fr)">${b.items.map((it) => `
        <figure>
          <div class="rect" style="height:${b.height}${b.width ? `;width:${b.width}` : ''}"></div>
          <figcaption><span>${esc(it)}</span></figcaption>
        </figure>`).join('')}</div>`;
    /*
     * 모눈 — 시간에 따라 달라지는 것을 그리는 실험.
     * **축 이름을 세워 쓰지 않는다.** 한글을 90° 로 돌리면 글자마다 누워 읽기가 나쁘다.
     * 눈금 숫자는 긋지 않는다 — 무엇을 얼마 간격으로 잡을지는 학생이 정할 일이다.
     */
    case 'graph':
      return `<div class="graph">
        <p class="gaxis">세로 ↑ ${esc(b.y)}<span>가로 → ${esc(b.x)}</span></p>
        <div class="grid"></div>
      </div>`;
    /* 계산 — 잰 값을 넣어 구하는 것이 있는 실험 (눈금값 · 헤마토크릿 · Rf) */
    case 'calc':
      return `<div class="calc"><span class="calc-name">${esc(b.name)}</span>
        <span class="calc-form">${b.formula}</span></div>`;
    case 'lines':
      return lines(b.n);
    default:
      throw new Error(`모르는 결과 칸 종류: ${b.kind}`);
  }
}

/**
 * @param {object} spec   그 실험의 `src/forms/spec.js`
 * @param {object} [ctx]  { title, materials }  — 매니페스트와 화면 문구에서 온 것
 */
export function buildForm(spec, ctx = {}) {
  const title = ctx.title ?? spec.title ?? '';
  const mats = ctx.materials ?? [];
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${esc(title || '탐구 보고서')} — 탐구 보고서 양식</title>
<style>
  @page{size:A4;margin:13mm 12mm}
  *{box-sizing:border-box}
  body{
    margin:0;color:#000;background:#fff;
    font-family:"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,sans-serif;
    font-size:10.5pt;line-height:1.5;word-break:keep-all;
  }
  h1{font-size:15pt;margin:0}
  h2{font-size:11.5pt;margin:0 0 6px;padding-bottom:3px;border-bottom:1px solid #999;
    display:flex;align-items:baseline;gap:8px}
  h2 small{font-weight:400;font-size:9pt;color:#555}
  section{break-inside:avoid;margin-bottom:9px}

  .head{border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px}
  .head-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .head-top .from{font-size:8.5pt;color:#555;text-align:right;line-height:1.4;white-space:nowrap}
  .subject{font-size:10pt;color:#333;margin:3px 0 9px}
  .who{display:flex;flex-wrap:wrap;gap:5px 16px;font-size:10pt}
  .who span{display:flex;align-items:baseline;gap:6px}
  .who i{font-style:normal;color:#555}
  .who .u{display:inline-block;border-bottom:1px solid #666;min-width:52px;height:1.35em}
  .who .u.wide{min-width:92px}

  .hint{color:#555;font-size:9pt;margin:0 0 4px}
  .lines div{border-bottom:1px solid #bbb;height:6.8mm}
  .lines.tight div{height:6.2mm}
  .num{list-style:none;margin:0;padding:0;counter-reset:n}
  .num li{counter-increment:n;display:flex;gap:8px;align-items:flex-end;
    border-bottom:1px solid #bbb;height:6.8mm}
  .num li::before{content:counter(n) ".";color:#666;font-size:9.5pt;width:14px;flex:none}

  /* 준비물 — 그 실험이 실제로 쓰는 것 (화면의 준비물 표에서 그대로 옮겨 온다) */
  .mats{list-style:none;margin:0 0 7px;padding:0;display:grid;
    grid-template-columns:1fr 1fr 1fr;gap:0 14px}
  .mats li{font-size:9pt;padding:1px 0}
  .mats li::before{content:"☐ ";font-size:10.5pt}
  .check{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
  .check li{font-size:9.5pt;padding:1.5px 0}
  .check li::before{content:"☐ ";font-size:11pt}

  /* 설계 — 변인을 스스로 정하는 실험에만 나온다 */
  .design{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:7px}
  .design div{border:1px solid #666;border-radius:3px;padding:6px 8px}
  .design b{display:block;font-size:9.5pt;margin-bottom:3px}
  .design .u{display:block;border-bottom:1px solid #bbb;height:6.4mm}

  table{width:100%;border-collapse:collapse;font-size:9.5pt;margin-bottom:8px}
  th,td{border:1px solid #666;padding:0 4px;height:7.4mm}
  th{background:#eee;height:6.8mm;font-weight:600;font-size:9.5pt;text-align:center}

  .draw{display:grid;gap:9px;margin-bottom:8px}
  .draw figure{margin:0;border:1px solid #666;border-radius:3px;padding:6px}
  .draw .circle{border:1px solid #888;border-radius:50%;height:38mm;width:38mm;margin:2px auto 5px}
  .draw .rect{border:1px solid #888;border-radius:2px;margin:2px auto 5px;width:100%}
  .draw figcaption{font-size:8.5pt;color:#555;display:flex;gap:5px;align-items:baseline}
  .draw figcaption .u{flex:1;border-bottom:1px solid #666;height:1.3em}

  /* 모눈 — 눈금은 긋되 숫자는 학생이 정한다. 축 이름만 준다 */
  .graph{margin-bottom:8px}
  .graph .gaxis{margin:0 0 3px;font-size:8.5pt;color:#555;display:flex;justify-content:space-between}
  .graph .grid{height:44mm;border:1px solid #666;
    background-image:linear-gradient(#ddd 1px,transparent 1px),linear-gradient(90deg,#ddd 1px,transparent 1px);
    background-size:5mm 5mm}

  .calc{border:1px solid #666;border-radius:3px;padding:7px 9px;margin-bottom:8px;font-size:10pt}
  .calc-name{font-weight:600;margin-right:8px}
  .calc .u{display:inline-block;border-bottom:1px solid #666;min-width:52px;height:1.3em}

  .foot{margin-top:10px;border-top:1px solid #999;padding-top:6px;
    font-size:8.5pt;color:#444;line-height:1.5}
  .page2{break-before:page}
</style>
</head>
<body>

<header class="head">
  <div class="head-top">
    <h1>탐구 보고서</h1>
    <div class="from">가상 생명과학 실험실 · virtual-biolab.vercel.app<br>실제 실험용 양식 — 자유롭게 인쇄해 쓰세요</div>
  </div>
  <p class="subject">${esc(title)}${spec.subjectNote ? ` <span style="color:#666">· ${esc(spec.subjectNote)}</span>` : ''}</p>
  <div class="who">
    <span><i>학교</i><span class="u wide"></span></span>
    <span><i>학년</i><span class="u"></span></span>
    <span><i>반</i><span class="u"></span></span>
    <span><i>번호</i><span class="u"></span></span>
    <span><i>이름</i><span class="u wide"></span></span>
    <span><i>날짜</i><span class="u wide"></span></span>
    <span><i>모둠</i><span class="u wide"></span></span>
  </div>
</header>

<section>
  <h2>1. 문제 인식 <small>무엇을 알아보려고 하는가</small></h2>
  <p class="hint">${esc(spec.question)}</p>
  ${lines(2)}
</section>

<section>
  <h2>2. 준비물 <small>갖췄는지 짚어 보고, 안전 수칙을 확인한다</small></h2>
  ${mats.length ? `<ul class="mats">${mats.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : lines(2, 'tight')}
  <p class="hint">안전 — 지키기로 한 것에 표시하세요.</p>
  <ul class="check">${spec.safety.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
</section>

${spec.design ? `<section>
  <h2>3. 실험 설계 <small>무엇을 바꾸고, 무엇을 그대로 두고, 무엇을 잴 것인가</small></h2>
  <div class="design">
    <div><b>조작변인 (바꾸는 것)</b><span class="u"></span><span class="u"></span></div>
    <div><b>통제변인 (그대로 두는 것)</b><span class="u"></span><span class="u"></span></div>
    <div><b>종속변인 (재는 것)</b><span class="u"></span><span class="u"></span></div>
  </div>
  <p class="hint">${esc(spec.predictHint)}</p>
  ${lines(3)}
</section>` : `<section>
  <h2>3. 예상 <small>「…하면 …할 것이다」 · 그렇게 생각한 까닭</small></h2>
  <p class="hint">${esc(spec.predictHint)}</p>
  ${lines(3)}
</section>`}

<section>
  <h2>4. 탐구 과정 <small>한 일을 순서대로. 바꾼 것과 그대로 둔 것을 밝힌다</small></h2>
  ${numbered(spec.processLines ?? 7)}
</section>

<section class="page2">
  <h2>5. 결과 <small>본 것과 잰 것만 적는다. 까닭은 6번에</small></h2>
  ${spec.result.map(resultBlock).join('\n  ')}
</section>

<section>
  <h2>6. 정리 <small>예상과 견주어 보고, 그렇게 된 까닭을 쓴다</small></h2>
  ${spec.wrapup.map((q) => `<p class="hint">${esc(q)}</p>${lines(spec.wrapup.length >= 4 ? 1 : 2)}`).join('\n  ')}
</section>

<section>
  <h2>7. 자기 평가 <small>스스로 매기고, 다음에 고칠 것을 한 줄 적는다</small></h2>
  <table>
    <tr><th style="text-align:left">문항</th><th style="width:13%">잘함</th><th style="width:13%">보통</th><th style="width:13%">부족</th></tr>
    ${spec.selfEval.map((q) => `<tr><td>${esc(q)}</td><td></td><td></td><td></td></tr>`).join('\n    ')}
  </table>
  <p class="hint">다음에 고칠 것</p>
  ${lines(1)}
</section>

<p class="foot">
  실험 전에 <b>「실험 리허설」</b>을 해 보았다면, 그때 저장한 <b>피드백 노트</b>를 옆에 두고
  「다음엔 이렇게」에 표시한 것을 지켰는지 확인하며 쓰세요.<br>
  이 양식은 가상 생명과학 실험실(virtual-biolab.vercel.app)에서 받은 것입니다. 수업에서 자유롭게 인쇄·수정해 쓰실 수 있습니다.
</p>

</body>
</html>
`;
}
