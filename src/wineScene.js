import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/* ====================================================================
   Wine-Pour Scene  (v2 — geometry-aware positioning)
   ────────────────
   Scroll-driven animation (0 → 1):
     0.00 – 0.15  Bottle and glass idle, bottle gently rotates
     0.15 – 0.35  Bottle slides toward glass rim and tilts
     0.35 – 0.45  Pour stream appears from bottle mouth to glass
     0.45 – 0.80  Wine particles rain into glass, wine level rises
     0.80 – 0.90  Pour stream fades, bottle returns upright
     0.90 – 1.00  Idle / hold
   ==================================================================== */

let scene, camera, renderer, clock;
let bottle, glass;
let pourStream, wineSurface;
let wineProgress = 0;
let container;
let animationFrameId;
let isInitialized = false;

/* ── Geometry-derived positions (filled after models load) ── */
let bottleStartPos = new THREE.Vector3();   // where bottle rests
let bottlePourPos = new THREE.Vector3();    // where bottle goes to pour
let glassWorldPos = new THREE.Vector3();    // glass center
let glassRimY = 0;                          // Y of glass rim (world)
let glassBottomY = 0;                       // Y of inner glass bowl bottom
let glassRimWorldX = 0;                     // X center of glass in world
let bottleTopY = 0;                         // tip of bottle (for stream origin)
let bottleMouthOffset = new THREE.Vector3();// offset from bottle pivot to mouth

let modelsLoaded = { bottle: false, glass: false };

// Particle pool
const PARTICLE_COUNT = 80;
const particlePool = [];

/**
 * Receive scroll progress from GSAP (0 → 1)
 */
export function setWineScrollProgress(progress) {
  wineProgress = progress;
}

function isMobile() {
  return window.innerWidth < 768;
}

/**
 * Initialize wine pouring scene
 */
export function initWineScene() {
  container = document.getElementById('wine-canvas-container');
  if (!container) {
    console.warn('WineScene: #wine-canvas-container not found.');
    return;
  }

  if (isMobile()) return;

  setupScene();
  loadModels();
  createPourStream();
  createWineSurface();
  createParticlePool();
  animate();
  isInitialized = true;

  window.addEventListener('resize', onResize);
}

/* ──────────────────────────────────────────
   Setup: Renderer, Scene, Camera, Lights
────────────────────────────────────────── */
function setupScene() {
  clock = new THREE.Clock();
  scene = new THREE.Scene();

  const aspect = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(32, aspect, 0.1, 100);
  // Pull camera back enough to see both models comfortably
  camera.position.set(0, 2.5, 10);
  camera.lookAt(0, 1.2, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  container.appendChild(renderer.domElement);

  // ── Lighting ──
  scene.add(new THREE.AmbientLight(0xfff5e1, 0.8));

  const keyLight = new THREE.DirectionalLight(0xd4af37, 2.2);
  keyLight.position.set(4, 6, 3);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x9db4c9, 0.7);
  fillLight.position.set(-3, 3, -2);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xd4af37, 1.2);
  rimLight.position.set(-1, 4, -5);
  scene.add(rimLight);

  // Backlight for glass sparkle
  const backLight = new THREE.PointLight(0xffffff, 0.6, 12);
  backLight.position.set(0, 2, -3);
  scene.add(backLight);
}

