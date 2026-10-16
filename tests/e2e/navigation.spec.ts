import { expect, test } from '@playwright/test'
import { mockSignedInApp } from './support/mockApp'

test('each tab has its own address that survives refresh and back navigation', async ({ page }) => {
  await mockSignedInApp(page, { draft: false })
  // 스크롤 가능한 화면에서는 상단바와 하단 메뉴가 잠시 뒤 숨으므로 먼저 다시 보이게 한다.
  const revealChrome = () => page.mouse.wheel(0, 120)
  const tabLink = async (name: RegExp) => {
    await revealChrome()
    await page.getByRole('navigation').getByRole('link', { name }).click()
  }

  await page.goto('/')
  await expect(page).toHaveURL(/\/score$/)
  await expect(page.getByRole('navigation').getByRole('link', { name: /스코어/ })).toHaveAttribute('aria-current', 'page')

  await tabLink(/MY/)
  await expect(page).toHaveURL(/\/my$/)
  await expect(page.getByRole('button', { name: '샘플 입력 시작' })).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/\/my$/)
  await expect(page.getByRole('button', { name: '샘플 입력 시작' })).toBeVisible()

  // 개발 서버의 Next.js 표시 버튼이 맨 왼쪽 '홈' 메뉴를 가리므로 상단 로고 링크로 이동한다.
  await revealChrome()
  await page.getByRole('link', { name: 'Golf Secretary 홈으로 이동' }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByRole('navigation').getByRole('link', { name: /홈/ })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: /오늘 라운드 준비되셨나요/ })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/my$/)
  await expect(page.getByRole('button', { name: '샘플 입력 시작' })).toBeVisible()

  await page.goto('/lesson')
  await expect(page.getByRole('heading', { name: '레슨 서비스 준비 중' })).toBeVisible()
  await expect(page).toHaveTitle('레슨 | Golf Secretary')
  await page.getByRole('link', { name: '스코어 기록 계속하기' }).click()
  await expect(page).toHaveURL(/\/score$/)
  await expect(page.getByRole('button', { name: '✓ 샷 결과 저장' })).toBeVisible()
})

test('the root redirect keeps email link parameters for sign-in', async ({ request }) => {
  const response = await request.get('/?code=email-link-code&type=recovery', { maxRedirects: 0 })
  expect(response.status()).toBe(307)
  expect(response.headers().location).toBe('/score?code=email-link-code&type=recovery')
  const plain = await request.get('/', { maxRedirects: 0 })
  expect(plain.headers().location).toBe('/score')
})
