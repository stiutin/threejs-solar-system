import './style.css';

import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const BASE_URL = import.meta.env.BASE_URL;

const CONFIG = {
  camera: {
    fov: 50,
    near: 0.1,
    far: 1000,
    position: new THREE.Vector3(32, 24, 42),
  },
  renderer: {
    antialias: true,
    maxPixelRatio: 2,
  },
  controls: {
    dampingFactor: 0.05,
    minDistance: 5,
    maxDistance: 150,
  },
  focus: {
    // Camera distance when focusing a planet, as a multiple of its radius.
    distanceFactor: 6,
    minDistance: 1.5,
    // How close the user may then zoom in, as a multiple of the radius.
    clearanceFactor: 2.5,
  },
  scene: {
    background: 0x02030a,
    fogColor: 0x02030a,
    fogNear: 80,
    fogFar: 250,
  },
  sun: {
    radius: 2,
    color: 0xffd27d,
    intensity: 3,
    glow: {
      color: 0xffb347,
      scale: 1.35,
      opacity: 0.15,
    },
  },
  stars: {
    count: 5000,
    radius: 180,
    size: 0.12,
    opacity: 0.8,
  },
  orbit: {
    segments: 128,
    color: 0x9aa4bd,
    opacity: 0.55,
  },
  planets: {
    mercury: {
      radius: 0.22,
      distance: 4,
      orbitSpeed: 1.6,
      rotationSpeed: 1.8,
      color: 0x9a9a9a,
      description: 'The smallest planet and the closest to the Sun.',
    },
    venus: {
      radius: 0.38,
      distance: 6,
      orbitSpeed: 1.2,
      rotationSpeed: 0.5,
      color: 0xc88b4a,
      description: 'A hot planet covered by a dense atmosphere.',
    },
    earth: {
      radius: 0.42,
      distance: 8,
      orbitSpeed: 1,
      rotationSpeed: 2,
      axialTilt: 23.4,
      description: 'Our home planet, with liquid water and life.',
    },
    mars: {
      radius: 0.32,
      distance: 10,
      orbitSpeed: 0.8,
      rotationSpeed: 1.9,
      color: 0xb84f35,
      description: 'The red planet with a cold, rocky surface.',
    },
    jupiter: {
      radius: 1.05,
      distance: 14,
      orbitSpeed: 0.45,
      rotationSpeed: 4,
      color: 0xc98b62,
      description: 'The largest planet in the Solar System.',
    },
    saturn: {
      radius: 0.9,
      distance: 19,
      orbitSpeed: 0.32,
      rotationSpeed: 3.6,
      color: 0xd8b889,
      description: 'A gas giant famous for its spectacular rings.',
    },
    uranus: {
      radius: 0.62,
      distance: 24,
      orbitSpeed: 0.23,
      rotationSpeed: 2.5,
      color: 0x7fd6df,
      description: 'An ice giant with an extreme axial tilt.',
    },
    neptune: {
      radius: 0.6,
      distance: 29,
      orbitSpeed: 0.18,
      rotationSpeed: 2.7,
      color: 0x4169e1,
      description: 'A distant blue ice giant with powerful winds.',
    },
  },
  moon: {
    radius: 0.12,
    distance: 0.9,
    orbitSpeed: 1.8,
    rotationSpeed: 1.8,
  },
};

const TEXTURES = {
  mercury: {
    map: `${BASE_URL}textures/mercury/mercury.webp`,
  },
  venus: {
    map: `${BASE_URL}textures/venus/venus.webp`,
  },
  earth: {
    day: `${BASE_URL}textures/earth/earth_day.webp`,
    clouds: `${BASE_URL}textures/earth/earth_clouds.webp`,
  },
  moon: {
    map: `${BASE_URL}textures/moon/moon.webp`,
  },
  mars: {
    map: `${BASE_URL}textures/mars/mars.webp`,
  },
  jupiter: {
    map: `${BASE_URL}textures/jupiter/jupiter.webp`,
  },
  saturn: {
    map: `${BASE_URL}textures/saturn/saturn.webp`,
    rings: `${BASE_URL}textures/saturn/saturn_ring.webp`,
  },
  uranus: {
    map: `${BASE_URL}textures/uranus/uranus.webp`,
  },
  neptune: {
    map: `${BASE_URL}textures/neptune/neptune.webp`,
  },
};

