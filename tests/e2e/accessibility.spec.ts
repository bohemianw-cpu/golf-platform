import { expect, test, type Page } from '@playwright/test'
import { mockCourseSearch, mockSignedInApp } from './support/mockApp'

/**
 * 화면에 보이는 입력란·버튼·링크 중 화면 낭독기가 읽을 이름이 없거나 기호뿐인 것,
 * 화면을 덮는데 대화상자 역할이 없는 창을 찾는다.
 */
async function unnamedControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = []
    const nameOf = (el: Element) => {
      const labelledBy = (el.getAttribute('aria-labelledby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ')
      const aria = (el.getAttribute('aria-label') ?? '') || labelledBy
      if (aria.trim()) return aria.trim()
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
        return (Array.from(el.labels ?? []).map((label) => label.textContent ?? '').join(' ') || el.getAttribute('title') || '').trim()
      }
      return ((el as HTMLElement).innerText || el.getAttribute('title') || '').trim()
    }
    for (const el of Array.from(document.querySelectorAll('input:not([type=hidden]), select, textarea, button, a[href], [role=dialog]'))) {
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      const name = nameOf(el)
      if (!name || /^[^\p{L}\p{N}]+$/u.test(name)) problems.push(`${el.tagName.toLowerCase()} "${name}" ${el.outerHTML.slice(0, 80)}`)
    }
    for (const overlay of Array.from(document.querySelectorAll('div'))) {
      const style = getComputedStyle(overlay)
      if (style.position === 'fixed' && Number(style.zIndex) > 100 && overlay.offsetHeight > 300 && !overlay.closest('[role=dialog]') && !overlay.querySelector('[role=dialog]')) {
        problems.push(`대화상자 역할 없는 창 ${overlay.outerHTML.slice(0, 80)}`)
      }
    }
    return [...new Set(problems)]
  })
}

test('the login and sign-up window names every field for screen readers and password managers', async ({ page }) => {
  await page.route('**/auth/v1/**', (route) => route.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }))
  await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }))
  await page.goto('/home')
  expect(await unnamedControls(page)).toEqual([])

  await page.getByRole('button', { name: '로그인 / 회원가입' }).click()
  const dialog = page.getByRole('dialog', { name: '골프 비서 로그인' })
  await expect(dialog.getByLabel('이메일')).toHaveAttribute('autocomplete', 'email')
  await expect(dialog.getByLabel('비밀번호')).toHaveAttribute('autocomplete', 'current-password')
  expect(await unnamedControls(page)).toEqual([])

  await page.getByRole('button', { name: '계정이 없으신가요? 회원가입' }).click()
  const signUp = page.getByRole('dialog', { name: '골프 비서 회원가입' })
  await expect(signUp.getByLabel('닉네임')).toBeVisible()
  await expect(signUp.getByLabel('비밀번호')).toHaveAttribute('autocomplete', 'new-password')
  expect(await unnamedControls(page)).toEqual([])

  await signUp.getByRole('button', { name: '닫기' }).click()
  await expect(signUp).toBeHidden()
})

test('signed-in tabs and the club settings window have no unnamed controls', async ({ page }) => {
  await mockSignedInApp(page)
  await mockCourseSearch(page)
  await page.goto('/score')
  await page.getByRole('dialog').getByRole('button', { name: '이어서 하기' }).click()
  await expect(page.getByRole('button', { name: '✓ 샷 결과 저장' })).toBeVisible()
  expect(await unnamedControls(page)).toEqual([])

  await page.getByRole('button', { name: /클럽 설정/ }).click()
  const clubs = page.getByRole('dialog', { name: /골프백 클럽 설정/ })
  await expect(clubs.getByLabel('새 클럽 종류')).toBeVisible()
  await expect(clubs.getByLabel('새 클럽 이름')).toBeVisible()
  await expect(clubs.getByRole('button', { name: /삭제$/ }).first()).toBeVisible()
  expect(await unnamedControls(page)).toEqual([])
  await clubs.getByRole('button', { name: '닫기' }).click()
  await expect(clubs).toBeHidden()

  for (const path of ['/home', '/my', '/join', '/video', '/lesson', '/shop']) {
    await page.goto(path)
    await expect(page.getByRole('navigation')).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(await unnamedControls(page), path).toEqual([])
  }
})
