with official_data_sources(course_name, route_code, source_data_url) as (
  values
    ('라데나골프클럽', 'GARDEN', 'https://www.ladena.co.kr/assets/CourseInformationComponent.js'),
    ('라데나골프클럽', 'LAKE', 'https://www.ladena.co.kr/assets/CourseInformationComponent.js'),
    ('라데나골프클럽', 'NATURE', 'https://www.ladena.co.kr/assets/CourseInformationComponent.js'),
    ('메이플비치 골프&리조트', 'BEACH', 'https://www.maplebeach.co.kr/chunks/BeachCourse-BTVDjqZR.js'),
    ('메이플비치 골프&리조트', 'MAPLE', 'https://www.maplebeach.co.kr/chunks/MapleCourse-BU5zxXwW.js'),
    ('스카이밸리골프장(회원)', 'SKY', 'https://www.skyvalley.co.kr/static/pc/origin/resources/json/sky.json'),
    ('스카이밸리골프장(회원)', 'VALLEY', 'https://www.skyvalley.co.kr/static/pc/origin/resources/json/valley.json'),
    ('스카이밸리골프장(비회원)', 'LAKE', 'https://www.skyvalley.co.kr/static/pc/origin/resources/json/lake.json'),
    ('스카이밸리골프장(비회원)', 'MOUNTAIN', 'https://www.skyvalley.co.kr/static/pc/origin/resources/json/mountain.json')
)
update public.golf_course_routes as routes
set source_data_url = sources.source_data_url
from public.golf_courses as courses, official_data_sources as sources
where routes.course_id = courses.id
  and courses.name = sources.course_name
  and routes.route_code = sources.route_code
  and routes.source_data_url is null;
