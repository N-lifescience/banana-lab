# T08 — 서술형 채점

## 목표
`pass` / `more` / `unavailable` 셋. **틀렸다는 판정은 없다.**
비용은 비대칭이다 — 맞는 답을 부족하다고 하는 쪽이 훨씬 비싸다.

## 지킬 것
- **소재**로 본다. 길이는 공백 뺀 글자 수로 잰다
- 「왜냐하면」 같은 깊이 단어는 힌트일 뿐 판정 근거로 쓰지 않는다
- **빈칸에 첨삭을 띄우지 않는다**

## 검증
```bash
node scripts/check-grading.mjs      # 바깥에서 던지는 문장
node --test tests/grading.holdout.test.js
```
