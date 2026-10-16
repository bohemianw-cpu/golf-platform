import { expect, test, type Locator, type Page } from '@playwright/test'
import { mockSignedInApp } from './support/mockApp'

const focusIsInside = (dialog: Locator) => dialog.evaluate((el) => el.contains(document.activeElement))

/** Tab과 Shift+Tab을 여러 번 눌러도 키보드 위치가 창 밖으로 나가지 않는지 확인한다. */
async function expectTabStaysInside(page: Page, dialog: Locator) {
  for (const key of [...Array(12).fill('Tab'), ...Array(12).fill('Shift+Tab')]) {
    await page.keyboard.press(key)
    expect(await focusIsInside(dialog), `${key} 뒤`).toBe(true)
  }
}

test('the login window takes keyboard focus, keeps Tab inside, and closes with Escape', async ({ page }) => {
  await page.route('**/auth/v1/**', (route) => route.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }))
  await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }))
  await page.goto('/home')
  const opener = page.getByRole('button', { name: '로그인 / 회원가입' })
  await opener.click()

  const dialog = page.getByRole('dialog', { name: '골프 비서 로그인' })
  await expect(dialog.getByLabel('이메일')).toBeFocused()
  await expectTabStaysInside(page, dialog)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
})

test('Escape picks only a harmless choice in confirmation windows', async ({ page }) => {
  const writes: string[] = []
  await mockSignedInApp(page, { writes, draft: false, serverRound: true })
  await page.goto('/score')

  // 이어하기·삭제·나중에 중 '나중에'만 아무것도 바꾸지 않으므로 Esc는 그것을 고른다.
  const prompt = page.getByRole('dialog').filter({ hasText: '진행 중이던 라운드' })
  await expect(prompt.getByRole('button', { name: '이어서 하기' })).toBeFocused()
  await expectTabStaysInside(page, prompt)
  await page.keyboard.press('Escape')
  await expect(prompt).toBeHidden()
  await expect(page.getByRole('searchbox', { name: '골프장 이름 검색' })).toHaveValue('')
  expect(writes.filter((write) => write.startsWith('DELETE'))).toEqual([])
})

test('Escape does not answer a question that has no harmless choice', async ({ page }) => {
  await mockSignedInApp(page)
  await page.goto('/score')
  // 이 기기의 임시 기록: '이어서 하기'와 '버리기'뿐이라 Esc로 고르지 않는다.
  const prompt = page.getByRole('dialog').filter({ hasText: '이 기기에 저장된 임시 기록' })
  await expect(prompt).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(prompt).toBeVisible()
  await prompt.getByRole('button', { name: '이어서 하기' }).click()
  await expect(page.getByRole('searchbox', { name: '골프장 이름 검색' })).toHaveValue('검증용 CC')
})

test('club settings and hole result windows close with Escape and return focus', async ({ page }) => {
  await mockSignedInApp(page)
  await page.goto('/score')
  await page.getByRole('dialog').getByRole('button', { name: '이어서 하기' }).click()

  const opener = page.getByRole('button', { name: /클럽 설정/ })
  await opener.click()
  const clubs = page.getByRole('dialog', { name: /골프백 클럽 설정/ })
  await expect(clubs.getByLabel('새 클럽 종류')).toBeFocused()
  await expectTabStaysInside(page, clubs)
  await page.keyboard.press('Escape')
  await expect(clubs).toBeHidden()
  await expect(opener).toBeFocused()

  await page.getByRole('spinbutton', { name: '샷 후 남은 거리' }).fill('0')
  await page.getByRole('button', { name: '🏁 홀아웃 기록' }).click()
  const result = page.getByRole('dialog').filter({ hasText: '라운드 리포트 보기' })
  await expect(result.getByRole('button', { name: '라운드 리포트 보기' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(result).toBeHidden()
})
