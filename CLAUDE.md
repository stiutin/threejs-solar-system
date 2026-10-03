# CLAUDE.md

Working notes for AI assistants (and humans) on this repository. Read this first: what the project is, how it is built, which rules must not be broken, and how to verify a change. When something here gets out of date, fix this file in the same change.

## 1. What this is

**Three.js Solar System** is an interactive 3D solar system in the browser: eight textured planets orbit a glowing Sun against a procedural star field. Orbit controls, a panel to focus a planet (with a short description), a simulation speed from 0× to 5×, pause, and camera reset.

- Live: `https://stiutin.github.io/threejs-solar-system/`
- It is a **portfolio project**: small, readable, well-configured code over feature count.

## 2. Toolchain

| Tool    | Version                                                                                                    | Notes                                       |
| ------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Node.js | 24 (`.nvmrc`), `engines` `>=22.22.3`                                                                       |                                             |
| three   | 0.186                                                                                                      | `OrbitControls` from `three/addons`         |
| Vite    | 8                                                                                                          | relative `base: './'`; preview on port 4174 |
| Tests   | Playwright 1.63                                                                                            | smoke tests against the production build    |
| Lint    | ESLint 10 (`eslint.config.mjs`, JavaScript rules), Stylelint 17 (CSS, alphabetical properties), Prettier 3 |                                             |

Plain JavaScript (ES modules), no framework, no TypeScript. JSDoc where it helps. A TypeScript migration is on the roadmap.

## 3. Commands

```bash
npm start              # Vite dev server
npm run build          # production build into dist/
npm run serve          # serve dist/ (port 4174)
npm run e2e            # build, then the Playwright smoke tests (desktop + Pixel 7); `npm run e2e:install` once
npm run e2e:run        # the tests only, against the existing build
npm run screenshots    # .github/screenshots/*.png from a fresh build
npm run lint           # ESLint + Stylelint
npm run format         # Prettier
npm run check          # format:check + lint  ← before finishing
```

**Definition of done:** `npm run check` is green, `npm run e2e` is green, and the README and this file are still accurate. Visual changes: regenerate the screenshots.

## 4. Repository map

```
src/main.js      everything: CONFIG, TEXTURES, loading manager, scene/camera/renderer/controls factories,
                 Sun, stars, orbits, planets (Earth with clouds, Moon, Saturn rings), UI, animation loop
src/style.css    UI panel, loader, responsive layout
public/textures/ planet textures (WebP, CC BY 4.0, Solar System Scope)
e2e/             Playwright smoke tests
scripts/         README screenshots
```

## 5. Architecture