const state = {
  paused: false,
  speed: 1,
  selectedPlanet: 'earth',
  // Planet the camera is currently riding along with, if any.
  followed: null,
};

const followPosition = new THREE.Vector3();
const followDelta = new THREE.Vector3();
const lastFollowPosition = new THREE.Vector3();
const scene = createScene();
const camera = createCamera();
// Created in init() rather than here: the WebGLRenderer constructor throws
// when no context is available, and at module scope that would kill the
// script before anything could tell the user why.
let renderer = null;
let controls = null;
const timer = new THREE.Timer();
const planets = new Map();
const loadingManager = createLoadingManager();
const textureLoader = new THREE.TextureLoader(loadingManager);

let uiElements = null;

function countTextures() {
  return Object.values(TEXTURES).reduce((total, entry) => total + Object.keys(entry).length, 0);
}

function createLoadingManager() {
  const manager = new THREE.LoadingManager();
  const total = countTextures();

  const bar = document.getElementById('loader-bar');
  const track = document.getElementById('loader-track');
  const status = document.getElementById('loader-status');

  manager.onProgress = (url, loaded) => {
    // The manager's own itemsTotal grows as dependent textures (the Moon,
    // Saturn's rings) are queued, so the known file count is used instead.
    const percent = Math.round((Math.min(loaded, total) / total) * 100);

    bar.style.transform = `scaleX(${percent / 100})`;
    status.textContent = `Loading textures ${percent}%`;
    track.setAttribute('aria-valuenow', String(percent));
  };

  manager.onError = (url) => {
    status.textContent = 'Some textures failed to load';
    console.error('Failed to load asset:', url);
  };

  return manager;
}

function showUnsupportedMessage() {
  const track = document.getElementById('loader-track');
  const status = document.getElementById('loader-status');

  if (track) track.remove();
  if (status) {
    status.textContent = 'This browser or device does not support WebGL 2, which the scene needs to render.';
    status.classList.add('loader__status--error');
  }
}

function hideLoader() {
  const loader = document.getElementById('loader');

  if (!loader) return;

  loader.classList.add('loader--hidden');
  loader.addEventListener('transitionend', () => loader.remove(), {
    once: true,
  });
}

function createScene() {
  const scene = new THREE.Scene();

  scene.background = new THREE.Color(CONFIG.scene.background);
  scene.fog = new THREE.Fog(CONFIG.scene.fogColor, CONFIG.scene.fogNear, CONFIG.scene.fogFar);

  return scene;
}

function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    CONFIG.camera.near,
    CONFIG.camera.far
  );

  camera.position.copy(CONFIG.camera.position);

  return camera;
}

