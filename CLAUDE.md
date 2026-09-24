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

- **`CONFIG` drives everything.** Camera, renderer, controls, focus behaviour, the Sun, stars, orbits, and `CONFIG.planets` (size, distance, speeds, description). The UI planet buttons are built from the same object, so adding a planet to `CONFIG.planets` and `TEXTURES` adds it to the scene _and_ the panel.
- **Loading.** A `THREE.LoadingManager` drives the progress bar (`#loader-bar`, `#loader-status`); `hideLoader()` removes it when every texture has loaded. Texture URLs are built from `import.meta.env.BASE_URL`, which is relative (`./`) in builds.
- **Structure of a planet.** An orbit pivot (a rotating `Object3D` at the Sun) holds the planet mesh at its distance. Earth has a second, transparent cloud sphere rotating on its own. The Moon has its own pivot on Earth. Saturn gets a ring mesh with a transparent texture.
- **Animation** is driven by elapsed time, multiplied by the simulation speed, so it is frame-rate independent. Pause sets the speed multiplier to zero and keeps rendering, so the controls still work.
- **Focus** reads the planet's world position and moves the camera and the `OrbitControls` target towards it.
- **Unsupported WebGL** shows an explicit message (`showUnsupportedMessage()`) instead of a blank page.

## 6. Invariants - do not break

1. Asset URLs always go through `BASE_URL`. Never use absolute `/textures/...`, because the site lives under `/threejs-solar-system/`.
2. Keep `CONFIG.planets` and `TEXTURES` keys in sync; the UI and the smoke tests use the keys (`data-planet="saturn"`).
3. The UI element ids (`#planet-name`, `#pause-button`, `#speed`, `#speed-value`, `#loader`) are used by the tests.
4. Texture credits (CC BY 4.0) stay in the README.
5. Pixel ratio is capped (`getPixelRatio()`) for performance on HiDPI screens.

## 7. Testing guide

`e2e/smoke.spec.js`: the textures load and the loader disappears; focusing Saturn updates the panel; pause and speed controls respond. Each test fails on any uncaught error or console error. Assert behaviour and DOM state, not pixels.

## 8. Recipes

- **Add a planet:** add an entry to `CONFIG.planets` (radius, distance, orbit and rotation speed, description) and a texture in `TEXTURES` and `public/textures/<name>/`, as WebP.
- **Change the look:** tweak `CONFIG` first; the factories read from it.

## CI/CD

The jobs are _Lint and types_ (formatting and lint), _Build_ (uploads `dist/`), _End-to-end_ (the smoke tests against that exact build), and _Deploy to GitHub Pages_, which publishes the same artifact from `master` after the gates pass. One-time setup is listed at the top of `.github/workflows/ci.yml`: Pages source "GitHub Actions", and the `github-pages` environment allowing `master`.

## Troubleshooting

| Symptom                                                         | Cause / fix                                                                                                                                           |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| E2E: `ERR_HTTP_RESPONSE_CODE_FAILURE` or the wrong app          | another project's preview server is still on the port (`reuseExistingServer`); each repository has its own port (4174 here), so stop the stray server |
| Playwright: "Executable doesn't exist"                          | `npm run e2e:install`, or `CHROMIUM_PATH=/path/to/chrome`                                                                                             |
| Black canvas in headless screenshots                            | software WebGL is slow; the scripts wait for the first frames, so increase the wait before adding flags                                               |
| Deploy rejected: "branch not allowed to deploy to github-pages" | Settings → Environments → github-pages → allow `master`                                                                                               |

## Known limitations

- Circular orbits and stylised sizes and distances (see the roadmap in the README).
- The camera does not keep tracking a focused planet as it moves along its orbit.

## House style (identical in every repository of this portfolio)

These five repositories are written as one body of work: [cosmos-stories](https://github.com/stiutin/cosmos-stories), [larder](https://github.com/stiutin/larder), [pixi-neon-district](https://github.com/stiutin/pixi-neon-district), [threejs-solar-system](https://github.com/stiutin/threejs-solar-system) and [threejs-icosphere](https://github.com/stiutin/threejs-icosphere). Keep them alike. When a convention changes, change it everywhere.

**Shared files.** `LICENSE` (MIT, Serge Tiutin), `.editorconfig`, `.gitattributes`, `.nvmrc` (`24`), `.prettierrc`, `.prettierignore`, `.gitignore`, `.vscode/`, `.github/dependabot.yml` and the issue and PR templates are identical across the repositories, apart from a clearly marked `# Project` block at the end of the ignore files.

**Formatting.** Prettier: 120 columns, single quotes, no spaces inside braces (`{a, b}`), trailing commas where ES5 allows them, always parenthesised arrow parameters. `npm run format` fixes everything, and `npm run format:check` runs in CI. ESLint does not format.

**Linting.** `eslint.config.mjs` with `defineConfig`, and two shared blocks:

- `HOUSE_RULES`: sorted imports and exports (`simple-import-sort`), no unused imports, `curly: all`, arrow bodies only where needed, no `console` except `warn` and `error`;
- `HOUSE_TS_RULES` in TypeScript projects: explicit `public`/`protected`/`private` on every class member (never on constructors), `T[]` rather than `Array<T>`, and unused variables allowed only as `_`.

`eslint-config-prettier` comes last. Each project adds its own strictness on top: `typescript-eslint` strict-type-checked in cosmos-stories and pixi-neon-district, Larder's own rule set (magic numbers, naming, member ordering, RxJS) in larder. Styles are linted by Stylelint with properties in alphabetical order; `-webkit-backdrop-filter` and `-webkit-user-select` stay, for Safari.

**`package.json`.** The field order is name, version, description, license, author, repository, homepage, keywords, private, type, engines, scripts, dependencies, devDependencies. Dependencies are sorted, and `engines.node` is `>=22.22.3`. Scripts use the same names everywhere:

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

**CI.** `.github/workflows/ci.yml` with the same job names: _Lint and types_, _Unit tests_, _Build_, _End-to-end (Playwright)_, _Lighthouse_ (Angular projects), _Deploy to GitHub Pages_. It runs on `ubuntu-24.04`, reads the Node version from `.nvmrc`, and uses the same action versions everywhere. Deploys go from `master` only, and only after the gates pass. The header of the workflow lists the one-time repository settings; the `github-pages` environment must allow `master`.

**Documentation.** The README follows one outline: title, one line, a paragraph, **Open the live demo**, screenshots, then _Features_, _Tech stack_, _How it works_, _Testing_ (a table), _Project structure_, _Running locally_, _Deployment_, _Roadmap_, _License_, _Author_. The voice is calm and specific, in British English, with no badges and no marketing adjectives. Explain _why_ in prose. There is no CHANGELOG and no ADR folder: decisions live in _How it works_ and in this file. `.github/social-preview.png` (1280×640) is the repository's social preview, and every project uses the same design.

**Scripts and tooling.** Node scripts are `.mjs`. TypeScript scripts run through Node's type stripping, and are used only when they share code with the app (cosmos-stories). Scripts have a header comment with usage examples.
