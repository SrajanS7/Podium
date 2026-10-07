import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Automated WCAG 2.1 AA scan of every screen (axe-core). Manual keyboard checks complement this.
for (const route of ['', 'countries', 'drivers', 'geography', 'regions', 'literacy-model', 'athletes', 'find-your-sport', 'data']) {
  test(`no WCAG A/AA violations on /${route || 'overview'}`, async ({ page }) => {
    await page.goto(`/#/${route}`);
    await expect(page.locator('h1')).toBeVisible();
    await page.waitForTimeout(1200); // let charts finish animating
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const summary = results.violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.help}`);
    expect(summary).toEqual([]);
  });
}
