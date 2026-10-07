import { expect, test, type Page } from '@playwright/test';

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true }).click();

// Each test starts with a fresh browser context, i.e. the original data.

test('overview shows the golden numbers and the season filter works', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByText('6,854')).toBeVisible();
  await page.getByRole('button', { name: 'Winter', exact: true }).click();
  await expect(page.getByText('1,089')).toBeVisible(); // 332 + 381 + 376 Winter medals
});

test('editing a record updates every screen, and undo restores it', async ({ page }) => {
  await page.goto('/#/data');
  await page.getByRole('button', { name: 'Edit record 1, Michael Phelps' }).click();
  const count = page.getByLabel('Number of medals');
  await count.fill('9');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Edited medal record #1' })).toBeVisible();

  await nav(page, 'Overview');
  await expect(page.getByText('6,855')).toBeVisible();          // one more medal
  await nav(page, 'Athletes');
  await expect(page.getByRole('cell', { name: '23', exact: true }).first()).toBeVisible(); // Phelps now 23

  await nav(page, 'Data manager');
  await page.getByRole('button', { name: 'Undo last change' }).click();
  await nav(page, 'Overview');
  await expect(page.getByText('6,854')).toBeVisible();
});

test('invalid input is blocked with a clear message', async ({ page }) => {
  await page.goto('/#/data');
  await page.getByRole('button', { name: 'Add medal record' }).click();
  await page.getByRole('button', { name: 'Add record' }).click();
  await expect(page.getByText('Please fix the highlighted fields before saving.')).toBeVisible();
  await expect(page.getByText('Enter an athlete')).toBeVisible();
});

test('switching a sport to per-athlete counting changes the totals', async ({ page }) => {
  await page.goto('/#/data');
  await page.getByRole('tab', { name: /Sports & counting rules/ }).click();
  await page.getByRole('row', { name: /^Football/ }).getByRole('switch').click();
  await nav(page, 'Overview');
  await expect(page.getByText(String(6854 - 24 + 407).replace(/\B(?=(\d{3})+(?!\d))/g, ','))).toBeVisible(); // 7,237
});

test('every screen loads without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const route of ['', 'countries', 'drivers', 'geography', 'regions', 'literacy-model', 'athletes', 'find-your-sport', 'data']) {
    await page.goto(`/#/${route}`);
    await expect(page.locator('h1')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('geography myths and regions show the golden numbers', async ({ page }) => {
  await page.goto('/#/geography');
  await expect(page.getByRole('heading', { name: 'Geography myths', level: 1 })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Hungary' })).toBeVisible();     // landlocked, 66 water medals
  await expect(page.getByRole('cell', { name: '69%' }).first()).toBeVisible();
  await page.goto('/#/regions');
  await expect(page.getByText('Western Europe won 32% of medals')).toBeVisible();
  await expect(page.getByRole('cell', { name: '3.89×' })).toBeVisible();       // CIS vs expectation
});

test('the Games dropdown opens below the button and filters the data', async ({ page }) => {
  await page.goto('/#/');
  const button = page.getByRole('button', { name: /Games/ });
  await button.click();
  const list = page.getByRole('listbox');
  const [b, l] = [await button.boundingBox(), await list.boundingBox()];
  expect(l!.y).toBeGreaterThanOrEqual(b!.y + b!.height);           // list starts below the button
  await page.getByRole('option', { name: 'Turin 2006' }).click();
  await expect(page.getByText('381', { exact: true }).first()).toBeVisible();
  await button.press('Enter');                                       // keyboard: open, move, choose
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(page.getByText('6,854')).toBeVisible();
});

test('drivers of success shows the correlation matrix, with a table view', async ({ page }) => {
  await page.goto('/#/drivers');
  await expect(page.getByText('Population and wealth explain 77%')).toBeVisible();
  const matrix = page.getByRole('figure', { name: 'Which national factors move with medals?' });
  await expect(matrix.getByText('Strongest link with total medals: economy size (+0.75)')).toBeVisible();
  await matrix.getByRole('button', { name: 'Show as table' }).click();
  await expect(matrix.getByRole('row', { name: /^Total medals 1\.00/ })).toContainText('0.75');
});

test('literacy model screen: 77% -> 85% explained, India 158 -> 6', async ({ page }) => {
  await page.goto('/#/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Literacy model', exact: true }).click();
  await expect(page.getByText('from 77% to 85%')).toBeVisible();
  await expect(page.getByText('expected 158 → 6 medals')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'India' })).toBeVisible();
});

