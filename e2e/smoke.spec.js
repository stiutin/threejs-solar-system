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

/** Focuses a planet from the panel, waits for the flight to land, then releases it, leaving it in the centre. */
async function centreOn(page, planet) {
  await page.locator(`[data-planet="${planet}"]`).click();
  await expect(page.locator('#follow-status')).toHaveText(new RegExp(`follows ${planet}`, 'i'));
  await page.locator('#speed').fill('0');
  await page.locator('#follow-button').click();
  await expect(page.locator('#follow-button')).toHaveAttribute('aria-pressed', 'false');
}

/** The middle of the viewport, where a planet focused from the panel sits. */
function viewCentre(page) {
  const {width, height} = page.viewportSize();
  return {x: width / 2, y: height / 2};
}

test('focuses a planet clicked in the scene', async ({page, isMobile}) => {
  // On a phone the panel covers the middle of the view, where a planet focused from the panel ends up.
  test.skip(isMobile, 'the panel covers the centre of the view');
  const errors = trackErrors(page);
  await page.goto('./');
  await expect(page.locator('#loader')).toBeHidden({timeout: SCENE_TIMEOUT});
  await centreOn(page, 'saturn');

  const {x, y} = viewCentre(page);
  await page.mouse.click(x, y);

  await expect(page.locator('#follow-status')).toHaveText(/Saturn/);
  await expect(page.locator('#follow-button')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#planet-name')).toHaveText('Saturn');
  expect(errors).toEqual([]);
});

test('a drag over a planet turns the view instead of picking it', async ({page, isMobile}) => {
  // On a phone the panel covers the middle of the view, where a planet focused from the panel ends up.
  test.skip(isMobile, 'the panel covers the centre of the view');
  await page.goto('./');
  await expect(page.locator('#loader')).toBeHidden({timeout: SCENE_TIMEOUT});
  await centreOn(page, 'saturn');

  const {x, y} = viewCentre(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 80, y + 20, {steps: 8});
  await page.mouse.up();

  await expect(page.locator('#follow-button')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#follow-status')).toHaveText('');
});

test('shows a pointer and the name over a planet', async ({page, isMobile}) => {
  test.skip(isMobile, 'a mouse pointer');
  await page.goto('./');
  await expect(page.locator('#loader')).toBeHidden({timeout: SCENE_TIMEOUT});
  await centreOn(page, 'saturn');
  const canvas = page.locator('canvas');

  const {x, y} = viewCentre(page);
  await page.mouse.move(x, y);
  await expect(canvas).toHaveAttribute('title', 'Saturn');
  await expect(canvas).toHaveCSS('cursor', 'pointer');

  await page.mouse.move(page.viewportSize().width - 5, page.viewportSize().height - 5);
  await expect(canvas).toHaveAttribute('title', '');
  await expect(canvas).toHaveCSS('cursor', 'auto');
});