- **`CONFIG` drives everything.** Camera, renderer, controls, focus behaviour, the Sun, stars, orbits, and `CONFIG.planets` (radius in km, J2000 orbital elements, axial tilt, speeds, description), with `CONFIG.scale` turning kilometres and AU into scene units. The UI planet buttons are built from the same object, so adding a planet to `CONFIG.planets` and `TEXTURES` adds it to the scene _and_ the panel. Materials, the ambient light, Earth's cloud shell, Saturn's ring and `CONFIG.simulation.timeScale` (which turns the config's speeds into radians per second, through `simulationStep`) live there too: no number in the code below `CONFIG` is a tuning value.
- **Loading.** A `THREE.LoadingManager` drives the progress bar (`#loader-bar`, `#loader-status`); `hideLoader()` removes it when every texture has loaded. Texture URLs are built from `import.meta.env.BASE_URL`, which is relative (`./`) in builds. With reduced motion there is no fade and so no `transitionend`, so the loader is removed at once rather than left at opacity 0, where screen readers would still read it.
- **Structure of a planet.** An anchor `Object3D`, added to the scene in config order, is placed on the planet's ellipse every frame; under it, a tilt group carries the real axial tilt and holds the spinning mesh. Earth has a second, transparent cloud sphere rotating on its own, and the Moon a pivot on the anchor. Saturn's ring is a child of its mesh, so it shares Saturn's tilt.
- **Orbits.** `orbitGeometry` turns the elements into `semiMajor`, `semiMinor`, `eccentricity`, two plane directions (`towardsPerihelion`, `quarterOnward`) and the J2000 `startingMeanAnomaly`. `updatePlanetRotation` advances `planet.meanAnomaly` by `orbitSpeed` × `simulationStep`, and `placeOnOrbit` solves Kepler's equation (`solveKepler`, Newton's method) and writes the position with `pointOnOrbit`. `createOrbit` traces the line through `pointOnOrbit` too. `sceneRadius` converts kilometres; `planet.radius` holds the result, and nothing reads a radius from the config directly.
- **Animation** is driven by elapsed time, multiplied by the simulation speed, so it is frame-rate independent. Pause sets the speed multiplier to zero and keeps rendering, so the controls still work.
- **Panel.** `createUI` puts the header first and wraps every other section (`planetListMarkup`, `planetInfoMarkup`, `labelsControlMarkup`, `speedControlMarkup`, `actionsMarkup`) in `#panel-body`; `queryUIElements` collects what the code updates and `bindUIEvents` wires it. `setPanelFolded` sets `data-folded`, the toggle's `aria-expanded` and text, and the summary; `focusPlanet` folds the panel when `phoneLayout` (the same `width <= 640px` as style.css) matches. The CSS folds only inside that media query.
- **Focus and follow.** `focusPlanet` sets `state.followed`, computes where the camera ends relative to the planet (`focusOffset`: on the sunlit side, `CONFIG.focus.sideAngle` around from the Sun's direction and `elevation` above the orbit, never on the night side) and starts `state.flight` (or jumps, with reduced motion). Each frame `updateFollow` either advances the flight (`updateFlight`, eased, towards the planet's current position, controls disabled) or rides along (`rideAlong`: camera and target turned around the Y axis by the angle the planet travelled, then moved with it). `stopFollowing` leaves the camera where it is. `updateFollowUI` keeps `#follow-button` (`aria-pressed`) and the `#follow-status` live region in step. During the flight the landing offset turns with the planet's orbit angle (`flight.startAngle`), so a planet that moves on during a long flight is still met on its sunlit side, and no frame advances the flight by more than `CONFIG.focus.maxFlightStep`.
- **Picking.** `enablePicking` listens to the canvas. `handlePointerDown`/`handlePointerUp` treat a press and release within `CONFIG.picking.clickTolerance` pixels as a click and call `planetUnder`, which raycasts against every planet's anchor (recursively) and maps the hit to `anchor.userData.planet` through `planetOf`; if nothing is hit, `planetNear` takes the planet whose projected centre is within `CONFIG.picking.nearMiss` pixels. `handleHover` sets the canvas cursor and `title`, once per animation frame.
- **Labels.** `createLabelRenderer` (a `CSS2DRenderer`, created before the render loop starts) draws `.labels` over the canvas; `addLabels` hangs a `CSS2DObject` from each planet's anchor, `CONFIG.labels.offset` radii above it. `animate` renders it after the WebGL scene and `resize` resizes it. The layer has `pointer-events: none` and each `.planet-label` `auto`; a label click calls `focusPlanet`. `#labels-toggle` hides the whole layer.
- **Bloom.** `createPostProcessing` builds a half-resolution `EffectComposer` (`RenderPass` + `UnrealBloomPass`) and a full-screen additive quad in its own scene. `renderScene` draws the scene to the screen, then `renderBloom` swaps every material outside `BLOOM_LAYER` (only the Sun is on it) for a black stand-in, sets a black background and no fog, renders the composer, and restores everything; the quad adds the glow. `setBloom` switches it and shows the old halo (`sunGlow`) instead. `resizePostProcessing` keeps the composer at half the window.
- **Unsupported WebGL** shows an explicit message (`showUnsupportedMessage()`) instead of a blank page.

## 6. Invariants - do not break

1. Asset URLs always go through `BASE_URL`. Never use absolute `/textures/...`, because the site lives under `/threejs-solar-system/`.
2. Keep `CONFIG.planets` and `TEXTURES` keys in sync; the UI and the smoke tests use the keys (`data-planet="saturn"`).
3. The UI element ids (`#planet-name`, `#pause-button`, `#speed`, `#speed-value`, `#loader`, `#follow-button`, `#follow-status`, `#panel-toggle`, `#panel-summary`, `#labels-toggle`, `#bloom-toggle`, `.planet-label`) are used by the tests.
4. Texture credits (CC BY 4.0) stay in the README.
5. Pixel ratio is capped (`getPixelRatio()`) for performance on HiDPI screens.
6. **Planets in config order.** `init` registers the planets and adds their anchors to the scene in `CONFIG.planets` order, after every texture has loaded; labels, picking and the panel rely on it. Do not register a planet inside `createPlanet`, where textures decide the order.

## 7. Conventions (project-specific)

- **One config:** sizes, distances, speeds, colours and counts live in `CONFIG` at the top of `src/main.js`; the scene and the UI are both built from it.
- **Real data, one scale:** planets are described in kilometres, AU and degrees, as published; only `CONFIG.scale` and the values marked stylised are choices of this project.
- **Time:** every animated value is multiplied by the frame delta and the speed multiplier, never by a per-frame constant.
- **Plain JavaScript:** ES modules, no framework, no UI library; the UI is created in code and styled with plain CSS.

## 8. Testing guide

