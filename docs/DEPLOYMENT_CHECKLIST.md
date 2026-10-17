# 배포 점검 목록

작성: 2026-10-17. 아직 웹 앱을 배포하지 않았다. 처음 배포할 때와, 배포 방식이나 주소를 바꿀 때 이 목록을 위에서부터 확인한다.
운영 Supabase 프로젝트는 `lbqzmreoaedtpzcopgyn`(Golf Platform's Project, 도쿄)이다.

## 1. 배포 전에 설정할 것

### 환경변수

`NEXT_PUBLIC_`으로 시작하는 값은 **빌드할 때 앱 코드에 들어간다.** 배포 서비스에 먼저 넣고 빌드해야 하며, 바꾸면 다시 빌드해야 한다.

| 이름 | 필수 | 값 | 쓰는 곳 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 필수 | 운영 Supabase 프로젝트 주소 | 브라우저·서버의 Supabase 연결 (`utils/supabase/*`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 필수 | 운영 프로젝트의 publishable 키 | 같은 곳. 옛 이름 `NEXT_PUBLIC_SUPABASE_ANON_KEY`도 읽지만 새 이름을 쓴다 |
| `OPENAI_API_KEY` | 선택 | OpenAI API 키 | AI 연습 제안 (`app/api/practice-suggestions`). **아직 연결하지 않기로 했다.** 없으면 이 기능만 꺼진다 |
| `OPENAI_PRACTICE_MODEL` | 선택 | 모델 이름 | 비우면 코드의 기본값을 쓴다 |

- service role 키처럼 RLS를 건너뛰는 키는 **넣지 않는다.** 앱은 publishable 키와 사용자 토큰만 쓴다.
- 로컬 `.env.local`은 저장소에 올리지 않는다.

### Supabase 인증 주소

가입 확인 메일과 비밀번호 재설정 메일은 앱 주소(`window.location.origin`)로 돌아오고, 첫 화면(`/?code=...`)이 그 값을 스코어 탭으로 넘긴다.
Supabase 대시보드 → Authentication → URL Configuration에서:

- [ ] **Site URL**을 배포 주소(예: `https://도메인`)로 바꾼다. 지금은 개발 주소일 수 있다.
- [ ] **Redirect URLs**에 `https://도메인/**`를 추가한다. 미리보기 배포 주소를 쓰면 그 주소도 추가한다.
- [ ] 메일 링크를 열었을 때 다른 사이트(예: localhost)로 가지 않는지 아래 3번에서 확인한다.

### HTTPS

- [ ] 배포 주소가 **HTTPS**여야 한다. 서비스 워커(오프라인으로 열기)와 홈 화면 설치는 HTTPS에서만 동작한다.

## 2. 배포 직전 확인

- [ ] `main`의 CI(Round checks)가 통과했다. DB 테스트, 단위 테스트, 린트, 타입 검사, 빌드, 화면 테스트, 빌드 모드 오프라인 테스트가 모두 포함된다.
- [ ] 운영 DB 마이그레이션이 저장소와 같다. 2026-10-17 기준 둘 다 51개, 마지막은 `20261016220000_my_round_overview`.

  ```sql
  select count(*), max(version) from supabase_migrations.schema_migrations;
  ```

- [ ] 정기 정리 작업 4개가 켜져 있다(오류 기록·주문·AI 요청·탈퇴 기록 정리).

  ```sql
  select jobname, schedule, active from cron.job order by 1;
  ```

## 3. 배포한 뒤 실제 사이트에서 확인할 것

### 기본

- [ ] 첫 화면(`/`)이 스코어 탭으로 열린다.
- [ ] 보안 헤더가 붙는다. 아래 명령 결과에 `x-frame-options: DENY`, `content-security-policy: frame-ancestors 'none'`, `x-content-type-options: nosniff`, `referrer-policy`, `permissions-policy`가 있고 `x-powered-by`가 없다.

  ```bash
  curl -sI https://도메인/home
  ```

- [ ] `/sw.js`에 `cache-control: no-cache, no-store, must-revalidate`가 붙는다. 이 헤더가 없으면 새 배포 뒤에도 예전 서비스 워커가 남는다.

  ```bash
  curl -sI https://도메인/sw.js
  ```

### 로그인

- [ ] 새 이메일로 가입 → 확인 메일 링크 → 배포 주소로 돌아와 로그인된다.
- [ ] 비밀번호 재설정 메일 링크 → "새 비밀번호 설정" 창이 뜨고 바뀐다.
- [ ] 유출된 비밀번호(예: `password1234`)로 가입하면 앱이 막는다. 무료 요금제라 Supabase 대신 앱이 `api.pwnedpasswords.com`으로 확인한다.

### 라운드 기록

- [ ] 골프장 검색 → 코스·티 선택 → 라운드 시작 → 샷 입력 → 홀아웃 → 리포트 → 등록까지 된다.
- [ ] MY 탭의 요약(완료 라운드·평균·베스트)과 레벨·트로피가 뜬다. 입력 시간 기록이 없는 예전 기록은 레벨에 넣지 않는 것이 정상이다.

### 오프라인 (휴대폰)

- [ ] 연결된 상태로 스코어 탭을 한 번 연다(서비스 워커가 화면을 저장한다).
- [ ] 비행기 모드로 바꾸고 앱을 새로 연다 → 스코어 탭이 열리고 "인터넷 연결이 끊겼어요" 안내가 뜬다.
- [ ] 그 상태로 샷을 입력할 수 있다.
- [ ] 비행기 모드를 끄면 안내가 사라지고, 버튼을 누르지 않아도 기록이 서버에 저장된다(MY 탭이나 다른 기기에서 확인).
- [ ] 한 번도 열지 않은 화면을 오프라인에서 열면 "인터넷 연결이 없어요" 안내가 뜬다.

### 홈 화면 설치

- [ ] 안드로이드 Chrome: 메뉴 → "홈 화면에 추가"(또는 "앱 설치") → 웃는 골프공 아이콘으로 설치되고, 주소창 없이 스코어 탭에서 열린다. 상단 표시줄이 아이콘과 같은 짙은 초록(#054d27)이다.
- [ ] iPhone Safari: 공유 → "홈 화면에 추가" → 같은 아이콘과 "골프 비서" 이름으로 설치되고 주소창 없이 열린다. iPhone은 상단 표시줄 색을 앱이 정하지 못하고 기본 모양을 쓴다.

### 오류 보고

- [ ] 로그인한 상태에서 오류가 나면 서버에 남는지 확인한다. Supabase SQL Editor에서 `scripts/db/recent-client-errors.sql`을 실행한다. 이메일 같은 개인정보는 `[이메일]`로 가려져 있어야 한다. 기록은 30일 뒤 자동으로 지워진다.

## 4. 문제가 생겼을 때

- **새 배포인데 예전 화면이 보인다**: `public/sw.js`의 `VERSION`을 올려 다시 배포한다. 서비스 워커가 바뀌면 예전 저장본을 지운다.
- **서비스 워커를 완전히 끄고 싶다**: `components/layout/ServiceWorkerRegister.tsx`에서 등록을 빼고, 모든 저장본을 지우는 내용으로 `sw.js`를 한 번 배포한 뒤 등록 코드를 없앤다. 파일만 지우면 이미 설치된 기기에는 예전 워커가 남는다.
- **메일 링크가 엉뚱한 주소로 간다**: 1번의 Supabase Site URL·Redirect URLs를 다시 확인한다.