function createRenderer() {
  const renderer = new THREE.WebGLRenderer({
    antialias: CONFIG.renderer.antialias,
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(getPixelRatio());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  document.body.appendChild(renderer.domElement);

  return renderer;
}

function createControls() {
  const controls = new OrbitControls(camera, renderer.domElement);

  controls.enableDamping = true;
  controls.dampingFactor = CONFIG.controls.dampingFactor;
  controls.minDistance = CONFIG.controls.minDistance;
  controls.maxDistance = CONFIG.controls.maxDistance;

  return controls;
}

function getPixelRatio() {
  return Math.min(window.devicePixelRatio, CONFIG.renderer.maxPixelRatio);
}

function loadTexture(path, colorSpace = THREE.SRGBColorSpace) {
  return textureLoader.loadAsync(path).then((texture) => {
    texture.colorSpace = colorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    return texture;
  });
}

function createSphere(radius, material, widthSegments = 64, heightSegments = 32) {
  const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);

  return new THREE.Mesh(geometry, material);
}

function createSun() {
  const sun = createSphere(
    CONFIG.sun.radius,
    new THREE.MeshBasicMaterial({
      color: CONFIG.sun.color,
    })
  );
  const glow = createSphere(
    CONFIG.sun.radius * CONFIG.sun.glow.scale,
    new THREE.MeshBasicMaterial({
      color: CONFIG.sun.glow.color,
      transparent: true,
      opacity: CONFIG.sun.glow.opacity,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  const light = new THREE.PointLight(0xffffff, CONFIG.sun.intensity, 0, 0);

  sun.add(glow);
  sun.add(light);
  scene.add(sun);

  return sun;
}

function createAmbientLight() {
  const light = new THREE.AmbientLight(0x9fb7d9, 0.22);

  scene.add(light);
}

function createStars() {
  const positions = new Float32Array(CONFIG.stars.count * 3);

  for (let i = 0; i < CONFIG.stars.count; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    const index = i * 3;
    const radius = CONFIG.stars.radius;

    positions[index] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index + 1] = radius * Math.cos(phi);
    positions[index + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: CONFIG.stars.size,
    sizeAttenuation: true,
    transparent: true,
    opacity: CONFIG.stars.opacity,
  });
  const stars = new THREE.Points(geometry, material);

  scene.add(stars);

  return stars;
}

function createOrbit(distance) {
  const curve = new THREE.EllipseCurve(0, 0, distance, distance, 0, Math.PI * 2, false, 0);

  const points = curve.getPoints(CONFIG.orbit.segments);

  const geometry = new THREE.BufferGeometry().setFromPoints(points.map(({x, y}) => new THREE.Vector3(x, 0, y)));

  const material = new THREE.LineBasicMaterial({
    color: CONFIG.orbit.color,
    transparent: true,
    opacity: CONFIG.orbit.opacity,
  });

  const orbit = new THREE.LineLoop(geometry, material);

  scene.add(orbit);

  return orbit;
}

async function createEarth(config) {
  const [dayTexture, cloudsTexture] = await Promise.all([
    loadTexture(TEXTURES.earth.day),
    loadTexture(TEXTURES.earth.clouds),
  ]);

  const earth = createSphere(
    config.radius,
    new THREE.MeshPhongMaterial({
      map: dayTexture,
      shininess: 15,
    })
  );

  const clouds = createSphere(
    config.radius * 1.015,
    new THREE.MeshPhongMaterial({
      // Used as alphaMap rather than map: as a colour map the black areas of
      // the texture are not transparent, they are dark, and they shade the
      // whole planet instead of leaving the cloudless parts clear.
      alphaMap: cloudsTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    })
  );

  earth.add(clouds);

  return {mesh: earth, clouds};
}

async function createTexturedPlanet(name, config) {
  const texturePath = TEXTURES[name]?.map;

  const texture = texturePath ? await loadTexture(texturePath) : null;

  const material = new THREE.MeshPhongMaterial({
    map: texture,
    color: texture ? 0xffffff : config.color,
    shininess: 8,
  });

  const planet = createSphere(config.radius, material);

  if (name === 'saturn') await createSaturnRings(planet);

  return planet;
}

async function createMoon(anchor) {
  const texture = await loadTexture(TEXTURES.moon.map);

  const moon = createSphere(
    CONFIG.moon.radius,
    new THREE.MeshPhongMaterial({
      map: texture,
    })
  );

  moon.position.x = CONFIG.moon.distance;

  const pivot = new THREE.Object3D();

  // Attached to the anchor rather than to Earth itself: a pivot parented to
  // the planet mesh would inherit both its axial tilt and its daily spin,
  // which would whip the Moon around once per Earth day.
  anchor.add(pivot);
  pivot.add(moon);

  return {mesh: moon, pivot};
}

async function createSaturnRings(saturn) {
  const texture = await loadTexture(TEXTURES.saturn.rings);
  const geometry = new THREE.RingGeometry(1.05, 1.75, 128);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const rings = new THREE.Mesh(geometry, material);

  rings.rotation.x = Math.PI / 2;
  rings.scale.setScalar(CONFIG.planets.saturn.radius);

  saturn.add(rings);

  return rings;
}

async function createPlanet(name, config) {
  const orbitPivot = new THREE.Object3D();

  scene.add(orbitPivot);
  createOrbit(config.distance);

  const isEarth = name === 'earth';
  const planetObject = isEarth
    ? await createEarth(config)
    : {
        mesh: await createTexturedPlanet(name, config),
        clouds: null,
      };

  const {mesh, clouds} = planetObject;

  // The anchor carries the planet's position along the orbit and nothing
  // else, so satellites parented to it are unaffected by tilt and spin.
  const anchor = new THREE.Object3D();

  anchor.position.x = config.distance;
  orbitPivot.add(anchor);

  // The tilt sits on a parent of the mesh. Setting both rotation.z (tilt)
  // and rotation.y (spin) on the same object composes them in Euler XYZ
  // order, which spins the planet around the world axis and makes the poles
  // precess once per rotation instead of staying tilted.
  const tiltGroup = new THREE.Object3D();

  if (config.axialTilt) {
    tiltGroup.rotation.z = THREE.MathUtils.degToRad(config.axialTilt);
  }

  anchor.add(tiltGroup);
  tiltGroup.add(mesh);

  const planet = {name, config, mesh, anchor, orbitPivot, clouds, moon: null};

  if (isEarth) planet.moon = await createMoon(anchor);

  planets.set(name, planet);

  return planet;
}

function updatePlanetInfo() {
  const planet = planets.get(state.selectedPlanet);

  if (!planet || !uiElements) return;

  uiElements.planetName.textContent = formatPlanetName(state.selectedPlanet);
  uiElements.planetDescription.textContent = planet.config.description;
}

function updateActivePlanetButton() {
  if (!uiElements) return;

  uiElements.planetButtons.forEach((button) => {
    const isActive = button.dataset.planet === state.selectedPlanet;

    button.classList.toggle('planet-button--active', isActive);
  });
}

function formatPlanetName(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function focusPlanet(name) {
  const planet = planets.get(name);

  if (!planet) return;

  state.selectedPlanet = name;
  state.followed = name;

  planet.mesh.getWorldPosition(followPosition);
  lastFollowPosition.copy(followPosition);
  controls.target.copy(followPosition);

  const direction = new THREE.Vector3().subVectors(camera.position, followPosition);

  // Guard against the camera sitting exactly on the planet, which would
  // normalize to a zero vector and put NaN into the camera position.
  if (direction.lengthSq() === 0) direction.set(0, 0.4, 1);

  direction.normalize();

  const distance = Math.max(planet.config.radius * CONFIG.focus.distanceFactor, CONFIG.focus.minDistance);

  // The default minimum zoom distance is tuned for the whole system and is
  // larger than the focus distance of every planet except Jupiter, so it has
  // to be relaxed per planet or OrbitControls pushes the camera straight back
  // out on the next update.
  controls.minDistance = Math.max(planet.config.radius * CONFIG.focus.clearanceFactor, 0.5);

  camera.position.copy(followPosition).add(direction.multiplyScalar(distance));

  updatePlanetInfo();
  updateActivePlanetButton();
}

function updateFollow() {
  if (!state.followed) return;

  const planet = planets.get(state.followed);

  if (!planet) return;

  planet.mesh.getWorldPosition(followPosition);
  followDelta.subVectors(followPosition, lastFollowPosition);

  // Move the camera by the same amount as the planet instead of just
  // retargeting, so whatever angle and zoom the user picked is preserved.
  camera.position.add(followDelta);
  controls.target.add(followDelta);

  lastFollowPosition.copy(followPosition);
}

function resetCamera() {
  camera.position.copy(CONFIG.camera.position);
  controls.target.set(0, 0, 0);
  controls.minDistance = CONFIG.controls.minDistance;
  state.selectedPlanet = 'earth';
  state.followed = null;

  updatePlanetInfo();
  updateActivePlanetButton();
}

function togglePause() {
  state.paused = !state.paused;

  uiElements.pauseButton.textContent = state.paused ? 'Resume' : 'Pause';
}

function createUI() {
  const ui = document.createElement('aside');

  ui.className = 'ui';

  ui.innerHTML = `
    <div class="ui__header">
      <div>
        <h1>Solar System</h1>
        <p>Interactive Three.js simulation</p>
      </div>
    </div>

    <div class="ui__section">
      <div class="ui__section-title">
        <span>PLANETS</span>
      </div>

      <div class="planet-list">
        ${Object.keys(CONFIG.planets)
          .map(
            (name) => `
              <button
                class="planet-button ${name === state.selectedPlanet ? 'planet-button--active' : ''}"
                data-planet="${name}"
              >
                <span class="planet-button__dot"></span>

                <span>
                  ${formatPlanetName(name)}
                </span>
              </button>
            `
          )
          .join('')}
      </div>
    </div>

    <div class="ui__section ui__planet-info">
      <div class="ui__section-title">
        <span>SELECTED PLANET</span>
      </div>

      <h2 id="planet-name">Earth</h2>

      <p id="planet-description">
        Our home planet, with liquid water and life.
      </p>
    </div>

    <div class="ui__section">
      <div class="speed-header">
        <span>Simulation speed</span>
        <strong id="speed-value">1x</strong>
      </div>

      <input
        id="speed"
        class="speed-slider"
        type="range"
        min="0"
        max="5"
        step="0.25"
        value="1"
      />
    </div>

    <div class="ui__actions">
      <button
        id="pause-button"
        class="ui-button"
      >
        Pause
      </button>

      <button
        id="reset-button"
        class="ui-button ui-button--secondary"
      >
        Reset camera
      </button>
    </div>
  `;

  document.body.appendChild(ui);

  uiElements = {
    planetName: ui.querySelector('#planet-name'),
    planetDescription: ui.querySelector('#planet-description'),
    planetButtons: ui.querySelectorAll('[data-planet]'),
    pauseButton: ui.querySelector('#pause-button'),
    resetButton: ui.querySelector('#reset-button'),
    speedInput: ui.querySelector('#speed'),
    speedValue: ui.querySelector('#speed-value'),
  };

  bindUIEvents();
}

function bindUIEvents() {
  uiElements.planetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      focusPlanet(button.dataset.planet);
    });
  });

  uiElements.pauseButton.addEventListener('click', togglePause);
  uiElements.resetButton.addEventListener('click', resetCamera);
  uiElements.speedInput.addEventListener('input', handleSpeedChange);
}