`e2e/smoke.spec.js`: the textures load and the loader disappears; focusing Saturn updates the panel; pause and speed controls respond. Each test fails on any uncaught error or console error. Assert behaviour and DOM state, not pixels. Following is checked with `centreBrightness()`, the average brightness of a square at the centre of a screenshot (WebGL keeps no drawing buffer to read): high while a planet is followed, low once it is released. Thresholds leave room for night sides and software rendering; transient states such as the flight are checked through the status text, since screenshots of software WebGL are too slow to time. Scene clicks use `centreOn()`: focus a planet from the panel, stop the planets and release the follow, which leaves the planet in the middle of the view to click, drag or hover; on a phone `openPanel()` and `foldPanel()` open the panel to use it and fold it to free the middle of the view. Labels move every frame, so a label click is dispatched to the element rather than waiting for it to settle; scene tests are marked `test.slow()` for software WebGL.

## 9. Recipes

- **Add a planet:** add an entry to `CONFIG.planets` (radius in km, the six J2000 orbital elements, axial tilt, orbit and rotation speed, description) and a texture in `TEXTURES` and `public/textures/<name>/`, as WebP.
- **Change the look:** tweak `CONFIG` first; the factories read from it.

## 10. CI/CD

The jobs are _Lint and types_ (formatting and lint), _Build_ (uploads `dist/`), _End-to-end_ (the smoke tests against that exact build), and _Deploy to GitHub Pages_, which publishes the same artifact from `master` after the gates pass. One-time setup is listed at the top of `.github/workflows/ci.yml`: Pages source "GitHub Actions", and the `github-pages` environment allowing `master`.

## 11. Troubleshooting

| Symptom                                                         | Cause / fix                                                                                                                                           |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| E2E: `ERR_HTTP_RESPONSE_CODE_FAILURE` or the wrong app          | another project's preview server is still on the port (`reuseExistingServer`); each repository has its own port (4174 here), so stop the stray server |
| Playwright: "Executable doesn't exist"                          | `npm run e2e:install`, or `CHROMIUM_PATH=/path/to/chrome`                                                                                             |
| Black canvas in headless screenshots                            | software WebGL is slow; the scripts wait for the first frames, so increase the wait before adding flags                                               |
| Deploy rejected: "branch not allowed to deploy to github-pages" | Settings → Environments → github-pages → allow `master`                                                                                               |

## 12. Known limitations

- Bloom renders the scene a second time at half resolution, plus the blur passes. Software WebGL (as in CI) runs it slowly, which is why the end-to-end timeouts are generous; the panel switch turns it off on slow devices.
- The Sun's size, the Moon's distance and the orbital and spin speeds are stylised (see How it works in the README); distances are compressed by a square root.

## House style (identical in every repository of this portfolio)