/* ──────────────────────────────────────────
   Model Loading
────────────────────────────────────────── */
function loadModels() {
  const loader = new GLTFLoader();

  // ── Load Bottle ──
  loader.load('/assets/models/Bottle of wine.glb', (gltf) => {
    bottle = gltf.scene;

    // We need to scale the bottle while ensuring its pivot point
    // behaves well for tilting.
    
    // Create an intermediate completely empty group acting as our pivot
    const pivotGroup = new THREE.Group();
    scene.add(pivotGroup);

    // Get the bottle's real size inside
    const bbox = new THREE.Box3().setFromObject(bottle);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());
    
    // Scale so the bottle is roughly 4 units tall
    const targetHeight = 4.0;
    const scale = targetHeight / size.y;
    bottle.scale.setScalar(scale);
    
    // Position the bottle inside the pivot group so its center is halfway up
    // This allows tilting cleanly from the middle/bottom
    const scaledBox = new THREE.Box3().setFromObject(bottle);
    bottle.position.set(0, -scaledBox.min.y, 0); // rest exactly on Y=0 relative to pivot

    pivotGroup.add(bottle);
    
    // From now on, "bottle" refers to the pivot group
    bottle = pivotGroup;
    
    bottleTopY = scaledBox.max.y; // store actual height inside pivot

    // Position bottle left of center
    bottle.position.set(-1.0, -1.5, 0); 
    bottleStartPos.copy(bottle.position);

    // The bottle mouth is exactly at bottleTopY, offset from pivot
    bottleMouthOffset.set(0, bottleTopY, 0);

    bottle.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.envMapIntensity = 1.5;
        child.material.needsUpdate = true;
      }
    });

    modelsLoaded.bottle = true;
    if (modelsLoaded.glass) computePourGeometry();
  });

  // ── Load Glass ──
  loader.load('/assets/models/Wine glass.glb', (gltf) => {
    glass = gltf.scene;

    // Get true bounding box to figure out scaling
    const bbox = new THREE.Box3().setFromObject(glass);
    const size = bbox.getSize(new THREE.Vector3());
    const scale = 2.5 / size.y; // Glass is ~2.5 units tall

    glass.scale.setScalar(scale);

    // Re-center: keep bottom at exactly y=0, x=0, z=0
    const scaledBox = new THREE.Box3().setFromObject(glass);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    glass.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);

    // We wrap glass in a parent group so we can move the whole thing easily
    const glassGroup = new THREE.Group();
    glassGroup.add(glass);

    // Place glass right of center
    glassGroup.position.set(1.5, -1.5, 0);
    scene.add(glassGroup);
    
    // Overwrite the glass reference to be the group
    glass = glassGroup;

    // Measure glass geometry for pour targets (using world coordinates now)
    const finalBox = new THREE.Box3().setFromObject(glass);
    
    // Store all needed target variables based on the final scaled world position
    glassRimY = finalBox.max.y;
    // A standard wine glass has a stem comprising roughly 45-55% of its height
    glassBottomY = finalBox.min.y + (finalBox.max.y - finalBox.min.y) * 0.55; 
    glassRimWorldX = glass.position.x;
    glassWorldPos.copy(glass.position);

    glass.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.transparent = true;
        child.material.opacity = 0.82;
        child.material.envMapIntensity = 2.0;
        child.material.needsUpdate = true;
      }
    });

    modelsLoaded.glass = true;
    if (modelsLoaded.bottle) computePourGeometry();
  });
}

/**
 * Called once both models are loaded.
 * Compute the exact pour position so the bottle mouth ends up
 * just above the glass rim.
 */
function computePourGeometry() {
  // Bottle pivot usually sits at its base. We want its tip to hang over glass rim.
  // First, calculate vector from bottle base to bottle tip WHEN TILTED.
  // By default we rotate bottle on Z axis by roughly -1.6 radians to pour.
  
  const rotationAngle = -1.6;
  const tiltedOffset = new THREE.Vector3(0, bottleTopY, 0).applyEuler(new THREE.Euler(0, 0, rotationAngle));
  
  // Now we know where the tip ends up relative to its pivot.
  // We want tip perfectly centered vertically over the glass.
  // Desired tip world position:
  const targetTip = new THREE.Vector3(glassRimWorldX, glassRimY + 0.45, 0);
  
  // So bottle pivot must be at targetTip - tiltedOffset
  bottlePourPos.copy(targetTip).sub(tiltedOffset);

  console.log('Wine scene: pour geometry computed', {
    bottleStart: bottleStartPos.toArray(),
    bottlePour: bottlePourPos.toArray(),
    glassRim: glassRimY,
    glassCenter: glassWorldPos.toArray(),
    tiltedOffset: tiltedOffset.toArray(),
    targetTip: targetTip.toArray()
  });
}

/* ──────────────────────────────────────────
   Pour Stream — connects bottle mouth to glass
────────────────────────────────────────── */
function createPourStream() {
  const streamGeometry = new THREE.CylinderGeometry(0.015, 0.02, 1.0, 8, 4);
  // Shift origin to the top so it scales cleanly downward
  streamGeometry.translate(0, -0.5, 0); 
  
  const streamMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a0327, // vibrant ruby red
    transparent: true,
    opacity: 0,
    roughness: 0.2,
    metalness: 0.1,
  });

  pourStream = new THREE.Mesh(streamGeometry, streamMaterial);
  pourStream.visible = false;
  scene.add(pourStream);
}

