import { defineConfig } from 'vite';
import { DEV_PORT, PREVIEW_PORT } from './dev-port.js';

export default defineConfig({
  // 학교 네트워크에서 단일 파일로 배포해야 하는 경우가 있어 청크를 쪼개지 않는다.
  build: {
    target: 'es2022',
    rollupOptions: {
      // 개인정보처리방침은 앱과 따로 도는 정적 문서다. 자바스크립트가 필요 없으므로
      // 진입점으로만 넣어 둔다 (harness.html 은 개발용이라 배포본에 넣지 않는다).
      input: {
        main: 'index.html',
        privacy: 'privacy.html',
        // 선생님이 수업을 열고 제출물을 받는 화면. 학생 앱과 코드를 나눠 쓴다.
        teacher: 'teacher.html',
      },
      output: { manualChunks: undefined }
    }
  },
  // strictPort 인 이유는 dev-port.js 에 적어 두었다 — 밀려나느니 안 뜨는 편이 낫다.
  server: { port: DEV_PORT, strictPort: true, open: false },
  preview: { port: PREVIEW_PORT, strictPort: true, open: false }
});
