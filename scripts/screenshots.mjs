/**
 * README screenshots, reproducible from the code.
 *
 *   npm run screenshots                                                  # local production build
 *   BASE_URL=https://stiutin.github.io/threejs-solar-system/ npm run screenshots   # the live site
 *
 * Output: .github/screenshots/*.png (used by the README). Set CHROMIUM_PATH to use a specific browser binary.
 */
import {spawn, spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';

import {chromium, devices} from '@playwright/test';

const OUT = '.github/screenshots';
const live = process.env.BASE_URL;
const base = (live ?? 'http://localhost:4174/').replace(/\/?$/, '/');
mkdirSync(OUT, {recursive: true});

let server;
if (!live) {
  const built = spawnSync('npm', ['run', 'build'], {shell: true, stdio: 'inherit'});
  if (built.status !== 0) {
    process.exit(built.status ?? 1);
  }
  // Own process group, so the whole `npm → vite preview` tree can be stopped at the end.
  server = spawn('npm', ['run', 'serve'], {detached: true, shell: true, stdio: 'ignore'});
  for (
    let attempt = 0;
    attempt < 100 &&
    !(await fetch(base).then(
      () => true,
      () => false
    ));
    attempt++
  ) {
    await sleep(100);
  }
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? {args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH} : {}
);

async function shoot(contextOptions, name, prepare = async () => {}) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await page.goto(base);
  await page.locator('canvas').waitFor();
  await page.waitForTimeout(3000); // textures and the first frames
  await prepare(page);
  await page.screenshot({path: `${OUT}/${name}.png`});
  await context.close();
  console.log(`✔ ${name}.png`);
}

await shoot({viewport: {width: 1440, height: 900}}, 'desktop');
await shoot({viewport: {width: 1440, height: 900}}, 'saturn', async (page) => {
  await page.locator('[data-planet="saturn"]').click();
  await page.waitForTimeout(2500);
});
await shoot({...devices['Pixel 7'], deviceScaleFactor: 2}, 'mobile');

await browser.close();
if (server?.pid) {
  process.kill(-server.pid);
}
