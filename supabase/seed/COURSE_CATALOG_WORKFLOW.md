# 골프장 카탈로그 적재와 검수

## 데이터 단계

구장 저장명은 공통 표기를 사용합니다. `컨트리클럽`/`Country Club`은 `CC`, `골프클럽`/`Golf Club`은 `GC`, 두 명칭이 결합된 `골프&컨트리클럽`/`Golf & Country Club`은 `GCC`로 저장합니다. MCST 및 관리자 보정 importer와 라운드 저장 경로가 이 표기를 적용하며, 검색어도 같은 규칙으로 바꿔 기존 명칭으로 검색해도 결과를 찾을 수 있습니다.

1. `mcst-courses-YYYY-MM-DD.csv`는 체육시설 기초 목록입니다. 이 자료는 구장 식별 정보와 홀 수만 적재하며, `pending` 상태로 저장됩니다. 코스명만으로 홀별 거리나 티 구성을 추정하지 않습니다.
2. 공식 홈페이지에서 코스명, 9홀별 파, 티 이름, 거리, 단위를 확인해 `*-official-review.json`을 작성합니다. 각 9홀 코스는 별도 `routes` 항목으로 저장하고, 실제 자료에 없는 티 행은 만들지 않습니다. `source_url`에는 사람이 확인할 공식 코스 페이지를, 자료가 JSON·JS 등으로 별도 제공되면 `source_data_url`에도 원자료 URL을 기록합니다.
3. 공식 코스 페이지에 홀별 파와 티별 거리, 단위가 충분히 공개되어 있으면 해당 값을 바로 적재합니다. 티별 공식 합계는 참고용으로 기록할 수 있지만 홀별 공식 거리 합과 다르더라도 적재를 막지 않습니다. importer는 차이를 안내하고 홀별 출처값을 저장합니다. 티 종류가 명시되지 않은 단일 거리만 있으면 중립적인 `공식 거리 (티 미표기)` 행 하나로 저장하고 다른 티를 추정하지 않습니다.
4. 공식 자료가 모든 홀의 파와 공개된 거리를 제공하면 별도 합계 검수 없이 구장과 경로를 `verified`로 적재할 수 있습니다. 출처끼리 직접 충돌하거나 단위·티 구성이 불분명한 특이사항은 `review_notes`와 앱 관리자 메모에 남겨 재확인할 수 있게 합니다. 앱 검색은 구장과 경로가 모두 `verified`인 데이터만 노출합니다.

`course-corrections/1` 파일의 구장에는 `verification_status`를 반드시 명시합니다. 코스의 상태를 생략하면 구장 상태를 상속합니다. 상태가 없는 과거 파일은 읽기 검사와 `--check`만 가능하며, `--apply` 전에 상태를 명시해야 합니다. 파일명에 `verified`가 들어 있어도 검수 완료 상태로 취급하지 않습니다.

## MCST 기본 목록 적재

PowerShell에서 Supabase 서버 전용 환경변수(`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`)를 설정한 뒤 실행합니다. 키는 저장소나 CSV에 넣지 않습니다.

```powershell
node scripts/import-mcst-courses.mjs --input supabase/seed/mcst-courses-2024-12-31.csv
node scripts/import-mcst-courses.mjs --input supabase/seed/mcst-courses-2024-12-31.csv --apply
```

첫 명령은 후보 건수와 저장하지 않았다는 사실을 출력합니다. `--apply`를 붙여야 DB에 기록됩니다. 가져온 MCST 구장은 검수 대기 상태이며, 코스·홀·티 거리 자료는 별도 보정 파일로 관리합니다. 재적재 시 이미 검증된 MCST 행은 보존하고 미검증 행만 갱신합니다.

## 공식 코스 자료 적재와 확인

보정 파일은 `supabase/seed/` 아래에 둡니다. 구조 검사는 파일만 읽으며 DB를 변경하지 않습니다. 기존 `course-source-review/1` 자료도 같은 importer에서 처리하며, 좌·우 그린별 티 거리를 별도 티 행으로 펼쳐 저장합니다. `par_source_url`은 라우트 검수 메모에 보존합니다. 출처 검수 상태가 명시적으로 완료된 경우에만 verified로 적용합니다.

```powershell
node scripts/import-course-corrections.mjs --input supabase/seed/360cc-2026-official-review.json
```

