import { defineConfig } from 'vite';

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
      },
      output: { manualChunks: undefined }
    }
  },
  server: { port: 5173, open: false }
});