function handleSpeedChange(event) {
  state.speed = +event.target.value;
  uiElements.speedValue.textContent = `${state.speed}x`;
}

function animatePlanets(delta) {
  if (state.paused) return;

  planets.forEach((planet) => {
    updatePlanetRotation(planet, delta);
    updateMoonRotation(planet, delta);
  });
}

function updatePlanetRotation(planet, delta) {
  const {config, orbitPivot, mesh, clouds} = planet;

  const deltaTime = delta * state.speed * 0.1;

  orbitPivot.rotation.y += config.orbitSpeed * deltaTime;
  mesh.rotation.y += config.rotationSpeed * deltaTime;

  if (clouds) {
    clouds.rotation.y += config.rotationSpeed * delta * state.speed * 0.12;
  }
}

function updateMoonRotation(planet, delta) {
  if (!planet.moon) return;

  const {pivot, mesh} = planet.moon;
  const deltaTime = delta * state.speed * 0.1;

  pivot.rotation.y += CONFIG.moon.orbitSpeed * deltaTime;
  mesh.rotation.y += CONFIG.moon.rotationSpeed * deltaTime;
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(getPixelRatio());
}

function animate() {
  timer.update();

  const delta = timer.getDelta();

  animatePlanets(delta);
  updateFollow();
  controls.update();
  renderer.render(scene, camera);
}

async function init() {
  if (!WebGL.isWebGL2Available()) {
    showUnsupportedMessage();

    return;
  }

  renderer = createRenderer();
  controls = createControls();

  createAmbientLight();
  createSun();
  createStars();

  // The Sun and the star field need no textures, so rendering can start
  // immediately and the planets appear as their textures resolve.
  renderer.setAnimationLoop(animate);

  await Promise.all(Object.entries(CONFIG.planets).map(([name, config]) => createPlanet(name, config)));

  createUI();
  resetCamera();
  hideLoader();

  window.addEventListener('resize', resize);
}

init().catch((error) => {
  const status = document.getElementById('loader-status');

  if (status) status.textContent = 'Failed to load the scene';

  console.error('Failed to initialize Solar System:', error);
});