검수 메모, 코스별 9개 홀, 각 홀의 파와 실제 공개된 티 행을 확인합니다. 공식값을 반영할 때는 `--apply`를 사용합니다.

```powershell
node scripts/import-course-corrections.mjs --input supabase/seed/360cc-2026-official-review.json --apply
```

DB에 저장한 뒤 같은 파일에 `--check`를 실행하면 구장, 코스, 홀, 티 데이터와 기록한 원자료 URL이 파일과 같은지 비교합니다.

```powershell
node scripts/import-course-corrections.mjs --input supabase/seed/360cc-2026-official-review.json --check
```

검토가 끝난 항목만 파일에서 `verification_status`를 `verified`로 변경하고 다시 `--apply`, `--check` 순서로 실행합니다. 변경한 자료와 출처 URL을 함께 커밋해 검수 이력을 남깁니다. 코스·티 보정은 동일한 코스 코드로 재실행해 갱신할 수 있습니다.

적용을 시작하면 구장을 먼저 `pending`으로 숨기고 기존 코스도 `pending`으로 바꾼 다음 홀·티 데이터를 저장합니다. 모든 자식 데이터가 저장된 뒤에 명시된 코스 상태를 적용하고, 마지막에 구장 상태를 적용합니다. 도중에 오류가 발생하면 해당 구장은 `pending` 상태로 남으므로 원인을 수정한 뒤 같은 파일로 다시 적용하고 `--check`를 실행합니다. 이 과정은 여러 DB 요청으로 이루어져 전체가 단일 트랜잭션으로 묶이지는 않습니다. 동일 구장에 대한 보정 작업을 동시에 실행하지 마세요.

## 검수 기준

- 구장명과 주소가 공식 홈페이지 및 MCST 레코드와 같은 시설을 가리키는지 확인합니다. 이름이 비슷한 회원제/대중제 시설은 각각 식별합니다.
- 18홀 이상 구장은 사용자가 실제 라운드에서 선택하는 코스 조합별로 9홀 구간을 나눕니다. 9홀 코스는 독립 경로로 입력합니다.
- 파는 각 홀별 공식 표를 옮기고 9홀 합계가 공식값과 맞는지 확인합니다.
- 공식 티별 총거리가 공개되어 있으면 합계는 오류 탐지용으로 대조하고, 공식 홀별 파·거리·단위가 충분히 명확하면 합계 차이만으로 적재나 검수를 막지 않습니다. 값 차이나 표기 이상은 원문과 함께 `review_notes`에 남깁니다.
- 거리는 공식 표의 원 단위(`source_distance`, `source_unit`)와 미터 환산값(`distance_m`)을 함께 보존합니다. 반올림을 포함한 환산 규칙을 검수 메모에 기록합니다.
- 공식 원표가 야드와 미터를 함께 제공하면 `distance_m`에는 표의 공식 미터값을 그대로 저장하고, `source_distance`/`source_unit`에는 공식 야드값을 보존합니다. 두 게시값이 수학적 환산과 다를 수 있으므로 이 경우 단순 환산 차이만으로 원자료 오류로 판정하지 말고, 두 값과 공식 합계·표의 티 배치를 대조해 검수 메모에 남깁니다.
- 공식 자료가 티 위치를 나누지 않고 홀마다 거리 한 값만 공개하면 `official` 단일 티로 저장하고, 티 명칭이나 색상을 추정하지 않습니다. 공식 자료에 티 이름이 있으면 그 이름을 그대로 사용합니다.
- 일부 홀에 특정 티가 없으면 해당 티를 추정하거나 복제하지 않습니다. 라운딩 화면은 선택한 모든 홀에 존재하는 티만 제안합니다. 따라서 Black 티가 하나라도 확인되지 않으면 해당 코스 조합의 Black 티 선택지는 나타나지 않습니다.
- 좌/우 그린처럼 홀에서 실제로 선택하는 그린 종류에 따라 거리가 달라지는 경우 `green_code`와 `green_name`으로 각 값을 구분합니다.
- 실제 운영에서 그린/레이아웃에 따라 홀의 파도 달라지면 해당 티 행에 선택 구성의 `par`를 저장합니다. 같은 홀·그린 구성에 속한 모든 티는 같은 par override를 가져야 하며, 라운드 화면은 구성을 바꿀 때 par와 거리를 함께 바꾸고 확정 스코어의 파를 라운드 기록에 남깁니다.
- 공식 자료끼리 값이 다르거나 단위·시설 매핑이 불분명하면 값을 덮어 쓰지 말고 두 원문 값을 `review_notes`에 남긴 뒤 `pending`으로 둡니다.

