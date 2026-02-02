import { expect, test } from '@/e2e/fixtures'

test('should return the admin tables page', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, loggedOnAdmin: true, filter: '/table/index' })

  // WHEN
  await page.goto('/admin/tables')

  // THEN
  await expect(page).toHaveScreenshot()
})

test('should list tables', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, loggedOnAdmin: true, filter: '/table/index' })

  // WHEN
  await page.goto('/admin/tables')

  // THEN
  await expect(page.locator('a').filter({ hasText: 'Users' })).toBeVisible()
  await expect(page.locator('a').filter({ hasText: 'Posts' })).toBeVisible()
})

test('should list table records', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, loggedOnAdmin: true, filter: '/table/index' })
  await page.request.post('/api/tables/Users', {
    data: {
      records: [
        { fields: { 'First name': 'John', 'Last name': 'Doe' } },
        { fields: { 'First name': 'Jane', 'Last name': 'Dae' } },
      ],
    },
  })

  // WHEN
  await page.goto('/admin/tables')

  // THEN
  await expect(page.getByText('John')).toBeVisible()
  await expect(page.getByText('Doe')).toBeVisible()
  await expect(page.getByText('Jane')).toBeVisible()
  await expect(page.getByText('Dae')).toBeVisible()
})

test('should search table records', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, loggedOnAdmin: true, filter: '/table/index' })
  await page.request.post('/api/tables/Users', {
    data: {
      records: [
        { fields: { 'First name': 'John', 'Last name': 'Doe' } },
        { fields: { 'First name': 'Jane', 'Last name': 'Dae' } },
      ],
    },
  })

  // WHEN
  await page.goto('/admin/tables')
  await page.getByPlaceholder('Search...').fill('John')

  // THEN
  await expect(page.getByText('John')).toBeVisible()
  await expect(page.getByText('Jane')).not.toBeVisible()
})

test('should open and display a table record', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, loggedOnAdmin: true, filter: '/table/index' })
  const response = await page.request.post('/api/tables/1', {
    data: {
      records: [{ fields: { 'First name': 'John', 'Last name': 'Doe' } }],
    },
  })
  const recordId = (await response.json()).records[0].id

  // WHEN
  await page.goto('/admin/tables')
  await page.getByRole('cell', { name: '1.' }).getByRole('link').click()
  await page.waitForURL(`/admin/tables/1/records/${recordId}`)

  // THEN
  await expect(page.getByRole('heading', { name: 'John' })).toBeVisible()
  const lastName = await page.getByRole('textbox', { name: 'Last name' }).inputValue()
  expect(lastName).toBe('Doe')
})

test('should create a table record', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, loggedOnAdmin: true, filter: '/table/index' })

  // WHEN
  await page.goto('/admin/tables')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.waitForURL('/admin/tables/1/record/new')
  await page.getByRole('textbox', { name: 'First name' }).fill('John')
  await page.getByRole('textbox', { name: 'Last name' }).fill('Doe')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.waitForURL('/admin/tables/1/records/*')

  // THEN
  await expect(page.getByText('Record created successfully')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'John' })).toBeVisible()
})

test('should create a table record with required fields', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, loggedOnAdmin: true, filter: '/table/required' })

  // WHEN
  await page.goto('/admin/tables')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.waitForURL('/admin/tables/1/record/new')
  await page.getByRole('textbox', { name: 'First name' }).fill('John')
  await page.getByRole('textbox', { name: 'Last name' }).fill('Doe')
  await page.getByRole('button', { name: 'Create' }).click()
  await page.waitForURL('/admin/tables/1/records/*')

  // THEN
  await expect(page.getByText('Record created successfully')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'John' })).toBeVisible()
})

test('should update a table record', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, loggedOnAdmin: true, filter: '/table/index' })
  const response = await page.request.post('/api/tables/1', {
    data: {
      records: [{ fields: { 'First name': 'John', 'Last name': 'Doe' } }],
    },
  })
  const recordId = (await response.json()).records[0].id

  // WHEN
  await page.goto('/admin/tables')
  await page.getByRole('cell', { name: '1.' }).getByRole('link').click()
  await page.waitForURL(`/admin/tables/1/records/${recordId}`)
  await page.getByRole('textbox', { name: 'First name' }).fill('Jane')
  await page.getByRole('textbox', { name: 'Last name' }).fill('Dae')
  await page.getByRole('button', { name: 'Update' }).click()

  // THEN
  await expect(page.getByRole('heading', { name: 'Jane' })).toBeVisible()
  const lastName = await page.getByRole('textbox', { name: 'Last name' }).inputValue()
  expect(lastName).toBe('Dae')
  await page.goto('/admin/tables')
  await expect(page.getByText('John')).not.toBeVisible()
  await expect(page.getByText('Jane')).toBeVisible()
})

