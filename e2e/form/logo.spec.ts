import { expect, test } from '@/e2e/fixtures'
import type { GetFormDto } from '@/features/form/application/dto/get-form.dto'

test('should return a form with a logo in API', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, filter: 'form/logo' })

  // WHEN
  const response = await page.request.get('/api/forms/contact-us')

  // THEN
  expect(response.status()).toBe(200)
  const { form }: GetFormDto = await response.json()
  expect(form.logo).toBe('/static/logo.png')
})

test('should display a form with a logo', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, filter: 'form/logo' })

  // WHEN
  await page.goto('/forms/contact-us')

  // THEN
  const logo = page.locator('img[src="/static/logo.png"]')
  await expect(logo).toBeVisible()
})

test('should display logo above the title', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, filter: 'form/logo' })

  // WHEN
  await page.goto('/forms/contact-us')

  // THEN
  const logo = page.locator('img[src="/static/logo.png"]')
  const title = page.getByRole('heading', { name: 'Contact us' })

  await expect(logo).toBeVisible()
  await expect(title).toBeVisible()

  // Verify logo is positioned above title
  const logoBox = await logo.boundingBox()
  const titleBox = await title.boundingBox()
  expect(logoBox!.y).toBeLessThan(titleBox!.y)
})
