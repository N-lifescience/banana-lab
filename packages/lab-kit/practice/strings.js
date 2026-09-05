/**
 * 용도 고르기와 「실제 실험 연습」 모드의 문구. **여덟 실험이 같이 쓴다.**
 */
export const P = {
  /* 시작 화면 1쪽 */
  purposeLead: '오늘은 어떻게 할까요?',
  purposeLabel: '용도',
  virtual: {
    name: '탐구 실험',
    desc: '가상 실험을 처음부터 끝까지 하고 탐구 보고서까지 씁니다. 난이도를 고르고, 혼자 또는 모둠으로 합니다.',
  },
  practice: {
    name: '실험 리허설',
    desc: '실제 실험을 하기 전에 절차를 미리 연습합니다. 할 일을 하나씩 짚어 주고, 잘 안 된 것을 모아 피드백 노트로 남깁니다.',
  },
  /*
   * 선생님 화면 (T37) — 여기서도 **용도를 먼저 고른다.** 학생 화면 1쪽과 같은 두 카드다.
   * 문구를 여기 두는 이유: 용도는 실험의 사정이 아니라 **수업의 사정**이라 여덟이 같다.
   */
  teacher: {
    purposeHint: '무엇에 쓸 링크인가요? 학생은 이 링크로 <b>그 모드에서 바로</b> 시작합니다.',
    practiceLocked: '리허설은 <b>1단계 안내 · 혼자</b>로 열립니다 — 난이도와 혼자/모둠은 고르지 않습니다.',
    practiceQrHint: '칠판에 띄우거나 인쇄해 붙이세요. 카메라로 찍으면 리허설이 바로 시작됩니다.',
    formLead: '<b>실제 실험용 보고서 양식</b> — 이 실험에 맞춘 A4 두 쪽입니다. 준비물 ☐ 목록과 결과 칸이 이 실험 것이라 그대로 인쇄해 나눠 주시면 됩니다.',
    formButton: '이 실험의 양식 PDF 내려받기',
    practiceCollect: '<b>피드백 노트 받는 법:</b> 학생이 「피드백 노트 PDF」 → 인쇄 창에서 「PDF 로 저장」 → '
      + '과제방이나 메신저로 냅니다. 리허설에는 탐구 보고서가 없습니다 — '
      + '<b>실제 실험 때 옆에 두는 한 장</b>입니다.',
  },

  stepOf: (i, n) => `${i} / ${n}`,
  stepLocked: '모둠 짜기',
  next: '다음',
  back: '이전',

  /* 노트 머리의 연습 칸 */
  badge: '실험 리허설',
  hint: '리허설에서 잘 안 된 조작이 여기에 쌓입니다. 다 해 보고 나면 「피드백 노트 PDF」를 저장해 실제 실험 때 옆에 두세요.',
  none: '아직 잘 안 된 것이 없습니다',
  count: (n) => `잘 안 된 것 ${n}가지`,
  times: (n) => (n > 1 ? `×${n}` : ''),
  noteButton: '피드백 노트 PDF',
  /*
   * 실제 실험용 양식 (T39) — **리허설 다음에 오는 것**이라 이 칸에 있다.
   * 여기서 미리 받아 두면, 실험실에 갈 때 손에 종이가 있다.
   */
  formLink: '실제 실험용 보고서 양식 PDF',
  formLinkTitle: '이 실험에 맞춘 A4 두 쪽짜리 양식입니다. 인쇄해 실험실에 들고 가세요.',
  more: (n) => `… 외 ${n}가지 (노트에 다 실립니다)`,

  /* 피드백 노트 대화상자 · 종이 */
  dialogTitle: '피드백 노트 만들기',
  dialogLead: '리허설에서 잘 안 된 것과 「다음엔 이렇게」를 한 장으로 만듭니다. 이름은 적어도 되고 안 적어도 됩니다 — 이 화면에서만 쓰고 저장하지 않습니다.',
  ownLabel: '실제 실험에서 내가 꼭 지킬 것 (직접 적기)',
  ownPlaceholder: '예: 용액은 두 방울만. 덮개 유리는 45°로 천천히.',
  make: 'PDF로 저장하기',
  cancel: '취소',
  sheetTitle: (app) => `실험 리허설 피드백 노트 — ${app}`,
  sectionEvents: '리허설에서 잘 안 된 것',
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