test('should delete a table record', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, loggedOnAdmin: true, filter: '/table/index' })
  await page.request.post('/api/tables/1', {
    data: {
      records: [{ fields: { 'First name': 'John', 'Last name': 'Doe' } }],
    },
  })

  // WHEN
  await page.goto('/admin/tables')
  await page.getByRole('cell', { name: 'Select row' }).click()
  await page.getByRole('button', { name: 'Actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.waitForSelector('text=1 records deleted')

  // THEN
  await expect(page.getByText('John')).not.toBeVisible()
})

test.fixme('should have sticky header and pagination with many rows', async ({
  startExampleApp,
}) => {
  // GIVEN
  const { page } = await startExampleApp({ test, loggedOnAdmin: true, filter: '/table/index' })

  // Create many records to trigger scrolling
  const records = Array.from({ length: 50 }, (_, i) => ({
    fields: { 'First name': `User${i}`, 'Last name': `Test${i}` },
  }))

  await page.request.post('/api/tables/1', {
    data: { records },
  })

  // WHEN
  await page.goto('/admin/tables/1')

  // Scroll down to the bottom of the table
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight)
  })

  // THEN
  // Header should still be visible at the top
  await expect(page.getByRole('cell', { name: 'First name' })).toBeInViewport()

  // Pagination should still be visible at the bottom
  await expect(page.getByText('0 of 50 row(s) selected.')).toBeInViewport()
})

test('should display created_at and id columns', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, loggedOnAdmin: true, filter: '/table/index' })
  const response = await page.request.post('/api/tables/1', {
    data: {
      records: [{ fields: { 'First name': 'John', 'Last name': 'Doe' } }],
    },
  })
  const record = (await response.json()).records[0]

  // WHEN
  await page.goto('/admin/tables')

  // THEN
  // Verify column headers are visible
  const headerRow = page.getByRole('row').first()
  await expect(headerRow.getByRole('columnheader', { name: 'created_at' })).toBeVisible()
  await expect(headerRow.getByRole('columnheader', { name: 'id' })).toBeVisible()

  // Verify the created_at value is displayed (should contain date/time)
  const dataRow = page.getByRole('row').filter({ hasText: 'John' })
  const createdAtCell = dataRow.getByRole('cell').nth(-2)
  await expect(createdAtCell).toBeVisible()
  const createdAtText = await createdAtCell.textContent()
  expect(createdAtText).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/)

  // Verify the id value is displayed
  const idCell = dataRow.getByRole('cell').last()
  await expect(idCell).toBeVisible()
  await expect(idCell).toContainText(record.id)
})

test('should sort table records from newest to oldest', async ({ startExampleApp }) => {
  // GIVEN
  const { page } = await startExampleApp({ test, loggedOnAdmin: true, filter: '/table/index' })

  // Create records with a delay to ensure different timestamps
  await page.request.post('/api/tables/1', {
    data: {
      records: [{ fields: { 'First name': 'First', 'Last name': 'Record' } }],
    },
  })

  // Wait to ensure different creation times (1 second for SQLite timestamp precision)
  await page.waitForTimeout(1100)

  await page.request.post('/api/tables/1', {
    data: {
      records: [{ fields: { 'First name': 'Second', 'Last name': 'Record' } }],
    },
  })

  await page.waitForTimeout(1100)

  await page.request.post('/api/tables/1', {
    data: {
      records: [{ fields: { 'First name': 'Third', 'Last name': 'Record' } }],
    },
  })

  // WHEN
  await page.goto('/admin/tables/1')

  // THEN
  // Get all rows with data (excluding header)
  const rows = page.getByRole('row').filter({ has: page.getByRole('cell', { name: /\d+\./ }) })

  // Check that the first data row contains the most recently created record
  await expect(rows.first()).toContainText('Third')

  // Check that the last data row contains the first created record
  await expect(rows.last()).toContainText('First')

  // Verify the middle record is in the correct position
  await expect(rows.nth(1)).toContainText('Second')
})
