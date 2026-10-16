import { expect, test } from '@playwright/test'
import { mockSignedInApp, mockCourseSearch } from './support/mockApp'

test('the course search opens on focus, closes with Escape, and clears a chosen course when retyped', async ({ page }) => {
  await mockSignedInApp(page, { draft: false })
  await mockCourseSearch(page)
  await page.goto('/score')
  const search = page.getByRole('searchbox', { name: '골프장 이름 검색' })
  const results = page.getByRole('list', { name: '골프장 검색 결과' })

  await search.click()
  await expect(results.getByText('서버복구 CC')).toBeVisible()
  await search.fill('서버')
  await expect(results.getByText('서버복구 CC')).toBeVisible()
  await search.press('Escape')
  await expect(results).toBeHidden()
  await expect(search).toHaveValue('서버')

  await search.fill('서버복')
  await results.getByText('서버복구 CC').click()
  await expect(results).toBeHidden()
  await expect(search).toHaveValue('서버복구 CC')
  const route = page.getByRole('checkbox', { name: 'OUT 코스 1홀 코스' })
  await expect(route).toBeVisible()

  await search.fill('다른')
  await expect(search).toHaveValue('다른')
  await expect(route).toBeHidden()
})

test('starting a round locks the course header until it is reset', async ({ page }) => {
  await mockSignedInApp(page, { draft: false })
  await mockCourseSearch(page)
  await page.goto('/score')
  const search = page.getByRole('searchbox', { name: '골프장 이름 검색' })

  await search.click()
  await page.getByRole('list', { name: '골프장 검색 결과' }).getByText('서버복구 CC').click()
  await page.getByRole('checkbox', { name: 'OUT 코스 1홀 코스' }).check()
  await page.getByRole('radio', { name: '화이트티' }).check()
  await page.getByRole('button', { name: '라운드 시작', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '확인' }).click()

  await expect(search).toBeDisabled()
  await expect(page.getByRole('button', { name: '라운드 진행 중' })).toBeVisible()
  await expect(page.getByRole('radio', { name: '필드' })).toBeHidden()

  await page.getByRole('button', { name: '🗑️ 초기화' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '초기화' }).click()
  await expect(search).toBeEnabled()
  await expect(search).toHaveValue('')
  await expect(page.getByRole('radio', { name: '필드' })).toBeChecked()
})
