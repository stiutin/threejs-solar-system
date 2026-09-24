import {expect, test} from '@playwright/test';

/** Collects uncaught errors and console errors for the whole test. */
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  return errors;
}

test('loads the textures and shows the scene', async ({page}) => {
  const errors = trackErrors(page);
  await page.goto('./');

  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#loader')).toBeHidden();
  expect(errors).toEqual([]);
});

test('focuses a planet from the panel', async ({page}) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await expect(page.locator('#loader')).toBeHidden();

  await page.locator('[data-planet="saturn"]').click();
  await expect(page.locator('#planet-name')).toHaveText(/Saturn/i);
  expect(errors).toEqual([]);
});

test('pauses and changes the simulation speed', async ({page}) => {
  await page.goto('./');
  await expect(page.locator('#loader')).toBeHidden();

  const pause = page.locator('#pause-button');
  const label = await pause.textContent();
  await pause.click();
  await expect(pause).not.toHaveText(label ?? '');

  await page.locator('#speed').fill('3');
  await expect(page.locator('#speed-value')).toContainText('3');
});
