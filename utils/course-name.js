/**
 * Normalize course-name suffixes while keeping the venue's identifying name.
 * Used by both browser round entry and the catalog import scripts.
 * @param {string | null | undefined} value
 * @returns {string}
 */
function normalizeCourseName(value) {
  if (!value) return ''

  return value.normalize('NFKC')
    .replace(/(골프|golf)\s*(?:&\s*|앤\s*|and\s*)?컨트리\s*클럽/giu, 'GCC')
    .replace(/golf\s*(?:&\s*|and\s*)?country\s*club/giu, 'GCC')
    .replace(/컨트리\s*클럽|country\s*club/giu, 'CC')
    .replace(/골프\s*클럽|golf\s*club/giu, 'GC')
    .replace(/(^|[^A-Za-z])g\.?\s*c\.?\s*c\.?(?=$|[^A-Za-z])/giu, '$1GCC')
    .replace(/(^|[^A-Za-z])c\.?\s*c\.?(?=$|[^A-Za-z])/giu, '$1CC')
    .replace(/(^|[^A-Za-z])g\.?\s*c\.?(?=$|[^A-Za-z])/giu, '$1GC')
    .trim()
}

/**
 * @param {string | null | undefined} value
 * @returns {string}
 */
function normalizeCourseSearch(value) {
  return normalizeCourseName(value).replace(/[\s·ㆍ()（）.,_-]/g, '').toLocaleLowerCase('ko-KR')
}

exports.normalizeCourseName = normalizeCourseName
exports.normalizeCourseSearch = normalizeCourseSearch
