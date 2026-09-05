/**
 * 모둠원 — 「기록 보내기」 창.
 *
 * 기록을 조각내(`codec.js`) QR 로 그린다. 조각이 여럿이면 **한 장씩 자동으로 넘긴다** —
 * 모둠장 기기는 읽히는 대로 주워 담으므로(`collect-ui.js`) 순서도, 몇 바퀴 도는지도 상관없다.
 * 「코드 복사」는 카메라가 없는 기기용 예비 길이다 — 같은 조각들을 줄바꿈으로 이어 붙인 글.
 *
 * 화면에 그리는 것 말고는 아무 데도 안 보낸다. 창을 닫으면 조각도 버린다.
 */

import { qrSVG } from '../ui/qr.js';
import { packRecord } from './codec.js';
import { G } from './strings.js';

/** 한 장을 얼마나 보여 주는가. 폰 카메라가 초점을 잡고 두어 프레임 읽을 시간. */
const FRAME_MS = 900;

/**
 * @param {HTMLElement} host  대화상자를 붙일 곳 (실험의 `#group-dialogs` 같은 빈 상자)
 * @param {object} record     `recordOf()` 가 만든 기록
 */
export async function openSendDialog(host, record) {
  host.querySelector('#group-send')?.remove();
  const chunks = await packRecord(record);
  const svgs = chunks.map((c) => qrSVG(c, { size: 420, quiet: 4 }));
  const empty = Object.keys(record.notes ?? {}).length === 0;

  const dialog = document.createElement('dialog');
  dialog.id = 'group-send';
  dialog.className = 'report-dialog group-dialog';
  dialog.setAttribute('aria-labelledby', 'group-send-title');
  dialog.innerHTML = `
    <h2 id="group-send-title">${G.sendTitle}</h2>
    <p class="rp-privacy">${G.sendLead(chunks.length)}${empty ? ` ${G.sendEmpty}` : ''}</p>
    <div class="group-qr" id="group-qr" aria-live="off"></div>
    <p class="group-frame" id="group-frame"></p>
    <details class="group-code">
      <summary>${G.copyCode}</summary>
      <p class="group-code-msg" id="group-code-msg"></p>
      <textarea class="group-code-text" id="group-code-text" readonly rows="4"></textarea>
    </details>
    <div class="rp-actions">
      <button type="button" id="group-send-close">${G.close}</button>
    </div>`;
  host.appendChild(dialog);

  const qrEl = dialog.querySelector('#group-qr');
  const frameEl = dialog.querySelector('#group-frame');
  const codeText = dialog.querySelector('#group-code-text');
  const codeMsg = dialog.querySelector('#group-code-msg');
  codeText.value = chunks.join('\n');

  let at = 0;
  function show() {
    qrEl.innerHTML = svgs[at];
    frameEl.textContent = chunks.length > 1 ? G.frameOf(at + 1, chunks.length) : '';
    at = (at + 1) % chunks.length;
  }
  show();
  const timer = chunks.length > 1 ? setInterval(show, FRAME_MS) : null;

  dialog.querySelector('.group-code > summary').addEventListener('click', async () => {
    // 펼치는 김에 복사까지 한다. 안 되면 글이 그대로 있으니 손으로 복사한다.
    try {
      await navigator.clipboard.writeText(codeText.value);
      codeMsg.textContent = G.copied;
    } catch {
      codeMsg.textContent = G.copyFailed;
    }
  });

  function close() {
    if (timer) clearInterval(timer);
    dialog.close();
    dialog.remove();
  }
  dialog.querySelector('#group-send-close').addEventListener('click', close);
  dialog.addEventListener('close', () => { if (timer) clearInterval(timer); dialog.remove(); });
  dialog.showModal();
  return { close };
}
