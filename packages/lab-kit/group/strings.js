/**
 * 모둠 기능의 문구. **여덟 실험이 같이 쓴다** — 모둠을 짜고 기록을 옮기는 일에
 * 실험의 사정이 들어갈 자리가 없다 (`start.js` 와 같은 이유).
 */
export const G = {
  /* 시작 화면 — 모둠 짜기 */
  setupHeading: '모둠을 짜요',
  setupLead: '모둠원 각자 자기 기기에서 같은 모둠명으로 시작합니다. 이름·학번은 적지 않습니다 — 별명만요.',
  nameLabel: '모둠명',
  namePlaceholder: '예: 바나나조',
  sizeLabel: '모둠원 수 (나 포함)',
  roleLabel: '나는',
  roles: [
    { id: 'leader', name: '모둠장', desc: '모둠원의 기록을 내 기기에 모아 정리하고 PDF 를 만듭니다.' },
    { id: 'member', name: '모둠원', desc: '내 기기에서 실험하고 기록을 모둠장에게 QR 로 보냅니다.' },
  ],
  nickLabel: '내 별명',
  nickPlaceholder: '예: 초록이 (이름·학번 ✕)',
  nickFallback: '모둠원',

  /* 탐구 노트 머리의 모둠 칸 */
  panelTitle: (name) => (name ? `모둠 「${name}」` : '모둠'),
  roleBadge: { leader: '모둠장', member: '모둠원' },
  nickLine: (nick) => `별명 ${nick}`,
  collected: (got, want) => `모인 기록 ${got}/${want}`,
  collectedNone: '아직 모인 기록이 없습니다',
  sendButton: '기록 보내기 (QR)',
  collectButton: '기록 모으기 (카메라)',
  pasteButton: '코드 붙여넣기',
  memberHint: '어느 정도 적었으면 「기록 보내기」를 눌러 모둠장 기기에 QR 을 보여 주세요. 고쳐 쓰고 다시 보내도 됩니다.',
  leaderHint: '모둠원 기기의 QR 을 읽으면 이 노트의 칸마다 모둠원 기록이 붙습니다. 토의하고, 이 노트를 모둠의 정리로 고쳐 쓴 뒤 PDF 를 만드세요.',
  removeMember: '빼기',
  removeLabel: (nick) => `${nick} 의 기록을 뺍니다`,

  /* 칸마다 붙는 모둠원 기록 */
  entriesHeading: '모둠원 기록',
  fillDraft: '초안 채우기',
  fillDraftTitle: '모둠원 문장을 합쳐 이 칸에 넣습니다. 같은 문장은 하나만, 여럿이 쓴 문장부터.',
  fillConfirm: '이 칸에 이미 쓴 글이 있습니다. 합친 초안으로 바꿀까요?',
  agreeMark: (n) => `같은 말 ${n}문장`,

  /* 보내기 대화상자 */
  sendTitle: '기록 보내기',
  sendLead: (n) => (n > 1
    ? `QR ${n}장이 차례로 넘어갑니다. 모둠장 기기의 카메라에 이 화면을 계속 보여 주세요.`
    : 'QR 한 장입니다. 모둠장 기기의 카메라에 이 화면을 보여 주세요.'),
  frameOf: (i, n) => `${i} / ${n}`,
  copyCode: '코드 복사',
  copied: '복사했습니다 — 모둠장에게 메시지로 보내 「코드 붙여넣기」에 넣으면 됩니다',
  copyFailed: '복사가 안 됩니다. 아래 글을 길게 눌러 직접 복사하세요',
  close: '닫기',
  sendEmpty: '아직 적은 것이 없습니다. 그래도 보낼 수는 있습니다.',

  /* 모으기 대화상자 */
  collectTitle: '기록 모으기',
  collectLead: '모둠원 기기의 QR 을 카메라에 비추세요. 여러 장이면 넘어가는 대로 다 읽을 때까지 기다립니다.',
  cameraStarting: '카메라를 켜는 중…',
  cameraDenied: '카메라를 쓸 수 없습니다. 모둠원이 「코드 복사」한 것을 아래에 붙여 넣어도 됩니다.',
  scanning: '읽는 중…',
  partial: (got, total) => `조각 ${got}/${total} — 계속 비추세요`,
  gotOne: (nick, replaced) => (replaced ? `${nick} 의 기록을 새것으로 바꿨습니다` : `${nick} 의 기록을 담았습니다`),
  wrongExp: (exp) => `다른 실험(${exp})의 기록이라 담지 않았습니다`,
  badShape: '기록 모양이 아닙니다',
  pasteLabel: '카메라가 없으면 — 코드를 붙여 넣기',
  pastePlaceholder: 'VB1. 로 시작하는 줄들을 붙여 넣으세요',
  pasteAdd: '담기',
  pasteNothing: '기록 조각을 찾지 못했습니다',
  done: '다 됐어요',
};
