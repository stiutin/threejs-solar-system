import './style.css';

import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {CSS2DObject, CSS2DRenderer} from 'three/addons/renderers/CSS2DRenderer.js';

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
  picking: {
    // How far the pointer may travel between press and release, in CSS pixels, and still count as a click
    // rather than a drag of the orbit controls.
    clickTolerance: 5,
    // A click that misses every mesh still picks a planet whose centre is this close on screen, in CSS pixels,
    // so the small, distant planets can be clicked too.
    nearMiss: 14,
  },
  focus: {
    // Camera distance when focusing a planet, as a multiple of its radius.
    distanceFactor: 6,
    minDistance: 1.5,
    // How close the user may then zoom in, as a multiple of the radius.
    clearanceFactor: 2.5,
    // Seconds the camera takes to fly to a planet. Real time: pausing or speeding up the simulation does not
    // change it.
    flightDuration: 1.2,
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
  earth: {
    shininess: 15,
    clouds: {
      // The cloud shell sits just above the surface and turns a little faster than it.
      scale: 1.015,
      opacity: 0.7,
      speedFactor: 1.2,
    },
  },
  saturnRings: {
    // In Saturn radii, so the ring scales with the planet.
    innerRadius: 1.05,
    outerRadius: 1.75,
    segments: 128,
  },
  planetMaterial: {
    shininess: 8,
  },
  labels: {
    // Labels sit above their planet by this many planet radii, so they never cover it.
    offset: 1.6,
  },
  ambientLight: {
    color: 0x9fb7d9,
    intensity: 0.22,
  },
  simulation: {
    // Orbit and rotation speeds in this config are radians per second at 1x, scaled by this factor.
    timeScale: 0.1,
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
  // The flight to a newly focused planet while it is in progress: where the camera and the target started,
  // where the camera ends relative to the planet, and how far along it is.
  flight: null,
};

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
// The phone layout of style.css, where the panel can fold away; keep the two widths in step.
const phoneLayout = window.matchMedia('(width <= 640px)');

// The planets orbit around the world's Y axis, in the XZ plane.
const ORBIT_AXIS = new THREE.Vector3(0, 1, 0);

// Scratch vectors reused on every frame instead of allocated.
const followPosition = new THREE.Vector3();
const lastFollowPosition = new THREE.Vector3();
const flightEnd = new THREE.Vector3();
const scene = createScene();
const camera = createCamera();
// Created in init() rather than here: the WebGLRenderer constructor throws
// when no context is available, and at module scope that would kill the
// script before anything could tell the user why.
let renderer = null;
let controls = null;
let labelRenderer = null;
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

  if (track) {
    track.remove();
  }
  if (status) {
    status.textContent = 'This browser or device does not support WebGL 2, which the scene needs to render.';
    status.classList.add('loader__status--error');
  }
}

function hideLoader() {
  const loader = document.getElementById('loader');

  if (!loader) {
    return;
  }

  // Without a fade there is no transitionend, and a loader left at opacity 0 would still be read out by screen
  // readers, so it goes at once.
  if (prefersReducedMotion.matches) {
    loader.remove();
    return;
  }

  loader.classList.add('loader--hidden');
  loader.addEventListener('transitionend', () => loader.remove(), {once: true});
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
  const light = new THREE.AmbientLight(CONFIG.ambientLight.color, CONFIG.ambientLight.intensity);

  scene.add(light);
}

function createStars() {
  const positions = new Float32Array(CONFIG.stars.count * 3);

  const radius = CONFIG.stars.radius;

  // Uniform over the sphere: a random longitude, and the arccosine of a uniform value for the latitude, which
  // keeps the stars from bunching at the poles.
  for (let star = 0; star < CONFIG.stars.count; star += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    const index = star * 3;

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
      shininess: CONFIG.earth.shininess,
    })
  );

  const clouds = createSphere(
    config.radius * CONFIG.earth.clouds.scale,
    new THREE.MeshPhongMaterial({
      // Used as alphaMap rather than map: as a colour map the black areas of
      // the texture are not transparent, they are dark, and they shade the
      // whole planet instead of leaving the cloudless parts clear.
      alphaMap: cloudsTexture,
      color: 0xffffff,
      transparent: true,
      opacity: CONFIG.earth.clouds.opacity,
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
    shininess: CONFIG.planetMaterial.shininess,
  });

  const planet = createSphere(config.radius, material);

  if (name === 'saturn') {
    await createSaturnRings(planet);
  }

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
  const {innerRadius, outerRadius, segments} = CONFIG.saturnRings;
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, segments);
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

  if (isEarth) {
    planet.moon = await createMoon(anchor);
  }

  // Everything under the anchor (the planet, Earth's clouds and Moon, Saturn's ring) picks this planet.
  anchor.userData.planet = name;

  planets.set(name, planet);

  return planet;
}

