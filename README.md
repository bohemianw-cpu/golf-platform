# Golf Secretary

라운드와 샷 데이터를 기기 간 동기화하고, 실제 입력값에 근거해 개인 분석과 연습 방향을 제공하는 Next.js 앱입니다.

## 실행과 검증

```bash
npm install
npm run dev
npx tsc --noEmit
npm run lint
npm run build
npm run test:e2e
```

`test:e2e`는 Chromium에서 라운드 입력·복구·등록 흐름을 클릭해 확인합니다. Supabase 응답은 브라우저에서 가로채어 제공하므로 실제 회원 데이터나 결제 내역을 변경하지 않습니다. 최초 실행 전 `npx playwright install chromium`이 필요합니다. GitHub Actions는 이 검사를 빌드와 함께 실행합니다.

`tests/db/`의 두 SQL 파일은 다른 회원의 기록 접근과 등록된 라운드의 수정·삭제 차단을 확인합니다. 기존 라운드와 샷이 있는 DB에서 각각 실행하며, 모든 검사 요청은 트랜잭션 끝에 롤백됩니다. 이 DB 검사는 독립 테스트 DB가 준비되기 전까지 CI에서 자동 실행하지 않습니다.

필수 환경변수는 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL` 및 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`입니다. 레거시 프로젝트는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`도 브라우저 클라이언트에서 지원합니다. 비밀 키(service role)는 브라우저 환경변수로 두지 마세요.

라운드 리포트의 AI 연습 제안에는 서버 전용 `OPENAI_API_KEY`가 필요합니다. `.env.local` 또는 배포 환경의 서버 변수에 추가하세요. 모델을 바꾸려면 `OPENAI_PRACTICE_MODEL`을 지정할 수 있으며 기본값은 `gpt-5-mini`입니다. 이 키를 `NEXT_PUBLIC_` 변수로 설정하지 마세요. 리포트를 열면 이번 라운드의 샷과 로그인 사용자의 최근 라운드 샷 기록을 AI가 분석합니다.

## 코드 구조

- `app/`: 앱 셸, 메타데이터, 전역 스타일
- `proxy.ts`, `utils/supabase/`: 요청 세션 쿠키와 Supabase 클라이언트
- `components/score/`: 구장 선택, 코스 레이아웃, 샷 입력, 스코어카드, 라운드 리포트
- `components/my/`: 내 라운드 전체 목록, 상세 샷 복원, 익명/친구 비교 설정
- `components/layout/ComingSoonTab.tsx`: 아직 제공하지 않는 서비스 탭의 안내 UI
- `hooks/useRound.ts`: 라운드 입력 상태와 기기 임시저장, Supabase 동기화
- `utils/golf/`: 핸디캡 그룹과 골프 계산 로직
- `supabase/migrations/`: 사용자·코스·라운드·샷·공개 범위 스키마
- `docs/ROUND_INTEGRITY_POLICY.md`: 샷 입력 서버 이력, 극최소 소요시간, 보상 심사 분류 기준

## Supabase 설정

`supabase/migrations/20261011171754_golf_round_foundation.sql`은 기존 `profiles`, `rounds`, `round_holes` 테이블이 있는 Supabase 프로젝트에 적용하는 추가 마이그레이션입니다. 이어 `20261011173403_course_hole_tee_catalog.sql`과 `20261011230414_course_green_variants.sql`에서 홀·티·그린별 거리 카탈로그와 라운드별 그린 선택 저장을 추가합니다. 세 마이그레이션은 현재 연결된 원격 DB에 적용했습니다.

이 마이그레이션은 다음을 추가합니다.

- 프로필의 자기 신고 핸디캡과 비교 그룹 (`beginner`, `amateur`, `pro`)
- 출처와 검수 상태를 추적하는 `golf_courses`, `golf_course_routes`
- 9홀 코스별 홀 파와 실제로 제공되는 티만 저장하는 `golf_course_holes`, `golf_course_hole_tees`
- 모든 샷을 정규화해 기기 간 복원하는 `round_shots`
- 라운드 당시 실력 그룹, 필드/스크린 방식, 코스 구간 순서, 공개 범위
- 친구 관계와 친구 공개 라운드/익명 그룹 통계를 위한 RLS 및 RPC

초보는 핸디캡 36 초과, 아마추어는 0 초과~36 이하, 프로 수준은 0 이하를 비교용 그룹으로 사용합니다. 이는 공식 핸디캡 또는 프로 자격 인증이 아닙니다.

## 골프장 데이터

구장 검색은 `verification_status = 'verified'`인 카탈로그 항목만 반환합니다. 공식 공개 체육시설 데이터와 관리자 보정 자료를 출처로 사용하고, 관리자 검수 후 공개해야 합니다. 공식 원본의 코스별 홀 파·거리 정보는 별도 검증 자료가 없으면 플레이 가능한 레이아웃으로 간주하지 않습니다. 구장에 OUT/IN 등 두 개 9홀 코스를 등록하면 사용자가 오늘의 코스 순서를 고를 수 있습니다.

기준으로 삼는 [문화체육관광부 전국 골프장 현황](https://www.data.go.kr/data/15118920/fileData.do)은 2024-12-31 추출 CSV입니다. 원본에서 필요한 이름·지역·소재지·홀 수만 남긴 [검수 후보 541행](supabase/seed/mcst-courses-2024-12-31.csv)을 함께 보관합니다. 516개 구장으로 정규화되며, importer는 검수 전 자료를 `pending`으로만 추가합니다. 원본은 홀별 파와 거리를 제공하지 않으므로 관리자 코스 보정 후에야 플레이 기록에 사용할 수 있습니다.

CSV 헤더가 자동 인식되지 않으면 정확한 헤더명을 지정하세요. 기본 실행은 미리보기이며, 실제 적재 시에만 `--apply`를 붙입니다. MCP SQL 적재용 정규화 JSON을 만들 때는 `--export-json <파일>`을 사용합니다. service role 키는 서버 비밀 환경변수로만 전달해야 합니다.

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = '서버 비밀 키'
node scripts/import-mcst-courses.mjs --input 'supabase/seed/mcst-courses-2024-12-31.csv'
node scripts/import-mcst-courses.mjs --input 'supabase/seed/mcst-courses-2024-12-31.csv' --apply
```