These six repositories are written as one body of work: [cosmos-stories](https://github.com/stiutin/cosmos-stories), [larder](https://github.com/stiutin/larder), [livery](https://github.com/stiutin/livery), [pixi-neon-district](https://github.com/stiutin/pixi-neon-district), [threejs-solar-system](https://github.com/stiutin/threejs-solar-system) and [threejs-icosphere](https://github.com/stiutin/threejs-icosphere). Keep them alike. When a convention changes, change it everywhere.

**Shared files.** `LICENSE` (MIT, Serge Tiutin), `.editorconfig`, `.gitattributes`, `.nvmrc` (`24`), `.prettierrc`, `.prettierignore`, `.gitignore`, `.vscode/`, `.github/dependabot.yml` and the issue and PR templates are identical across the repositories, apart from a clearly marked `# Project` block at the end of the ignore files.

**Formatting.** Prettier: 120 columns, single quotes, no spaces inside braces (`{a, b}`), trailing commas where ES5 allows them, always parenthesised arrow parameters. `npm run format` fixes everything, and `npm run format:check` runs in CI. ESLint does not format.

**Linting.** `eslint.config.mjs` with `defineConfig`, and two shared blocks:

- `HOUSE_RULES`: sorted imports and exports (`simple-import-sort`), no unused imports, `curly: all`, arrow bodies only where needed, no `console` except `warn` and `error`;
- `HOUSE_TS_RULES` in TypeScript projects: explicit `public`/`protected`/`private` on every class member (never on constructors), explicit return types on every exported function, no `any`, `T[]` rather than `Array<T>`, and unused variables allowed only with a leading `_`.

`eslint-config-prettier` comes last. Each project adds its own strictness on top: `typescript-eslint` strict-type-checked in cosmos-stories, livery and pixi-neon-district (livery adds the React hooks and Fast Refresh rules), Larder's own rule set (magic numbers, naming, member ordering, RxJS) in larder. Styles are linted by Stylelint with properties in alphabetical order; `-webkit-backdrop-filter` and `-webkit-user-select` stay, for Safari.

**`package.json`.** The field order is name, version, description, license, author, repository, homepage, keywords, private, type, engines, workspaces (in monorepos), scripts, dependencies, devDependencies. Dependencies are sorted, and `engines.node` is `>=22.22.3`. Scripts use the same names everywhere:

| Script                                       | Meaning                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `start`                                      | dev server                                                                |
| `build`                                      | production build                                                          |
| `serve`                                      | serve the production build like GitHub Pages does                         |
| `test` / `test:watch`                        | unit tests (where the project has them)                                   |
| `e2e` / `e2e:run` / `e2e:ui` / `e2e:install` | Playwright: build and test / test only / UI mode / download Chromium      |
| `screenshots`                                | regenerate `.github/screenshots/*.png` for the README                     |
| `lint` / `lint:fix`                          | ESLint and Stylelint                                                      |
| `typecheck`                                  | TypeScript (TypeScript projects)                                          |
| `format` / `format:check`                    | Prettier                                                                  |
| `check`                                      | everything CI checks before building: formatting, lint, types, unit tests |

**TypeScript.** Every TypeScript project has `strict` plus `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch` and `noUncheckedIndexedAccess`. Projects may add more (cosmos-stories: `noPropertyAccessFromIndexSignature`; pixi-neon-district: `exactOptionalPropertyTypes`, unused locals and parameters).

**Dependencies.** The latest versions, with deliberate exceptions noted in each CLAUDE.md. In particular, TypeScript stays on 6.0 because `typescript-eslint` and Angular 22 do not support 7.0 yet.

**Tests.** Every project has Playwright tests against its production build, on a desktop and a Pixel 7 viewport, served the way GitHub Pages serves it. `CHROMIUM_PATH` points Playwright and the screenshot scripts at a specific browser binary (useful in sandboxes). Projects with logic worth isolating also have Vitest unit tests.

**CI.** `.github/workflows/ci.yml` with the same job names: _Lint and types_, _Unit tests_, _Build_, _End-to-end (Playwright)_, _Lighthouse_ (Angular projects and livery), _Visual regression_ (livery, in the Playwright container), _Deploy to GitHub Pages_. It runs on `ubuntu-24.04`, reads the Node version from `.nvmrc`, and uses the same action versions everywhere. Deploys go from `master` only, and only after the gates pass. The header of the workflow lists the one-time repository settings; the `github-pages` environment must allow `master`.

**Documentation.** The README follows one outline: title, one line, a paragraph, **Open the live demo**, screenshots, then _Features_, _Tech stack_, _How it works_, _Testing_ (a table), _Project structure_, _Running locally_, _Deployment_, _Roadmap_, _Credits_ (only where the project uses other people's content), _License_, _Author_. The roadmap lists only what comes next; what is done is described in the sections above it. The voice is calm and specific, in British English, with no badges and no marketing adjectives. Explain _why_ in prose. `CLAUDE.md` follows one outline too: 1. What this is, 2. Toolchain, 3. Commands, 4. Repository map, 5. Architecture, 6. Invariants - do not break, 7. Conventions (project-specific), 8. Testing guide, 9. Recipes, 10. CI/CD, 11. Troubleshooting, 12. Known limitations, then this section, word for word. Both describe the project as it is, not how it got there. There is no CHANGELOG and no ADR folder: decisions live in _How it works_ and in this file. `.github/social-preview.png` (1280×640) is the repository's social preview, and every project uses the same design.

**Scripts and tooling.** Node scripts are `.mjs`. TypeScript scripts run through Node's type stripping, and are used only when they share code with the app (cosmos-stories, livery). Scripts have a header comment with usage examples.

### Code style

The rules every change follows, in every language of the portfolio. The list grows: add a rule here, in every repository at once.

1. **Comments are meaningful.** A comment says why the code is the way it is, or what a reader could not know from the code: a browser quirk, a spec, a trade-off. When the code already says what it does, it needs no comment.
2. **Names explain themselves.** A variable, a function or a type is named after what it is for (`unpaidInvoices`, `formatMoney`, `TenantRouteData`), so its role is clear without a comment. No abbreviations beyond the common ones (`id`, `url`, `i18n`).
3. **Return early.** Handle the invalid, empty and error cases first and leave the function; the main path then reads without nesting. No `else` after a `return`.
4. **One function, one job.** A function does one thing, and its name says which. When a name needs "and", or a block needs a comment to say what it does, it becomes a function of its own.

**TypeScript.**

- Strict mode is on everywhere, with the extra flags listed above.
- Never use `any`. Use `unknown` for a value whose type is not known yet, and narrow it with a check or a type guard. `no-explicit-any` enforces it.
- Every exported function states its return type, and so does every API route handler, loader and action. `explicit-module-boundary-types` enforces it; an inferred type is fine for local functions.
