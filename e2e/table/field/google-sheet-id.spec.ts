import { expect, test } from '@/e2e/fixtures'

test('should create a record with a google_sheet_id field', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, loggedOnAdmin: true })
  const googleSheetId = '1WsoeQScXgQSacV-2VnhlkTest123'

  // WHEN
  const response = await page.request.post('/api/tables/CRM Files', {
    data: {
      fields: {
        name: 'Test Sheet',
        google_sheet_id: googleSheetId,
      },
    },
  })

  // THEN
  const { record } = await response.json()
  expect(record.fields).toEqual({
    name: 'Test Sheet',
    google_sheet_id: googleSheetId,
  })
})

test('should open google sheet in new window when clicking google_sheet_id link', async ({
  startExampleApp,
}) => {
  // GIVEN
  const { page } = await startExampleApp({ test, loggedOnAdmin: true })
  const googleSheetId = '1WsoeQScXgQSacV-2VnhlkTest123'
  await page.request.post('/api/tables/CRM Files', {
    data: {
      fields: {
        name: 'Test Sheet',
        google_sheet_id: googleSheetId,
      },
    },
  })

  // WHEN
  await page.goto('/admin/tables')
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('link', { name: googleSheetId }).click(),
  ])

  await popup.waitForLoadState()

  // THEN
  // Google Sheets automatically redirects to /edit
  await expect(popup).toHaveURL(
    new RegExp(`https://docs\\.google\\.com/spreadsheets/d/${googleSheetId}`)
  )
})

test('should display empty cell when google_sheet_id is empty', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, loggedOnAdmin: true })
  await page.request.post('/api/tables/CRM Files', {
    data: {
      fields: {
        name: 'Test Sheet Without ID',
        google_sheet_id: '',
      },
    },
  })

  // WHEN
  await page.goto('/admin/tables')

  // THEN
  const row = page.getByRole('row').filter({ hasText: 'Test Sheet Without ID' })
  await expect(row).toBeVisible()
  // The google_sheet_id cell should not contain a google sheets link
  // Check that there's no link to Google Sheets (only the expand icon link should be present)
  const googleSheetsLinks = row
    .getByRole('link')
    .filter({ has: page.locator('[href*="docs.google.com"]') })
  await expect(googleSheetsLinks).toHaveCount(0)
})