/* ──────────────────────────────────────────
   Wine Surface — Rising disc inside glass
────────────────────────────────────────── */
function createWineSurface() {
  const surfaceGeometry = new THREE.CylinderGeometry(0.25, 0.18, 0.02, 32);
  const surfaceMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a0327,
    transparent: true,
    opacity: 0,
    roughness: 0.1,
    metalness: 0.2,
  });

  wineSurface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  wineSurface.visible = false;
  scene.add(wineSurface);
}

/* ──────────────────────────────────────────
   Particle Pool
────────────────────────────────────────── */
function createParticlePool() {
  const particleGeo = new THREE.SphereGeometry(0.015, 6, 6);
  const particleMat = new THREE.MeshBasicMaterial({
    color: 0x8a0327,
    transparent: true,
    opacity: 0.9,
  });

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const mesh = new THREE.Mesh(particleGeo, particleMat.clone());
    mesh.visible = false;
    scene.add(mesh);
    particlePool.push({
      mesh,
      velocity: new THREE.Vector3(),
      life: 0,
      maxLife: 0,
    });
  }
}

/**
 * Spawn a particle from the bottle mouth, falling toward the glass
 */
function spawnParticle() {
  const p = particlePool.find((p) => p.life <= 0);
  if (!p) return;

  // Compute current bottle mouth position in world space
  const mouthWorld = getBottleMouthWorld();

  p.mesh.position.set(
    mouthWorld.x + (Math.random() - 0.5) * 0.02,
    mouthWorld.y - 0.05,
    mouthWorld.z + (Math.random() - 0.5) * 0.02
  );

  // Velocity: slight drift toward glass center + gravity
  const driftX = (glassRimWorldX - mouthWorld.x) * 0.015;
  p.velocity.set(
    driftX + (Math.random() - 0.5) * 0.005,
    -0.03 - Math.random() * 0.02,
    (Math.random() - 0.5) * 0.005
  );
  p.life = 1.0;
  p.maxLife = 0.5 + Math.random() * 0.4;
  p.mesh.visible = true;
  p.mesh.material.opacity = 0.85;
}

/**
 * Get the bottle mouth position in world coordinates,
 * accounting for current rotation & position.
 */
function getBottleMouthWorld() {
  if (!bottle) return new THREE.Vector3(0, 3, 0);

  // The mouth is at local "up" of the bottle.
  // When tilted, we need to rotate that offset.
  const localMouth = new THREE.Vector3(0, bottleMouthOffset.y, 0);
  localMouth.applyEuler(bottle.rotation);
  return localMouth.add(bottle.position);
}

function updateParticles(dt) {
  for (const p of particlePool) {
    if (p.life <= 0) continue;

    p.life -= dt / p.maxLife;
    p.mesh.position.add(p.velocity);
    p.velocity.y -= 0.0025; // gravity

    p.mesh.material.opacity = Math.max(0, p.life * 0.85);

    // Kill when hitting the interior glass bottom or life expires
    if (p.life <= 0 || p.mesh.position.y < glassBottomY) {
      p.mesh.visible = false;
      p.life = 0;
    }
  }
}

