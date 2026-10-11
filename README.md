# Golf Secretary

라운드와 샷 데이터를 기기 간 동기화하고, 실제 입력값에 근거해 개인 분석과 연습 방향을 제공하는 Next.js 앱입니다.

## 실행과 검증

```bash
npm install
npm run dev
npx tsc --noEmit
npm run lint
npm run build
```

필수 환경변수는 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL` 및 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`입니다. 레거시 프로젝트는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`도 브라우저 클라이언트에서 지원합니다. 비밀 키(service role)는 브라우저 환경변수로 두지 마세요.

## 코드 구조

- `app/`: 앱 셸, 메타데이터, 전역 스타일
- `proxy.ts`, `utils/supabase/`: 요청 세션 쿠키와 Supabase 클라이언트
- `components/score/`: 구장 선택, 코스 레이아웃, 샷 입력, 스코어카드, 라운드 리포트
- `components/my/`: 내 라운드 전체 목록, 상세 샷 복원, 익명/친구 비교 설정
- `components/layout/ComingSoonTab.tsx`: 아직 제공하지 않는 서비스 탭의 안내 UI
- `hooks/useRound.ts`: 라운드 입력 상태와 기기 임시저장, Supabase 동기화
- `utils/golf/`: 핸디캡 그룹과 골프 계산 로직
- `supabase/migrations/`: 사용자·코스·라운드·샷·공개 범위 스키마

## Supabase 설정

`supabase/migrations/202610120001_golf_round_foundation.sql`은 기존 `profiles`, `rounds`, `round_holes` 테이블이 있는 Supabase 프로젝트에 적용하는 추가 마이그레이션입니다. 적용 전 DB 백업과 현재 스키마 확인이 필요합니다. 이 작업에서는 저장된 원격 프로젝트를 변경하지 않았습니다.

이 마이그레이션은 다음을 추가합니다.

- 프로필의 자기 신고 핸디캡과 비교 그룹 (`beginner`, `amateur`, `pro`)
- 출처와 검수 상태를 추적하는 `golf_courses`, `golf_course_routes`
- 모든 샷을 정규화해 기기 간 복원하는 `round_shots`
- 라운드 당시 실력 그룹, 필드/스크린 방식, 코스 구간 순서, 공개 범위
- 친구 관계와 친구 공개 라운드/익명 그룹 통계를 위한 RLS 및 RPC

초보는 핸디캡 36 초과, 아마추어는 0 초과~36 이하, 프로 수준은 0 이하를 비교용 그룹으로 사용합니다. 이는 공식 핸디캡 또는 프로 자격 인증이 아닙니다.

## 골프장 데이터

구장 검색은 `verification_status = 'verified'`인 카탈로그 항목만 반환합니다. 공식 공개 체육시설 데이터와 관리자 보정 자료를 출처로 사용하고, 관리자 검수 후 공개해야 합니다. 공식 원본의 코스별 홀 파·거리 정보는 별도 검증 자료가 없으면 플레이 가능한 레이아웃으로 간주하지 않습니다. 구장에 OUT/IN 등 두 개 9홀 코스를 등록하면 사용자가 오늘의 코스 순서를 고를 수 있습니다.

기준으로 삼는 [문화체육관광부 전국 골프장 현황](https://www.data.go.kr/data/15118920/fileData.do)은 2024-12-31 추출 CSV이며 골프장 명칭·사업자·소재지·면적·홀 수·구분을 제공하지만 홀별 파와 거리를 제공하지 않습니다. importer는 검수 전 자료를 `pending`으로만 추가하며, 구장 검수 후 코스 레이아웃을 별도로 등록해야 검색 및 라운드 기록에 사용할 수 있습니다.

CSV 헤더가 자동 인식되지 않으면 정확한 헤더명을 지정하세요. 기본 실행은 미리보기이며, 실제 적재 시에만 `--apply`를 붙입니다. service role 키는 서버 비밀 환경변수로만 전달해야 합니다.

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = '서버 비밀 키'
node scripts/import-mcst-courses.mjs --input 'C:\data\mcst-golf-courses.csv'
node scripts/import-mcst-courses.mjs --input 'C:\data\mcst-golf-courses.csv' --name-column '골프장명' --address-column '소재지' --holes-column '홀수' --apply
```

현재 배포 DB에는 아직 검증 카탈로그가 없습니다. Golfzon 카탈로그 수집은 사용 허가 전까지 하지 않습니다.

## 데이터 공개와 비교

- 라운드는 기본 비공개입니다.
- 친구 비교는 상호 수락한 관계와 사용자가 선택한 `friends` 공개 라운드만 조회합니다.
- 핸디캡 그룹 익명 비교는 사용자가 선택한 `aggregate` 라운드만 이용하며, 5명 이상의 서로 다른 기여자가 있을 때에만 결과를 반환합니다.
- 샷 상세와 닉네임은 익명 그룹 RPC에서 반환하지 않습니다.
- 사용자는 MY 화면에서 라운드 기록을 JSON으로 내려받을 수 있습니다.

## 제품 범위와 다음 단계

조인/벙개, 영상, 레슨, 쇼핑 탭은 서비스 준비 안내만 노출합니다. 결제/구독, 코스 관리용 관리자 UI, 공개 원본 자동 갱신, 핸디캡 인증, 실기기 동기화/접근성 수동 검증은 아직 운영 기능으로 제공하지 않습니다. 향후 기능은 API와 스키마를 분리해 추가하고, 외부 데이터는 출처·사용권·검수 상태를 함께 관리합니다.