검수 자료는 `courses[].routes[].holes[]`에 홀 번호, 파, 선택값인 핸디캡 인덱스, 실제 확인된 `tees[]`를 넣습니다. 각 티는 `tee_code`, `display_name`, `tee_color`, `distance_m`를 갖습니다. 기본 그린은 `green_code: "standard"`, `green_name: "기본 그린"`으로 처리하며, 복수 그린은 같은 티 코드로 그린별 행을 추가하고 `green_code`/`green_name`을 지정합니다. DB는 홀·티·그린 조합으로 거리를 저장합니다. 각 코스 레이아웃은 실제 운영 홀 수에 따라 1~18홀로 등록하며 공식 `source_url`이 필요합니다. 라운드 선택 UI는 코스들을 순서대로 조합하거나 동일 코스를 반복해 최대 18홀 기록을 구성합니다. 구장 전체 `hole_count`를 제공하면 1~144 범위와 레이아웃 홀 수 합계를 검사하고 해당 메타데이터도 저장합니다. 81홀 군산CC처럼 공식 시설 홀 수와 현재 확인 가능한 레이아웃 수가 다르면 `allow_partial_routes`와 미공개 자료 메모를 명시합니다. 자료가 없는 블랙티는 행을 만들지 않습니다. `supabase/seed/`의 이든·감포 JSON은 공식 페이지를 대조한 검수 자료입니다. 검수 importer는 기본 미리보기이며 저장에만 `--apply`가 필요합니다.

실제 적재 스크립트는 프로젝트 URL과 서버 전용 `SUPABASE_SECRET_KEY`를 환경변수로 읽습니다. `--check`는 seed와 DB의 구장·코스·홀·티·그린 행을 비교하고, 누락·추가·거리 불일치를 오류로 표시합니다. 키는 브라우저·저장소·채팅에 넣지 마세요. 구형 `SUPABASE_SERVICE_ROLE_KEY`도 호환을 위해 읽습니다.

```powershell
node scripts/import-course-corrections.mjs --input 'supabase/seed/<verified-course>.json' --check
```

2026-10-13 재확인한 원격 Supabase 카탈로그는 총 516곳이며, 검수 완료 278곳, 미진행 233곳, 반려 5곳입니다. 이 수치는 `golf_courses.verification_status` 집계이며 적재 작업 후 바뀔 수 있습니다. 구장별 자료 출처와 반영 이력은 [코스 카탈로그 작업 기록](supabase/seed/COURSE_CATALOG_WORKFLOW.md), 재현 가능한 코스 보정 자료는 `supabase/seed/`의 JSON 파일을 확인하세요. MCST 목록은 시설 검색 후보이며, 공식 홀별 파·티 거리를 보증하지 않습니다.

## 데이터 공개와 비교

- 라운드는 기본 비공개입니다.
- 친구 비교는 상호 수락한 관계와 사용자가 선택한 `friends` 공개 라운드만 조회합니다.
- 핸디캡 그룹 익명 비교는 사용자가 선택한 `aggregate` 라운드만 이용하며, 5명 이상의 서로 다른 기여자가 있을 때에만 결과를 반환합니다.
- 샷 상세와 닉네임은 익명 그룹 RPC에서 반환하지 않습니다.
- 사용자는 MY 화면에서 라운드 기록을 JSON으로 내려받을 수 있습니다.

## 제품 범위와 다음 단계

조인/벙개, 영상, 레슨, 쇼핑 탭은 서비스 준비 안내만 노출합니다. 회당 이용권·포인트·추천 장부와 MY 조회 화면은 준비했지만 가격·결제 승인·보상 지급은 비활성입니다. 출시 전에 정할 항목과 결제·환불·보존 절차는 [유료 서비스 출시 준비](docs/COMMERCE_LAUNCH_PREPARATION.md)를 참고하세요. 구독, 코스 관리용 관리자 UI, 공개 원본 자동 갱신, 핸디캡 인증, 실기기 동기화/접근성 수동 검증은 아직 운영 기능으로 제공하지 않습니다. 향후 기능은 API와 스키마를 분리해 추가하고, 외부 데이터는 출처·사용권·검수 상태를 함께 관리합니다.
