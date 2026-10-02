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

/**
 * Average brightness (0–765) of a small square at the centre of the view, read from a screenshot: WebGL keeps
 * no drawing buffer to read back. The focused planet fills the centre; empty space is nearly black.
 */
async function centreBrightness(page) {
  const {width, height} = page.viewportSize();
  const shot = await page.screenshot({clip: {x: width / 2 - 15, y: height / 2 - 15, width: 30, height: 30}});
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const {data} = context.getImageData(0, 0, image.width, image.height);
    let total = 0;
    for (let index = 0; index < data.length; index += 4) {
      total += data[index] + data[index + 1] + data[index + 2];
    }
    return total / (data.length / 4);
  }, shot.toString('base64'));
}

// Thresholds with room for the night side of a planet and for software rendering in CI: lit planets measure
// 100 to 400, empty space about 20 to 60 depending on what drifts through the centre.
const PLANET = 60;
const SPACE = 40;
// Loading every texture with software WebGL can take a while when tests run side by side.
const SCENE_TIMEOUT = 20_000;

test('keeps a focused planet in view as it orbits, until told to stop', async ({page, isMobile}) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await expect(page.locator('#loader')).toBeHidden({timeout: SCENE_TIMEOUT});
  // Mercury is the fastest planet; at five times the speed it would leave the view within a second.
  await page.locator('#speed').fill('5');

  await page.locator('[data-planet="mercury"]').click();
  await expect(page.locator('#follow-status')).toHaveText('The camera follows Mercury along its orbit.');
  await expect(page.locator('#follow-button')).toHaveAttribute('aria-pressed', 'true');
  // Let the flight land.
  await page.waitForTimeout(1500);
  expect(await centreBrightness(page)).toBeGreaterThan(PLANET);
  await page.waitForTimeout(2000);
  expect(await centreBrightness(page)).toBeGreaterThan(PLANET);

  const followed = await centreBrightness(page);
  await page.locator('#follow-button').click();
  await expect(page.locator('#follow-button')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#follow-button')).toHaveText('Follow Mercury');
  // Left behind, the planet moves out of the centre and the view darkens. On a phone the panel sits over the
  // lower half of the view and the reading is too close to call, so the desktop run checks it.
  if (!isMobile) {
    await page.waitForTimeout(3000);
    expect(await centreBrightness(page)).toBeLessThan(Math.min(SPACE * 2, followed / 2));
  }
  expect(errors).toEqual([]);
});

test('flies to a planet, or jumps there when motion is reduced', async ({page}) => {
  await page.goto('./');
  await expect(page.locator('#loader')).toBeHidden({timeout: SCENE_TIMEOUT});
  const status = page.locator('#follow-status');

  await page.locator('[data-planet="jupiter"]').click();
  await expect(status).toHaveText('Flying to Jupiter…');
  await expect(status).toHaveText('The camera follows Jupiter along its orbit.');

  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.locator('[data-planet="saturn"]').click();
  // No flight: the status reads "follows" straight away, without a "Flying to" first.
  expect(await status.textContent()).toBe('The camera follows Saturn along its orbit.');
});
