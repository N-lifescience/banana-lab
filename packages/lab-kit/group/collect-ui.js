/**
 * 모둠장 — 「기록 모으기」 창.
 *
 * 카메라 영상에서 QR 조각을 읽어(`jsQR`) `createCollector()` 에 넣고, 기록 하나가 다 모이면
 * `groupStore.addMember()` 한다. 카메라가 안 되면 「코드 붙여넣기」 — 같은 조각을 글로 받는다.
 *
 * ── jsQR 은 누를 때만 내려받는다 ─────────────────────────────────────
 * 해독기가 본 번들의 몇 배다. 모둠장이 「모으기」를 누르는 순간에만 `import()` 한다 —
 * 모둠원과 혼자 하는 학생은 한 바이트도 안 받는다. (AGENTS.md §3.3 — 사장님 승인, 2026-09-05)
 *
 * ── 카메라 권한 ──────────────────────────────────────────────────────
 * `vercel.json` 의 `Permissions-Policy` 가 `camera=(self)` 여야 한다. `camera=()` 면
 * 브라우저가 묻지도 않고 거절한다 — 그 경우 아래 붙여넣기 길이 남는다.
 *
 * 영상은 화면에만 그린다. 어디에도 저장하지 않고, 창을 닫으면 카메라를 끈다.
 */

import { createCollector } from './codec.js';
import { G } from './strings.js';

const SCAN_MS = 120;

/**
 * @param {HTMLElement} host
 * @param {ReturnType<import('./store.js').createGroupStore>} groupStore
 * @param {{exp?:string}} opts  실험 이름 — 다른 실험의 기록을 걸러 낸다
 */
export async function openCollectDialog(host, groupStore, { exp } = {}) {
  host.querySelector('#group-collect')?.remove();
  const dialog = document.createElement('dialog');
  dialog.id = 'group-collect';
  dialog.className = 'report-dialog group-dialog';
  dialog.setAttribute('aria-labelledby', 'group-collect-title');
  dialog.innerHTML = `
    <h2 id="group-collect-title">${G.collectTitle}</h2>
    <p class="rp-privacy">${G.collectLead}</p>
    <div class="group-cam">
      <video id="group-video" playsinline muted autoplay></video>
      <canvas id="group-canvas" hidden></canvas>
    </div>
    <p class="group-status" id="group-status" aria-live="polite">${G.cameraStarting}</p>
    <ul class="group-got" id="group-got"></ul>
    <details class="group-code">
      <summary>${G.pasteLabel}</summary>
      <textarea class="group-code-text" id="group-paste" rows="4" placeholder="${G.pastePlaceholder}"></textarea>
      <div class="rp-actions"><button type="button" id="group-paste-add">${G.pasteAdd}</button></div>
    </details>
    <div class="rp-actions">
      <button type="button" id="group-collect-close">${G.done}</button>
    </div>`;
  host.appendChild(dialog);

  const video = dialog.querySelector('#group-video');
  const canvas = dialog.querySelector('#group-canvas');
  const status = dialog.querySelector('#group-status');
  const gotEl = dialog.querySelector('#group-got');
  const collector = createCollector();

  function paintGot() {
    const want = groupStore.expected();
    const ms = groupStore.members();
    gotEl.innerHTML = ms.map((m) => `<li>${esc(m.nick)}</li>`).join('');
    if (ms.length) gotEl.insertAdjacentHTML('afterbegin', `<li class="group-got-head">${G.collected(ms.length, want)}</li>`);
  }
  paintGot();

  let lastText = '';
  let busy = false;
  async function take(text) {
    if (busy || !text || text === lastText) return;
    busy = true;
    try {
      const r = await collector.add(text);
      if (!r) { status.textContent = G.badShape; return; }
      lastText = text;
      if (!r.done) { status.textContent = G.partial(r.got, r.total); return; }
      const res = groupStore.addMember(r.record, { exp });
      if (!res.ok) {
        status.textContent = res.reason === 'exp' ? G.wrongExp(res.exp) : G.badShape;
        return;
      }
      status.textContent = G.gotOne(res.nick, res.replaced);
      paintGot();
    } catch {
      status.textContent = G.badShape;
    } finally {
      busy = false;
    }
  }

  /* 붙여넣기 — 카메라와 같은 통로로 들어간다 */
  dialog.querySelector('#group-paste-add').addEventListener('click', async () => {
    const ta = dialog.querySelector('#group-paste');
    const r = await collector.addText(ta.value);
    if (!r) { status.textContent = G.pasteNothing; return; }
    if (!r.done) { status.textContent = G.partial(r.got, r.total); return; }
    const res = groupStore.addMember(r.record, { exp });
    status.textContent = res.ok ? G.gotOne(res.nick, res.replaced)
      : res.reason === 'exp' ? G.wrongExp(res.exp) : G.badShape;
    if (res.ok) { ta.value = ''; paintGot(); }
  });

  /* 카메라 */
  let stream = null;
  let timer = null;
  async function startCamera() {
    let jsQR;
    try {
      ({ default: jsQR } = await import('jsqr'));
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch {
      status.textContent = G.cameraDenied;
      dialog.querySelector('.group-code').open = true;
      return;
    }
    video.srcObject = stream;
    await video.play().catch(() => {});
    status.textContent = G.scanning;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    timer = setInterval(() => {
      if (!video.videoWidth) return;
      // 가운데 정사각형만 본다 — 해독이 빨라지고 QR 을 가운데 두게 된다
      const side = Math.min(video.videoWidth, video.videoHeight);
      const sx = (video.videoWidth - side) / 2;
      const sy = (video.videoHeight - side) / 2;
      const out = Math.min(side, 640);
      canvas.width = out;
      canvas.height = out;
      ctx.drawImage(video, sx, sy, side, side, 0, 0, out, out);
      const img = ctx.getImageData(0, 0, out, out);
      const hit = jsQR(img.data, out, out, { inversionAttempts: 'dontInvert' });
      if (hit?.data) take(hit.data);
    }, SCAN_MS);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  function close() {
    stop();
    if (dialog.open) dialog.close();
    dialog.remove();
  }
  dialog.querySelector('#group-collect-close').addEventListener('click', close);
  dialog.addEventListener('close', () => { stop(); dialog.remove(); });
  dialog.showModal();
  startCamera();
  return { close };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