## 현재 웹 관리자 기능

저장소에는 코스 카탈로그를 편집하는 웹 관리자 화면은 아직 없습니다. 현재 검수와 공개 전환은 이 보정 JSON, 두 importer, Supabase의 `verification_status`를 통해 운영합니다. 운영자 화면을 추가할 때도 공개 정책은 그대로 유지해 구장과 코스 상태를 함께 확인한 뒤 전환해야 합니다.

## 최근 공식 자료 반영

- 오르비스GC(울주): 공식 OUT·IN 표에서 각 9홀의 PAR와 홀별 거리를 저장했습니다. 홀별 티 이름은 공개되지 않아 중립적인 티 미표기 거리로 등록했습니다. IN 표는 거리 단위를 생략했으며 같은 공식 표의 OUT 행 구성과 합계 패턴을 근거로 첫 행을 m로 입력하고 해당 해석을 메모했습니다. 자료 파일: `orvis-ulsan-2026-official-verified.json`; 출처: [OUT 코스](https://orvis.club/swp/clubOut), [IN 코스](https://orvis.club/swp/clubIn) (2026-10-12 확인).
- 골드그린GC(울주): 공식 METER 스코어카드와 9홀 상세 페이지에서 PAR·HDCP와 Blue/White/Red 거리를 저장했습니다. 9번 FRONT는 스코어카드 표에 380m로 적혀 있지만 상세 페이지 White 280m 및 공식 합계 2,658m와 일치하는 280m를 채택하고 원문 차이를 관리자 메모에 남겼습니다. 자료 파일: `goldgreen-ulsan-2026-official-verified.json`; 출처: [공식 스코어카드](https://www.goldgreen.co.kr/swp/course_score), [공식 코스 상세](https://www.goldgreen.co.kr/swp/out_course) (2026-10-12 확인).
- 보라CC(울산): 공식 Edward·Henry·William 홀 도면 27장에서 PAR·HDCP와 Red/Yellow/White/Blue 티별 미터 거리를 입력했습니다. 공식 도면에 이름/색상이 표시된 네 티만 보존했으며 모든 코스가 PAR36입니다. 자료 파일: `bora-ulsan-2026-official-verified.json`; 출처: [코스 안내](https://www.boracc.com/course/course_main.asp), [Edward](https://www.boracc.com/course/Edward_course.asp), [Henry](https://www.boracc.com/course/Henry_course.asp), [William](https://www.boracc.com/course/William_course.asp) 및 각 코스 홀 도면 1~9 (2026-10-12 확인).
- 울산CC: 공식 코스제원표의 동·남·서 3개 9홀 코스 PAR와 CHAMP/REG 거리를 저장했습니다. 공식 표에는 거리 단위 표기가 없어 m 해석을 검수 메모에 기록했습니다. 동코스 REG는 공식 소계 3,004m와 홀별 거리 합계 2,974m가 30m 차이나 홀별 게시값을 유지했습니다. 자료 파일: `ulsan-2026-official-verified.json`; 출처: [공식 코스제원](https://www.ulsancc.co.kr/cour/score.asp) (2026-10-12 확인).
- 리더스CC(밀양): 공식 HILL·LAKE·PINE 각 9홀 원본 도면에서 홀별 PAR·HDCP와 미터 거리를 입력했습니다. 각 홀 도면에 게시된 티별 거리 행을 모두 보존했으며, 색상/이름이 텍스트로 확인되지 않는 추가 티는 추정 명칭을 붙이지 않고 별도 중립 티 코드로 남겼습니다. 공식 페이지는 코스별 총계표를 별도로 제공하지 않아 홀 거리값을 보정하지 않았습니다. 자료 파일: `leaders-miryang-2026-official-verified.json`; 출처: [HILL 코스](https://www.leaderscc.com/course/hill), [LAKE 코스](https://www.leaderscc.com/course/lake), [PINE 코스](https://www.leaderscc.com/course/pine), 각 홀 원본 도면 `/images/course/{hill|lake|pine}/{route}-{hole}.png` (2026-10-12 확인).
- 진해신항CC(구 아라미르골프앤리조트): 공식 코스제원에서 진해 OUT/IN, 신항 OUT/IN 각 9홀의 PAR·HDCP와 블랙/블루/화이트/골드/레드 티별 거리(m)를 저장했습니다. 네 경로 모두 PAR36이며 티별 공식 총계와 홀별 거리 합이 일치합니다. 진해 코스는 공식 페이지의 좌그린 기준만 입력했고 우그린 거리는 공개되지 않아 추정하지 않았습니다. 자료 파일: `jinhae-shinhang-2026-official-verified.json`; 출처: [공식 코스제원](https://www.jhnpcc.co.kr/Course/Intro.aspx), [경남개발공사 골프장 안내](https://m.gndc.co.kr/page.do?seqId=0000000399) (2026-10-12 확인).
- 동부산CC: 공식 Hill/Lake/Valley 27홀 상세 페이지의 PAR와 Champion/Regular/Front/Lady 티별 거리(m)를 반영했습니다. 각 코스 9홀, PAR36이며 공식 페이지의 티별 이름과 색상 표기를 그대로 보존했습니다. 자료 파일: `dongbusan-2026-official-verified.json`; 출처: [코스 안내](https://www.dongpusancc.co.kr/course/course_main.asp), [Hill 1~9번](https://www.dongpusancc.co.kr/course/hill_01.asp) ~ `hill_09.asp`, [Lake 1~9번](https://www.dongpusancc.co.kr/course/lake_01.asp) ~ `lake_09.asp`, [Valley 1~9번](https://www.dongpusancc.co.kr/course/valley_01.asp) ~ `valley_09.asp` (2026-10-12 확인).
- 해운대비치골프앤리조트: 공식 코스소개 및 홀별 상세 페이지의 마운틴 1~9번, 오션 10~18번 PAR·HDCP·단일 공식 거리를 반영했습니다. 티별 거리는 게시되지 않아 티 색상을 추정하지 않았고, 공식 OUT 3,273m / IN 3,331m 총계와 홀별 합이 일치합니다. 마운틴 1·9번 HDCP가 모두 7로 게시된 특이사항은 공식 표기 그대로 메모했습니다. 자료 파일: `haeundae-beach-2026-official-verified.json`; 출처: [코스 소개](https://www.haeundaebeachcc.co.kr/course/course.do), [마운틴 1~9번 홀](https://www.haeundaebeachcc.co.kr/course/mountain01.do) ~ `mountain09.do`, [오션 10~18번 홀](https://www.haeundaebeachcc.co.kr/course/ocean01.do) ~ `ocean09.do` (2026-10-12 확인).
- 동래베네스트GC: 공식 18개 홀 상세 페이지의 PAR·HDCP·Blue/White 좌·우 미터 거리를 OUT/IN 9홀 경로에 반영했습니다. 전체 코스표와 18번 Blue-left 값이 7m 다르고 공식 총계 표기도 서로 달라 홀별 상세값을 유지하고 차이는 검수 메모에 남긴 채 `verified` 처리했습니다. 자료 파일: `dongrae-benest-2026-official-review.json`; 출처: [코스 개요와 전체표](https://www.benestgolf.com/reve/pc/dr-course/main.do), [1~18번 홀 상세](https://www.benestgolf.com/reve/pc/dr-course/cs01.do) ~ `cs18.do` (2026-10-12 확인).
- 하이스트CC: 공식 9홀 코스 페이지의 PAR·HDCP와 Blue/White/Yellow/Red 티별 거리를 반영했습니다. 홀 설명과 전체 전장 대조를 통해 홀별 숫자를 m로 저장했으며, Blue 9홀 합계와 소개 전장은 약 20yd 차이가 있어 공식 개별값과 차이를 메모에 보존했습니다. 8번 Red 티는 공식 표의 `-`대로 저장하지 않았습니다. 자료 파일: `highest-2026-official-verified.json`; 출처: [코스 안내](https://www.highestcc.co.kr/course), [클럽 소개와 전체 전장](https://www.highestcc.co.kr/intro/club) (2026-10-12 확인).
- 해라CC: 공식 9홀 도면의 파·빨강/노랑 티 거리(m)를 등록하고, 일부 홀에서 제공되는 흰색/빨간색 홀컵 위치별 거리도 별도 구성으로 보존했습니다. 일부 홀은 빨강 티 거리만 공개되어 노랑 티를 추정하지 않았으며, 모든 홀의 핸디캡 인덱스가 공개되지는 않아 저장하지 않았습니다. 자료 파일: `haera-2026-official-verified.json`; 출처: [코스 안내](https://www.haeracc.co.kr/course), [1번 홀 도면](https://www.haeracc.co.kr/img/course/1.png?v=1) ~ [9번 홀 도면](https://www.haeracc.co.kr/img/course/9.png?v=1) (2026-10-12 확인).
- 나주힐스CC: 공식 9홀 페이지의 PAR·HDCP·블랙/블루/화이트/레드 거리(m)를 반영했습니다. 일부 홀에 게시되지 않은 티는 저장하지 않았습니다. 자료 파일: `naju-hills-2026-official-verified.json`; 출처: [코스 전체](https://najuhills.com/course-full/), [1번 홀](https://najuhills.com/course-01/) ~ [9번 홀](https://najuhills.com/course-09/) (2026-10-12 확인).
- 일산 스프링힐스CC: 공식 9홀 상세 페이지의 PAR·HDCP·CHAMPION/REGULAR/LADY 거리(yd)를 입력하고 `1 yd = 0.9144 m`로 홀별 반올림 환산했습니다. Lady 1번은 코스 개요표 325 yd와 상세 페이지 326 yd가 달라 구장·코스를 `pending`으로 유지합니다. 자료 파일: `spring-hills-2026-official-review.json`; 출처: [코스 개요](https://www.springhills.co.kr/course/courseIntro.asp), [1번 홀](https://www.springhills.co.kr/course/h1.asp) ~ [9번 홀](https://www.springhills.co.kr/course/h9.asp), [공식 야드 단위 표기](https://www.springhills.co.kr/mobile/course/course01.asp) (2026-10-12 확인).
- 광산CC: 공식 홀별 파·HDCP와 좌·우 그린별 블랙/화이트/레드 거리를 입력했습니다. 6번 홀 화이트 좌그린은 공식 코스 제원표 254m와 공략 페이지 265m가 달랐으나, 구장에 직접 전화해 254m임을 확인했으므로 254m로 저장하고 검수 완료했습니다. 해당 출처 차이는 이력 메모에 보존했습니다. 자료 파일: `gwangsan-2026-official-review.json`; 출처: [코스 제원](https://www.gwangsancc.kr/cotents/course/courseInfo.do), [코스 공략](https://www.gwangsancc.kr/cotents/course/courseAttack.do), [로컬룰](https://www.gwangsancc.kr/cotents/guide/rule.do) (사용자 유선 확인: 2026-10-12).
- 기장동원로얄CC: 공식 홀별 9홀 페이지의 파와 좌·우 그린 티별 거리(m)를 입력했습니다. 8번 홀은 좌 Par3/좌 Par4/우 Par5로 운영되어 티·그린 구성별 par override를 적용합니다. 코스 루틴표의 티 행/합계가 상세 페이지와 다르지만, 홀별 정보가 충분해 상세 페이지를 기준으로 `verified` 처리하고 차이는 메모에 보존했습니다. 자료 파일: `gijang-dongwon-royal-2026-official-review.json`; 출처: [공식 코스 루틴](https://dongwongolf.co.kr/_mobile/PageSite/course/routine.asp), [1번 홀](https://dongwongolf.co.kr/_mobile/PageSite/course/one/hole01.asp) ~ [9번 홀](https://dongwongolf.co.kr/_mobile/PageSite/course/one/hole09.asp) (2026-10-12 확인).
- 동래베네스트골프클럽: 공식 홀별 페이지 18개의 파·HCP·Blue/White 좌·우 거리(m)를 9홀 OUT/IN 경로로 입력했습니다. 공식 전체표는 18번 Blue-left를 434m로, 개별 홀 페이지는 441m로 게시해 IN Blue-left 합계도 전체표 3,030m와 개별값 합 3,037m로 다르므로 구장·두 경로를 `pending`으로 적재했습니다. 자료 파일: `dongrae-benest-2026-official-review.json`; 출처: [공식 코스 개요와 전체표](https://www.benestgolf.com/reve/pc/dr-course/main.do), [1번 홀](https://www.benestgolf.com/reve/pc/dr-course/cs01.do) ~ [18번 홀](https://www.benestgolf.com/reve/pc/dr-course/cs18.do) (2026-10-12 확인).
- 베이사이드GC: 공식 Park/Lake/Canyon 코스 페이지와 페이지에서 사용하는 코스 스크립트의 홀별 파·HCP·미터 거리를 각 9홀 경로로 등록했습니다. 홀마다 거리 하나만 게시되어 티 색상/종류를 추정하지 않고 `공식 거리 (티 미표기)` 한 행으로 저장했으며, 구장과 세 경로를 `verified`로 반영했습니다. 자료 파일: `bayside-2026-official-verified.json`; 출처: [Park](https://www.bayside.co.kr/swp/park_course), [Lake](https://www.bayside.co.kr/swp/lake_course), [Canyon](https://www.bayside.co.kr/swp/canyon_course), [Park 원자료](https://www.bayside.co.kr/static/pc/js/custom/park_course.js), [Lake 원자료](https://www.bayside.co.kr/static/pc/js/custom/lake_course.js), [Canyon 원자료](https://www.bayside.co.kr/static/pc/js/custom/canyon_course.js) (2026-10-12 확인).
- 스톤게이트CC: 공식 스톤·게이트 코스 홀별 페이지 도면에서 파와 블랙/화이트/블루/옐로우/레드 티별 거리를 미터 단위로 입력했습니다. 공식 코스 페이지에 9홀씩 두 경로가 명시되어 있고, 각 홀 도면에 `(METER)` 단위가 함께 게시되어 별도 합계 대조는 적재 요건으로 두지 않고 `verified` 반영했습니다. 자료 파일: `stonegate-2026-official-verified.json`; 출처: [스톤코스](https://stonegategc.co.kr/Course/OutCourse.aspx), [게이트코스](https://stonegategc.co.kr/Course/InCourse.aspx), [스톤 1~9번 홀](https://stonegategc.co.kr/Course/iframe/stone01.html) 및 동일 경로의 `stone02.html`~`stone09.html`, [게이트 1~9번 홀](https://stonegategc.co.kr/Course/iframe/gate01.html) 및 동일 경로의 `gate02.html`~`gate09.html` (2026-10-12 확인).
- 아시아드CC: 공식 코스 개요와 레이크·파인·밸리 27개 홀 상세 페이지에서 파·HDCP·블랙/블루/화이트/레드 티별 공식 미터 거리를 반영했습니다. 홀별 데이터가 충분해 전체 거리 합계 일치 여부를 적재 전제 조건으로 삼지 않고 구장과 세 경로를 `verified`로 반영했습니다. 자료 파일: `asiad-2026-official-verified.json`; 출처: [공식 코스 개요](https://www.asiadcc.co.kr/html/course/course_01.asp), [레이크 1~9번 홀](https://www.asiadcc.co.kr/html/course/course_02_01.asp) ~ `course_02_09.asp`, [파인 1~9번 홀](https://www.asiadcc.co.kr/html/course/course_03_01.asp) ~ `course_03_09.asp`, [밸리 1~9번 홀](https://www.asiadcc.co.kr/html/course/course_04_01.asp) ~ `course_04_09.asp` (2026-10-12 확인).
- 베이스타즈CC: 공식 BAY·STARS 각 9홀 상세의 PAR와 BLUE/WHITE/RED 티별 좌·우 그린 거리(m)를 반영했습니다. 각 경로 9홀·PAR36이며, 경로당 54개 거리 행을 저장했습니다. 공식 개요의 “Total 홀별거리표”와 9홀 상세 합계가 일치하지 않아 상세 홀별 원문값을 유지하고 총계 차이를 검수 메모에 기록했습니다. 자료 파일: `baystars-2026-official-verified.json`; 출처: [코스 개요 및 Total 표](https://www.baystars.co.kr/html/course/course01.asp), [BAY](https://www.baystars.co.kr/html/course/course02.asp), [STARS](https://www.baystars.co.kr/html/course/course03.asp) (2026-10-12 확인).
- 양산CC: 공식 코스소개 표에서 누리·가온·마루 각 9홀의 PAR와 단일 공식 거리(m)를 저장했습니다. 세 경로 모두 PAR36이며 거리 합은 공식표의 3,084m / 3,094m / 3,324m와 일치합니다. 티별 거리는 공개되지 않아 중립적인 `공식 거리 (티 미표기)`로 저장했습니다. 자료 파일: `yangsan-2026-official-verified.json`; 출처: [공식 코스소개 및 전체 제원](https://www.yangsancc.co.kr/pagesite/course/intro.asp), [누리 1번 홀](https://www.yangsancc.co.kr/pagesite/course/one/hole01.asp) (2026-10-12 확인).
- 다이아몬드CC: 공식 제원표의 North Cape(OUT)·South Cape(IN) 각 9홀 PAR 및 BACK/REGULAR/LADY 미터 거리를 반영했습니다. 두 코스 모두 PAR36이며 North Cape 세 티와 South Cape BACK/LADY 합계는 게시된 값과 일치합니다. South Cape Regular Tee 공식 합계는 2,907m이나 홀별 상세 거리 합은 2,877m로 30m 차이가 있어 홀별 값을 유지하고 검수 메모에 기록했습니다. 상세 공략 페이지에 추가로 나온 거리 중 티 명칭이 확인되지 않는 값은 제외했습니다. 자료 파일: `diamond-2026-official-verified.json`; 출처: [코스 제원](https://www.diamondcc.co.kr/Course/CourseIntro.aspx), [North Cape 홀별 페이지](https://www.diamondcc.co.kr/Mobile/Course/CourseAttacK.aspx), [South Cape 홀별 페이지](https://www.diamondcc.co.kr/Mobile/Course/CourseAttacK2.aspx) (2026-10-12 확인).
- 양산동원로얄CC: 공식 VISTA(OUT)·DUKE(IN) 9홀 PAR와 BLACK/BLUE/WHITE/YELLOW/RED 거리(m)를 반영했습니다. 공식 표에서 빠진 VISTA 8번 Blue/Yellow 티는 만들지 않았으며, VISTA 8번 Black은 코스소개표 165m·홀 상세 128m로 충돌합니다. 두 경로와 구장을 `pending`으로 적재해 값 확인 후 공개하도록 했습니다. 자료 파일: `yangsan-dongwon-royal-2026-official-review.json`; 출처: [코스소개·거리표](https://www.dongwonroyalcc.co.kr/_mobile/PageSite/course/course.asp), [VISTA 8번 홀](https://www.dongwonroyalcc.co.kr/_mobile/pagesite/course/one/hole08.asp) (2026-10-12 확인).
- 골프존카운티 더골프: 운영사 공식 OCEAN·ROCKY 상세 페이지에서 각 9홀 PAR·HDCP 및 Blue/White/Red 티별 미터 거리를 반영했습니다. 두 경로 각 9홀·PAR36, 티별 합계도 페이지 데이터와 일치합니다. 자료 파일: `thegolf-ulsan-2026-official-verified.json`; 출처: [OCEAN](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=49&golfclubSeq=61), [ROCKY](https://www.golfzoncounty.com/golfclub/courseDtl?courseSeq=50&golfclubSeq=61) (2026-10-12 확인).
- 의령친환경골프장: 공식 코스개요와 9개 홀 상세에서 PAR·HDCP 및 Champion/Regular/Lady 티별 미터 거리를 반영했습니다. 세 티 거리 합계는 2,891m / 2,679m / 2,421m로 홀별 값 합과 일치합니다. 공식 안내의 의병 1번 출발·토요애 8번 출발을 한 9홀 경로의 출발 지점으로 기록했습니다. 홀 상세 HDCP의 1번·4번=1, 8번·9번=2 중복 표기는 원문 그대로 보존했습니다. 자료 파일: `uiryeong-eco-2026-official-verified.json`; 출처: [공식 코스개요](https://xn--289a6cv80bnhpdlav75a4vlwrc.kr/Course/View), [1번 홀](https://xn--289a6cv80bnhpdlav75a4vlwrc.kr/Course/hole/hole01.html) ~ [9번 홀](https://xn--289a6cv80bnhpdlav75a4vlwrc.kr/Course/hole/hole09.html) (2026-10-12 확인).
- 동훈힐마루CC: 공식 코스제원표의 힐코스 동·서, 마루코스 남·북 4개 9홀 PAR와 티 미표기 미터 거리를 입력했습니다. 각 경로 PAR36이며 힐 동·서와 마루 남의 거리 합은 공식 소계와 일치합니다. 마루 북 홀별 합은 3,370m, 공식 소계는 3,490m로 120m 차이가 있어 홀별 수치를 유지하고 메모에 기록했습니다. 자료 파일: `hillmaru-changnyeong-2026-official-verified.json`; 출처: [공식 코스 제원](https://www.hillmaru.com/Club/CourseInfo.aspx), [힐코스 1번](https://www.hillmaru.com/Club/iframe/hill_01.html), [마루코스 10번](https://www.hillmaru.com/Club/iframe/maru_10.html) (2026-10-12 확인).