function updatePlanetInfo() {
  const planet = planets.get(state.selectedPlanet);

  if (!planet || !uiElements) {
    return;
  }

  uiElements.planetName.textContent = formatPlanetName(state.selectedPlanet);
  uiElements.planetDescription.textContent = planet.config.description;
}

function updateActivePlanetButton() {
  if (!uiElements) {
    return;
  }

  uiElements.planetButtons.forEach((button) => {
    const isActive = button.dataset.planet === state.selectedPlanet;

    button.classList.toggle('planet-button--active', isActive);
  });
}

function formatPlanetName(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Where the camera sits relative to a planet when it focuses on it: on its current side, at a set distance. */
function focusOffset(planet, planetPosition) {
  const direction = new THREE.Vector3().subVectors(camera.position, planetPosition);

  // Guard against the camera sitting exactly on the planet, which would
  // normalize to a zero vector and put NaN into the camera position.
  if (direction.lengthSq() === 0) {
    direction.set(0, 0.4, 1);
  }

  const distance = Math.max(planet.config.radius * CONFIG.focus.distanceFactor, CONFIG.focus.minDistance);

  return direction.normalize().multiplyScalar(distance);
}

/**
 * Focuses a planet and keeps the camera on it as it orbits. The camera flies there over
 * CONFIG.focus.flightDuration, aiming at where the planet is on each frame rather than where it was when the
 * flight began, and jumps straight there when the visitor prefers reduced motion.
 */
function focusPlanet(name) {
  const planet = planets.get(name);

  if (!planet) {
    return;
  }

  state.selectedPlanet = name;
  state.followed = name;

  planet.mesh.getWorldPosition(followPosition);
  lastFollowPosition.copy(followPosition);

  const offset = focusOffset(planet, followPosition);

  // The default minimum zoom distance is tuned for the whole system and is
  // larger than the focus distance of every planet except Jupiter, so it has
  // to be relaxed per planet or OrbitControls pushes the camera straight back
  // out on the next update.
  controls.minDistance = Math.max(planet.config.radius * CONFIG.focus.clearanceFactor, 0.5);

  if (prefersReducedMotion.matches) {
    state.flight = null;
    controls.target.copy(followPosition);
    camera.position.copy(followPosition).add(offset);
  } else {
    state.flight = {
      fromCamera: camera.position.clone(),
      fromTarget: controls.target.clone(),
      offset,
      elapsed: 0,
    };
    // The controls would pull against the flight; they take over again when it lands.
    controls.enabled = false;
  }

  updatePlanetInfo();
  updateActivePlanetButton();
  updateFollowUI();

  // On a phone the open panel covers the planet the camera is flying to.
  if (uiElements && phoneLayout.matches) {
    setPanelFolded(true);
  }
}

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** One frame of the flight towards the followed planet, which keeps moving while the camera travels. */
function updateFlight(delta, planetPosition) {
  const flight = state.flight;

  flight.elapsed += delta;
  const progress = easeInOutCubic(Math.min(flight.elapsed / CONFIG.focus.flightDuration, 1));

  controls.target.lerpVectors(flight.fromTarget, planetPosition, progress);
  camera.position.lerpVectors(flight.fromCamera, flightEnd.copy(planetPosition).add(flight.offset), progress);

  if (progress < 1) {
    return;
  }

  state.flight = null;
  controls.enabled = true;
  updateFollowUI();
}

/**
 * Keeps the camera on the followed planet: during the flight it travels towards it, afterwards it rides along
 * the planet's orbit.
 */
function updateFollow(delta) {
  const planet = state.followed && planets.get(state.followed);

  if (!planet) {
    return;
  }

  planet.mesh.getWorldPosition(followPosition);

  if (state.flight) {
    updateFlight(delta, followPosition);
  } else {
    rideAlong(lastFollowPosition, followPosition);
  }

  lastFollowPosition.copy(followPosition);
}

/** The angle of a point around the Sun, in the plane the planets orbit in. */
const orbitAngle = (position) => Math.atan2(position.z, position.x);

/**
 * Carries the camera and the controls' target with the planet from one frame to the next, turning them around
 * the Sun by the same angle the planet travelled. The camera keeps its place relative to the planet and the Sun,
 * so the side of the planet in view, and its lighting, stay as they were, and any angle or zoom the visitor
 * picked with the controls is kept too.
 */
function rideAlong(from, to) {
  const turn = orbitAngle(from) - orbitAngle(to);

  for (const point of [camera.position, controls.target]) {
    point.sub(from).applyAxisAngle(ORBIT_AXIS, turn).add(to);
  }
}

/** Leaves the camera where it is and lets the planet move on without it. */
function stopFollowing() {
  state.followed = null;
  state.flight = null;
  controls.enabled = true;

  updateFollowUI();
}

function followStatusText(name) {
  if (state.flight) {
    return `Flying to ${name}…`;
  }
  return state.followed ? `The camera follows ${name} along its orbit.` : '';
}

/** The follow button and its status line, from the current state. */
function updateFollowUI() {
  if (!uiElements) {
    return;
  }

  const following = state.followed !== null;
  const name = formatPlanetName(state.followed ?? state.selectedPlanet);

  uiElements.followButton.setAttribute('aria-pressed', String(following));
  uiElements.followButton.textContent = following ? 'Stop following' : `Follow ${name}`;
  uiElements.followStatus.textContent = followStatusText(name);
}

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const projected = new THREE.Vector3();
let pointerDown = null;
let hoverFrame = 0;

/** The planet a hit object belongs to: the nearest ancestor that carries a planet name. */
function planetOf(object) {
  for (let current = object; current; current = current.parent) {
    if (current.userData.planet) {
      return current.userData.planet;
    }
  }
  return null;
}

/** The planet whose geometry is under a point of the canvas, nearest first, or null. */
function planetUnder(clientX, clientY) {
  const bounds = renderer.domElement.getBoundingClientRect();

  pointerNdc.set(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1);
  raycaster.setFromCamera(pointerNdc, camera);

  const anchors = [...planets.values()].map((planet) => planet.anchor);
  const [hit] = raycaster.intersectObjects(anchors, true);

  return hit ? planetOf(hit.object) : planetNear(clientX, clientY, bounds);
}

/** The planet whose centre is within CONFIG.picking.nearMiss pixels of a point on screen, nearest first. */
function planetNear(clientX, clientY, bounds) {
  let nearest = null;
  let nearestDistance = CONFIG.picking.nearMiss;

  for (const planet of planets.values()) {
    planet.mesh.getWorldPosition(projected).project(camera);

    // Behind the camera, the projection lands on the screen mirrored; skip it.
    if (projected.z > 1) {
      continue;
    }

    const x = bounds.left + ((projected.x + 1) / 2) * bounds.width;
    const y = bounds.top + ((1 - projected.y) / 2) * bounds.height;
    const distance = Math.hypot(x - clientX, y - clientY);

    if (distance < nearestDistance) {
      nearest = planet.name;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function handlePointerDown(event) {
  if (!event.isPrimary || event.button !== 0) {
    return;
  }
  pointerDown = {id: event.pointerId, x: event.clientX, y: event.clientY};
}

/** A press and release in nearly the same place is a click on the scene; anything longer is the controls' drag. */
function handlePointerUp(event) {
  const press = pointerDown;

  pointerDown = null;
  if (!press || press.id !== event.pointerId) {
    return;
  }
  if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > CONFIG.picking.clickTolerance) {
    return;
  }

  const name = planetUnder(event.clientX, event.clientY);

  if (name) {
    focusPlanet(name);
  }
}

/** Shows a pointer and the planet's name over anything clickable; once per frame at most. */
function handleHover(event) {
  if (event.pointerType !== 'mouse' || event.buttons !== 0 || hoverFrame) {
    return;
  }

  hoverFrame = requestAnimationFrame(() => {
    hoverFrame = 0;

    const name = planetUnder(event.clientX, event.clientY);
    const canvas = renderer.domElement;

    canvas.style.cursor = name ? 'pointer' : '';
    canvas.title = name ? formatPlanetName(name) : '';
  });
}

/** The layer that draws HTML labels over the canvas, in step with the WebGL scene. */
function createLabelRenderer() {
  const labels = new CSS2DRenderer();

  labels.setSize(window.innerWidth, window.innerHeight);
  labels.domElement.className = 'labels';
  document.body.appendChild(labels.domElement);
  return labels;
}

/** A name over each planet. */
function addLabels() {
  for (const planet of planets.values()) {
    planet.anchor.add(createLabel(planet));
  }
}

function createLabel(planet) {
  const element = document.createElement('div');

  element.className = 'planet-label';
  element.textContent = formatPlanetName(planet.name);
  // The panel's planet list is the accessible way to pick a planet; the labels are a pointer shortcut.
  element.setAttribute('aria-hidden', 'true');
  element.addEventListener('click', () => {
    focusPlanet(planet.name);
  });

  const label = new CSS2DObject(element);

  label.position.y = planet.config.radius * CONFIG.labels.offset;
  return label;
}

function enablePicking() {
  const canvas = renderer.domElement;

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', () => {
    pointerDown = null;
  });
  canvas.addEventListener('pointermove', handleHover);
}

function resetCamera() {
  camera.position.copy(CONFIG.camera.position);
  controls.target.set(0, 0, 0);
  controls.minDistance = CONFIG.controls.minDistance;
  state.selectedPlanet = 'earth';
  state.followed = null;
  state.flight = null;
  controls.enabled = true;

  updatePlanetInfo();
  updateActivePlanetButton();
  updateFollowUI();
}

function togglePause() {
  state.paused = !state.paused;

  uiElements.pauseButton.textContent = state.paused ? 'Resume' : 'Pause';
}

/** The panel's title. */
function headerMarkup() {
  return `
    <div class="ui__header">
      <div>
        <h1>Solar System</h1>
        <p class="ui__subtitle">Interactive Three.js simulation</p>
        <p id="panel-summary" class="ui__summary"></p>
      </div>

      <button
        id="panel-toggle"
        class="ui-button ui-button--secondary ui__toggle"
        aria-expanded="true"
        aria-controls="panel-body"
      >
        Hide controls
      </button>
    </div>
  `;
}

/** One button per planet in CONFIG.planets, so a planet added there appears here too. */
function planetListMarkup() {
  return `
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
  `;
}

/** The selected planet, its description, and the follow button with its live status line. */
function planetInfoMarkup() {
  return `
    <div class="ui__section ui__planet-info">
      <div class="ui__section-title">
        <span>SELECTED PLANET</span>
      </div>

      <h2 id="planet-name">Earth</h2>

      <p id="planet-description">
        Our home planet, with liquid water and life.
      </p>

      <button id="follow-button" class="ui-button ui-button--secondary" aria-pressed="false">
        Follow Earth
      </button>

      <p id="follow-status" class="follow-status" role="status" aria-live="polite"></p>
    </div>
  `;
}

/** The simulation speed slider. */
/** Whether the names of the planets float over the scene. */
function labelsControlMarkup() {
  return `
    <div class="ui__section">
      <label class="labels-toggle">
        <input id="labels-toggle" type="checkbox" checked />
        <span>Planet labels</span>
      </label>
    </div>
  `;
}

function speedControlMarkup() {
  return `
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
  `;
}

/** Pause and reset. */
function actionsMarkup() {
  return `
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
}

function createUI() {
  const ui = document.createElement('aside');

  ui.className = 'ui';
  const body = [planetListMarkup(), planetInfoMarkup(), labelsControlMarkup(), speedControlMarkup(), actionsMarkup()];

  // Everything but the header folds away on a phone; on wider screens the panel is always open.
  ui.innerHTML = `${headerMarkup()}<div id="panel-body" class="ui__body">${body.join('')}</div>`;
  document.body.appendChild(ui);

  uiElements = queryUIElements(ui);
  bindUIEvents();
}

function queryUIElements(ui) {
  return {
    planetName: ui.querySelector('#planet-name'),
    planetDescription: ui.querySelector('#planet-description'),
    planetButtons: ui.querySelectorAll('[data-planet]'),
    pauseButton: ui.querySelector('#pause-button'),
    resetButton: ui.querySelector('#reset-button'),
    followButton: ui.querySelector('#follow-button'),
    followStatus: ui.querySelector('#follow-status'),
    speedInput: ui.querySelector('#speed'),
    speedValue: ui.querySelector('#speed-value'),
    panel: ui,
    panelToggle: ui.querySelector('#panel-toggle'),
    panelSummary: ui.querySelector('#panel-summary'),
    labelsToggle: ui.querySelector('#labels-toggle'),
  };
}

function bindUIEvents() {
  uiElements.planetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      focusPlanet(button.dataset.planet);
    });
  });

  uiElements.pauseButton.addEventListener('click', togglePause);
  uiElements.resetButton.addEventListener('click', resetCamera);
  uiElements.followButton.addEventListener('click', () => {
    if (state.followed) {
      stopFollowing();
      return;
    }
    focusPlanet(state.selectedPlanet);
  });
  uiElements.speedInput.addEventListener('input', handleSpeedChange);
  uiElements.panelToggle.addEventListener('click', () => {
    setPanelFolded(!uiElements.panel.hasAttribute('data-folded'));
  });
  uiElements.labelsToggle.addEventListener('change', (event) => {
    labelRenderer.domElement.hidden = !event.target.checked;
  });
}

/** Folds the panel down to its header, or opens it again; the CSS only folds it in the phone layout. */
function setPanelFolded(folded) {
  uiElements.panel.toggleAttribute('data-folded', folded);
  uiElements.panelToggle.setAttribute('aria-expanded', String(!folded));
  uiElements.panelToggle.textContent = folded ? 'Show controls' : 'Hide controls';
  uiElements.panelSummary.textContent = folded ? formatPlanetName(state.selectedPlanet) : '';
}

function handleSpeedChange(event) {
  state.speed = Number(event.target.value);
  uiElements.speedValue.textContent = `${state.speed}x`;
}

function animatePlanets(delta) {
  if (state.paused) {
    return;
  }

  planets.forEach((planet) => {
    updatePlanetRotation(planet, delta);
    updateMoonRotation(planet, delta);
  });
}

/** How far the simulation moves in a frame: real seconds, times the chosen speed, times the config's scale. */
function simulationStep(delta) {
  return delta * state.speed * CONFIG.simulation.timeScale;
}

function updatePlanetRotation(planet, delta) {
  const {config, orbitPivot, mesh, clouds} = planet;
  const step = simulationStep(delta);

  orbitPivot.rotation.y += config.orbitSpeed * step;
  mesh.rotation.y += config.rotationSpeed * step;

  if (clouds) {
    clouds.rotation.y += config.rotationSpeed * CONFIG.earth.clouds.speedFactor * step;
  }
}

function updateMoonRotation(planet, delta) {
  if (!planet.moon) {
    return;
  }

  const {pivot, mesh} = planet.moon;
  const step = simulationStep(delta);

  pivot.rotation.y += CONFIG.moon.orbitSpeed * step;
  mesh.rotation.y += CONFIG.moon.rotationSpeed * step;
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(getPixelRatio());
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  timer.update();

  const delta = timer.getDelta();

  animatePlanets(delta);
  updateFollow(delta);
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

async function init() {
  if (!WebGL.isWebGL2Available()) {
    showUnsupportedMessage();

    return;
  }

  renderer = createRenderer();
  labelRenderer = createLabelRenderer();
  controls = createControls();

  createAmbientLight();
  createSun();
  createStars();

  // The Sun and the star field need no textures, so rendering can start
  // immediately and the planets appear as their textures resolve.
  renderer.setAnimationLoop(animate);

  await Promise.all(Object.entries(CONFIG.planets).map(([name, config]) => createPlanet(name, config)));

  addLabels();
  createUI();
  enablePicking();
  resetCamera();
  hideLoader();

  window.addEventListener('resize', resize);
}

init().catch((error) => {
  const status = document.getElementById('loader-status');

  if (status) {
    status.textContent = 'Failed to load the scene';
  }

  console.error('Failed to initialize Solar System:', error);
});