/* ──────────────────────────────────────────
   Animation Loop
────────────────────────────────────────── */
function animate() {
  animationFrameId = requestAnimationFrame(animate);

  const dt = clock.getDelta();
  const elapsed = clock.getElapsedTime();
  const p = wineProgress; // 0 → 1

  // ── BOTTLE ──
  if (bottle) {
    if (p < 0.15) {
      // Idle at start — gentle slow rotation
      bottle.position.copy(bottleStartPos);
      bottle.rotation.set(0, elapsed * 0.12, 0);
    } else if (p < 0.35) {
      // Slide toward glass and tilt to pour
      const t = (p - 0.15) / 0.2;
      const eased = easeInOutCubic(t);

      bottle.position.lerpVectors(bottleStartPos, bottlePourPos, eased);
      // Tilt: rotate on Z to pour (negative = tilt right toward glass)
      bottle.rotation.set(0, 0, -eased * 1.6);
    } else if (p < 0.80) {
      // Pouring: hold position with subtle shake
      bottle.position.copy(bottlePourPos);
      bottle.rotation.set(0, 0, -1.6);
      bottle.position.x += Math.sin(elapsed * 7) * 0.002;
      bottle.position.y += Math.cos(elapsed * 5) * 0.001;
    } else if (p < 0.90) {
      // Return upright
      const t = (p - 0.80) / 0.1;
      const eased = easeInOutCubic(t);
      bottle.position.lerpVectors(bottlePourPos, bottleStartPos, eased);
      bottle.rotation.set(0, eased * 0.3, -1.6 * (1 - eased));
    } else {
      // Final idle
      bottle.position.copy(bottleStartPos);
      bottle.rotation.set(0, elapsed * 0.12, 0);
    }
  }

  // ── GLASS — subtle idle sway ──
  if (glass) {
    glass.position.x = glassWorldPos.x + Math.sin(elapsed * 0.7) * 0.015;
  }

  // ── POUR STREAM — positioned between bottle mouth and glass ──
  if (pourStream && modelsLoaded.bottle && modelsLoaded.glass) {
    if (p >= 0.30 && p < 0.80) {
      pourStream.visible = true;

      const mouthWorld = getBottleMouthWorld();
      // Drop straight down with gravity, target bottom of the glass bowl so liquid goes deep inside
      const glassTarget = new THREE.Vector3(mouthWorld.x, glassBottomY, 0);

      // The translated cylinder origin means position exactly at the mouth
      pourStream.position.copy(mouthWorld);

      // Compute stream length from mouth to glass bottom
      const streamLength = mouthWorld.distanceTo(glassTarget);
      const streamIn = Math.min(1, (p - 0.30) / 0.06);
      const streamOut = p > 0.72 ? 1 - (p - 0.72) / 0.08 : 1;
      const streamVis = Math.min(streamIn, streamOut);

      // Scale Y directly as length because origin is top
      pourStream.scale.set(1, streamLength * streamVis, 1);
      pourStream.material.opacity = streamVis * 0.65;

      // Ensure cylinder is completely vertical (default geometry is Y-up)
      pourStream.rotation.set(0, 0, 0);

      // Wobble
      pourStream.position.x += Math.sin(elapsed * 6) * 0.005;
    } else {
      pourStream.visible = false;
      pourStream.material.opacity = 0;
    }
  }

  // ── PARTICLES — spawn from bottle mouth, fall into glass ──
  if (p >= 0.33 && p < 0.78 && modelsLoaded.bottle && modelsLoaded.glass) {
    if (Math.random() < 0.5) spawnParticle();
    if (Math.random() < 0.35) spawnParticle();
  }
  updateParticles(dt);

  // ── WINE SURFACE — rises inside glass ──
  if (wineSurface && modelsLoaded.glass) {
    if (p >= 0.35) {
      wineSurface.visible = true;

      const fillProgress = Math.min(1, (p - 0.35) / 0.45);
      const eased = easeOutCubic(fillProgress);

      // Wine level rises from glass bottom toward ~65% of rim height
      const wineY = glassBottomY + (glassRimY - glassBottomY) * eased * 0.65;

      wineSurface.position.set(glassRimWorldX, wineY, 0);
      wineSurface.material.opacity = Math.min(0.85, fillProgress * 1.4);

      // Scale to approximate glass bowl width at this height
      const widthFactor = 0.35 + eased * 0.45;
      wineSurface.scale.set(widthFactor, 1, widthFactor);

      // Surface wobble during active pour
      if (p < 0.80) {
        wineSurface.rotation.x = Math.sin(elapsed * 4) * 0.025;
        wineSurface.rotation.z = Math.cos(elapsed * 3) * 0.015;
      } else {
        // Settle
        wineSurface.rotation.x *= 0.95;
        wineSurface.rotation.z *= 0.95;
      }
    } else {
      wineSurface.visible = false;
      wineSurface.material.opacity = 0;
    }
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

/* ──────────────────────────────────────────
   Easing helpers
────────────────────────────────────────── */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/* ──────────────────────────────────────────
   Responsive
────────────────────────────────────────── */
function onResize() {
  if (isMobile()) {
    if (isInitialized) dispose();
    return;
  }
  if (!isInitialized) {
    setupScene();
    loadModels();
    createPourStream();
    createWineSurface();
    createParticlePool();
    animate();
    isInitialized = true;
    return;
  }
  if (!container || !renderer) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function dispose() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (renderer) {
    renderer.dispose();
    if (renderer.domElement?.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }
  renderer = null;
  bottle = null;
  glass = null;
  pourStream = null;
  wineSurface = null;
  scene = null;
  camera = null;
  isInitialized = false;
  modelsLoaded = { bottle: false, glass: false };
}
