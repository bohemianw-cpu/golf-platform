# 골프장 카탈로그 적재와 검수

## 데이터 단계

1. `mcst-courses-YYYY-MM-DD.csv`는 체육시설 기초 목록입니다. 이 자료는 구장 식별 정보와 홀 수만 적재하며, `pending` 상태로 저장됩니다. 코스명만으로 홀별 거리나 티 구성을 추정하지 않습니다.
2. 공식 홈페이지에서 코스명, 9홀별 파, 티 이름, 거리, 단위를 확인해 `*-official-review.json`을 작성합니다. 각 9홀 코스는 별도 `routes` 항목으로 저장하고, 실제 자료에 없는 티 행은 만들지 않습니다. `source_url`에는 사람이 확인할 공식 코스 페이지를, 자료가 JSON·JS 등으로 별도 제공되면 `source_data_url`에도 원자료 URL을 기록합니다.
3. 공식 요약 전장과 홀별 거리 합계, 홀 수, 티별 제공 여부를 대조합니다. 티별 공식 합계가 있으면 `official_tee_totals_m`에 기록합니다. importer는 홀별 합과 공식 합의 차이를 표시하고, 해당 코스를 `verified`로 적재하려 하면 차이를 해결하기 전에는 중단합니다. 자료끼리 충돌하거나 단위가 확인되지 않으면 `review_notes`에 근거를 적고 구장과 코스를 `pending`으로 유지합니다.
4. 담당자가 출처와 모든 홀 값을 검토한 뒤에만 해당 구장과 각 코스의 `verification_status`를 `verified`로 바꿉니다. 앱 검색은 구장과 코스가 모두 `verified`인 데이터만 노출합니다.

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
- 공식 티별 총거리가 공개되어 있으면 각 티 총거리와 홀별 거리 합이 같은지 importer로 확인합니다. 차이가 있으면 원문 수치와 차이를 기록하고 검수 완료로 전환하지 않습니다.
- 거리는 공식 표의 원 단위(`source_distance`, `source_unit`)와 미터 환산값(`distance_m`)을 함께 보존합니다. 반올림을 포함한 환산 규칙을 검수 메모에 기록합니다.
- 공식 자료가 티 위치를 나누지 않고 홀마다 거리 한 값만 공개하면 `official` 단일 티로 저장하고, 티 명칭이나 색상을 추정하지 않습니다. 공식 자료에 티 이름이 있으면 그 이름을 그대로 사용합니다.
- 일부 홀에 특정 티가 없으면 해당 티를 추정하거나 복제하지 않습니다. 라운딩 화면은 선택한 모든 홀에 존재하는 티만 제안합니다. 따라서 Black 티가 하나라도 확인되지 않으면 해당 코스 조합의 Black 티 선택지는 나타나지 않습니다.
- 좌/우 그린처럼 홀에서 실제로 선택하는 그린 종류에 따라 거리가 달라지는 경우 `green_code`와 `green_name`으로 각 값을 구분합니다.
- 공식 자료끼리 값이 다르거나 단위·시설 매핑이 불분명하면 값을 덮어 쓰지 말고 두 원문 값을 `review_notes`에 남긴 뒤 `pending`으로 둡니다.

## 현재 웹 관리자 기능

저장소에는 코스 카탈로그를 편집하는 웹 관리자 화면은 아직 없습니다. 현재 검수와 공개 전환은 이 보정 JSON, 두 importer, Supabase의 `verification_status`를 통해 운영합니다. 운영자 화면을 추가할 때도 공개 정책은 그대로 유지해 구장과 코스 상태를 함께 확인한 뒤 전환해야 합니다.

## 최근 공식 자료 반영

- 나주힐스CC: 공식 9홀 페이지의 PAR·HDCP·블랙/블루/화이트/레드 거리(m)를 반영했습니다. 일부 홀에 게시되지 않은 티는 저장하지 않았습니다. 자료 파일: `naju-hills-2026-official-verified.json`; 출처: [코스 전체](https://najuhills.com/course-full/), [1번 홀](https://najuhills.com/course-01/) ~ [9번 홀](https://najuhills.com/course-09/) (2026-10-12 확인).
