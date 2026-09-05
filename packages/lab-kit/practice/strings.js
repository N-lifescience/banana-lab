/**
 * 용도 고르기와 「실제 실험 연습」 모드의 문구. **여덟 실험이 같이 쓴다.**
 */
export const P = {
  /* 시작 화면 1쪽 */
  purposeLead: '무엇을 하려고 하나요?',
  purposeLabel: '용도',
  virtual: {
    name: '가상 실험실 모드',
    desc: '이 화면에서 실험을 끝까지 하고 탐구 보고서까지 씁니다. 단계와 혼자/모둠을 고릅니다.',
  },
  practice: {
    name: '실제 실험 연습용 모드',
    desc: '실제 실험 전에 절차를 미리 해 봅니다. 다음에 할 일을 세세히 짚어 주고, 잘 안 된 것을 모아 「피드백 노트」로 저장합니다.',
  },
  stepOf: (i, n) => `${i} / ${n}`,
  stepLocked: '모둠 짜기',
  next: '다음',
  back: '이전',

  /* 노트 머리의 연습 칸 */
  badge: '실제 실험 연습',
  hint: '잘 안 된 조작이 여기에 쌓입니다. 실험을 마치면 「피드백 노트 PDF」를 저장해 실제 실험 때 옆에 두세요.',
  none: '아직 잘 안 된 것이 없습니다',
  count: (n) => `잘 안 된 것 ${n}가지`,
  times: (n) => (n > 1 ? `×${n}` : ''),
  noteButton: '피드백 노트 PDF',
  more: (n) => `… 외 ${n}가지 (노트에 다 실립니다)`,

  /* 피드백 노트 대화상자 · 종이 */
  dialogTitle: '피드백 노트 만들기',
  dialogLead: '연습에서 잘 안 된 것과 「다음엔 이렇게」를 한 장으로 만듭니다. 이름은 적어도 되고 안 적어도 됩니다 — 이 화면에서만 쓰고 저장하지 않습니다.',
  ownLabel: '실제 실험에서 내가 꼭 지킬 것 (직접 적기)',
  ownPlaceholder: '예: 용액은 두 방울만. 덮개 유리는 45°로 천천히.',
  make: 'PDF로 저장하기',
  cancel: '취소',
  sheetTitle: (app) => `실제 실험 전 피드백 노트 — ${app}`,
  sectionEvents: '연습에서 잘 안 된 것',
  sectionChecklist: '실제 실험에서 이렇게',
  sectionOwn: '내가 꼭 지킬 것',
  headWhat: '무엇이',
  headTimes: '횟수',
  headNext: '다음엔 이렇게',
  eventsNone: '잘 안 된 조작이 없었습니다. 실제 실험에서도 같은 순서로 하면 됩니다.',
  ownNone: '(적지 않았습니다)',
  dateLabel: '날짜',
  fileName: (app, who) => (who ? `피드백노트_${app}(${who})` : `피드백노트_${app}`),
  fields: [
    { key: 'school', label: '학교', placeholder: '예: ○○고등학교', width: 'wide' },
    { key: 'grade', label: '학년', placeholder: '예: 2' },
    { key: 'classNo', label: '반', placeholder: '예: 4' },
    { key: 'number', label: '번호', placeholder: '예: 17' },
    { key: 'name', label: '이름', placeholder: '예: 홍길동', width: 'wide' },
  ],
};
