import { expect, test } from '@/e2e/fixtures'
import type { GetRunDto } from '../../../src/features/run/application/dto/get-run.dto'
import type { ListRunsDto } from '../../../src/features/run/application/dto/list-runs.dto'

test('should display a form with a single select input', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test })

  // WHEN
  await page.goto('/forms/contact-us')

  // THEN
  await expect(page.getByText('Select a color')).toBeVisible()
})

test('should clear the selected value of a single select input', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test })

  // WHEN
  await page.goto('/forms/contact-us')
  await page.selectOption('select', 'green')
  await page.getByRole('button', { name: 'Clear selection' }).click()

  // THEN
  await expect(page.locator('select')).toHaveValue('')
})

test('should run an automation when a form with a single select input is submitted', async ({
  startExampleApp,
}) => {
  // GIVEN
  const { page } = await startExampleApp({ test, filter: 'post-automation', loggedOnAdmin: true })

  // WHEN
  await page.goto('/forms/contact-us')
  await page.selectOption('select', 'green')
  await page.getByRole('button', { name: 'Submit' }).click()
  await page.waitForSelector('text="Thank you for your submission"')

  // THEN
  const { runs }: ListRunsDto = await page.request.get('/api/runs').then((res) => res.json())
  expect(runs.length).toBe(1)
  const { steps }: GetRunDto = await page.request
    .get(`/api/runs/${runs[0]!.id}`)
    .then((res) => res.json())
  expect(steps[0]!.output.body).toEqual({ select: 'green' })
})

test('should create a record with a single select input', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, loggedOnAdmin: true })

  // WHEN
  await page.goto('/forms/contact-us')
  await page.selectOption('select', 'green')
  await page.getByRole('button', { name: 'Submit' }).click()
  await page.waitForSelector('text="Thank you for your submission"')

  // THEN
  const { records } = await page.request.get('/api/tables/1').then((res) => res.json())
  expect(records.length).toBe(1)
  expect(records[0].fields.select).toBe('green')
})
