import { expect, test } from '@/e2e/fixtures'

test('should list automations', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, filter: 'run-typescript', loggedOnAdmin: true })

  // WHEN
  await page.goto('/admin/automations')

  // THEN
  await expect(page.getByRole('cell', { name: 'run-typescript' })).toBeVisible()
  await expect(page.getByText('less than a minute ago')).toBeVisible()
})

test('should disable an automation', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, filter: 'typescript', loggedOnAdmin: true })

  // WHEN
  await page.goto('/admin/automations')
  await page.getByRole('switch').click()
  await page.waitForSelector('text=Automation "run-typescript" is now inactive.')

  // THEN
  const statusResponse = await page.request.get('/api/automations')
  const { automations } = await statusResponse.json()
  expect(automations.length).toBe(1)
  expect(automations[0].active).toBe(false)
  const runResponse = await page.request.post('/api/automations/run-typescript')
  expect(runResponse.status()).toBe(403)
  const { error, success } = await runResponse.json()
  expect(error).toBe('Automation is not active')
  expect(success).toBe(false)
})

test('should enable an automation', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, filter: 'typescript', loggedOnAdmin: true })

  // WHEN
  await page.goto('/admin/automations')
  await page.getByRole('switch').click()
  await page.waitForSelector('text=Automation "run-typescript" is now inactive.')
  await page.getByRole('switch').click()
  await page.waitForSelector('text=Automation "run-typescript" is now active.')

  // THEN
  const statusResponse = await page.request.get('/api/automations')
  const { automations } = await statusResponse.json()
  expect(automations.length).toBe(1)
  expect(automations[0].active).toBe(true)
  const runResponse = await page.request.post('/api/automations/run-typescript')
  const { error, success } = await runResponse.json()
  expect(error).toBeUndefined()
  expect(success).toBe(true)
})

test('should open the edit url', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, filter: 'typescript', loggedOnAdmin: true })

  // WHEN
  await page.goto('/admin/automations')
  await page.getByRole('button', { name: 'Open menu' }).click()
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('menuitem', { name: 'Edit this automation' }).click(),
  ])

  await popup.waitForLoadState()

  // THEN
  await expect(popup).toHaveURL(
    'https://github.com/omnera-dev/omnera/blob/main/example/automation/admin.ts'
  )
})