test('importing a bad file is refused with a clear message, and nothing changes', async ({ page }) => {
  await page.goto('/#/data');
  await page.locator('input[type=file]').setInputFiles({ name: 'not-the-dataset.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2') });
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Import failed: nothing was changed.');
  await expect(alert).toContainText('missing these sheets');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByText('6,854')).toBeVisible();
});

test('navigation: data manager comes before additional insights and play', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('h1')).toBeVisible();
  const labels = await page.getByRole('navigation', { name: 'Main' }).locator('.nav-label').allTextContents();
  expect(labels).toEqual(['Insights', 'Manage', 'Additional insights', 'Play']);
});

test('find your sport: Germany at 25, then 8 years of training and Kenya by typing', async ({ page }) => {
  await page.goto('/#/find-your-sport');
  await expect(page.getByText('prime window of 37 of 44 sports')).toBeVisible();
  await expect(page.getByText('Best bets for Germany: canoeing, rowing, biathlon')).toBeVisible();
  await page.getByLabel('Years of training first').fill('8');
  await expect(page.getByText("you'd be 33")).toBeVisible();
  await page.getByRole('button', { name: /Your country/ }).click();
  await page.keyboard.type('ken');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Kenya at the Games' })).toBeVisible();
  await page.getByLabel('Your age').fill('5');
  await expect(page.getByRole('alert')).toContainText('between 10 and 80');
});

test('changing several counting rules lists all of them, and they can be restored', async ({ page }) => {
  await page.goto('/#/data');
  await page.getByRole('tab', { name: /Sports & counting rules/ }).click();
  for (const sport of ['Swimming', 'Athletics', 'Rowing']) await page.getByRole('row', { name: new RegExp(`^${sport}`) }).getByRole('switch').click();
  const status = page.getByRole('status').filter({ hasText: 'Counting rules changed' });
  await expect(status).toContainText('Athletics, Rowing and Swimming are counted once per team');
  await expect(status).toContainText('3 edits');
  await expect(page.getByText('Changed', { exact: true })).toHaveCount(3);
  await page.getByRole('button', { name: 'Restore default rules' }).click();
  await expect(page.getByText('Changed', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Restored the default counting rules (3 sports)' })).toBeVisible();
});

test('athlete search finds any name, and a new athlete can be added', async ({ page }) => {
  await page.goto('/#/data');
  await page.getByRole('button', { name: 'Add medal record' }).click();
  const box = page.getByRole('combobox', { name: 'Athlete' });
  await box.fill('bjorndal');                                           // accents ignored: Ole Einar Bjørndalen
  await expect(page.getByRole('option', { name: /Bjørndalen/ })).toBeVisible();
  await box.fill('Test Athlete Zed');
  await page.getByRole('option', { name: /Add “Test Athlete Zed” as a new athlete/ }).click();
  await page.getByLabel('Year of birth').fill('1990');
  const editor = page.getByRole('complementary', { name: 'Add medal record' });   // the form, not the table filters
  await editor.getByRole('combobox', { name: 'Nation' }).selectOption({ label: 'Germany' });
  await editor.getByRole('combobox', { name: 'Games' }).selectOption({ label: 'London 2012' });
  await editor.getByRole('combobox', { name: 'Sport' }).selectOption({ label: 'Rowing (Summer)' });
  await page.getByRole('button', { name: 'Add record' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'with new athlete Test Athlete Zed' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Athletes', exact: true }).click();
  await page.getByLabel('Search athlete or nation').fill('Test Athlete Zed');
  await expect(page.getByRole('cell', { name: 'Test Athlete Zed' })).toBeVisible();
});
