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

현재 배포 DB에는 MCST 목록 중 미검수 구장 491개가 `pending`으로, 골프존카운티 이든·감포·천안·안성W·선산·이글몬트·안성H·선운·진천·영암45·화랑·드래곤·오라·무주·사천·구미·경남·송도·순천·경주신라·코스카CC·클럽디 더플레이어스·클럽디 보은·클럽디 거창·에콜리안 제천 25개 구장의 검수 코스 65개(585홀, 1,839개 티·그린 거리)가 `verified`로 있습니다. 이 중 골프존카운티 [이든·밸리](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=56&golfclubSeq=70), [감포 OUT·IN](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=2&golfclubSeq=1), [천안 OUT·IN](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=16&golfclubSeq=47), [안성W OUT·IN](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=4&golfclubSeq=2), [선산 OUT·IN](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=15&golfclubSeq=28), [이글몬트](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=52&golfclubSeq=64), [안성H](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=29&golfclubSeq=53), [선운·화시](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=13&golfclubSeq=5), [진천 레이크·마운틴·밸리](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=9&golfclubSeq=4), [영암45 짐앵·카일 필립스](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=48&golfclubSeq=59), [화랑](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=26&golfclubSeq=52), [드래곤](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=34&golfclubSeq=55), [오라](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=5&golfclubSeq=3), [무주](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=30&golfclubSeq=54), [사천](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=35&golfclubSeq=56), [구미](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=24&golfclubSeq=50), [경남](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=22&golfclubSeq=49), [송도](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=54&golfclubSeq=68), [순천](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=40&golfclubSeq=57), [경주신라 천마·화랑](https://www.sillacc.co.kr/swp/cheonma_course), [코스카CC](https://www.koscacc.kr/pagesite/course/intro.asp), [클럽디 더플레이어스](https://www.clubd.com/theplayers/course/course_south.do), [클럽디 보은](https://www.clubd.com/boeun/course/course_east.do), [클럽디 거창](https://www.clubd.co.kr/geochang/course/courseIntro.do), [에콜리안 제천](https://www.ecolian.or.kr/cotents/course/courseInfo.do?coDiv=105)의 공식 자료를 확인했습니다. 화랑은 [공식 화랑 코스](https://www.sillacc.co.kr/swp/hwarang_course) 페이지도 대조했습니다. MCST 목록은 시설 검색 후보이지, 코스나 홀 거리를 보증하지 않습니다. 에콜리안 제천 데이터는 코스별 9홀을 선택해 같은 코스를 반복하면 18홀 라운드에 사용할 수 있습니다. 각 홀의 좌·우 그린과 티별 거리는 [검수 seed](supabase/seed/ecolian-jecheon-2026-verified.json)에 보관했습니다.

## 데이터 공개와 비교

- 라운드는 기본 비공개입니다.
- 친구 비교는 상호 수락한 관계와 사용자가 선택한 `friends` 공개 라운드만 조회합니다.
- 핸디캡 그룹 익명 비교는 사용자가 선택한 `aggregate` 라운드만 이용하며, 5명 이상의 서로 다른 기여자가 있을 때에만 결과를 반환합니다.
- 샷 상세와 닉네임은 익명 그룹 RPC에서 반환하지 않습니다.
- 사용자는 MY 화면에서 라운드 기록을 JSON으로 내려받을 수 있습니다.

## 제품 범위와 다음 단계

조인/벙개, 영상, 레슨, 쇼핑 탭은 서비스 준비 안내만 노출합니다. 결제/구독, 코스 관리용 관리자 UI, 공개 원본 자동 갱신, 핸디캡 인증, 실기기 동기화/접근성 수동 검증은 아직 운영 기능으로 제공하지 않습니다. 향후 기능은 API와 스키마를 분리해 추가하고, 외부 데이터는 출처·사용권·검수 상태를 함께 관리합니다.
