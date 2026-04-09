import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

let scene, camera, renderer, model;
let scrollProgress = 0;
let clock;
let container;
let animationFrameId;
let modelBaseY = 0;
let isInitialized = false;

/**
 * Set the scroll progress value from GSAP (0 → 1).
 * Used to rotate the model as the user scrolls through the dish panel.
 */
export function setScrollProgress(progress) {
  scrollProgress = progress;
}

/**
 * Check if we should render the 3D scene (desktop only).
 */
function isMobile() {
  return window.innerWidth < 768;
}

/**
 * Initialize the Three.js scene inside the #canvas-container element.
 */
export function initScene() {
  container = document.getElementById('canvas-container');
  if (!container) {
    console.warn('Scene: #canvas-container not found.');
    return;
  }

  // Mobile fallback — show static image instead
  if (isMobile()) {
    showFallback();
    return;
  }

  setupScene();
  loadModel();
  animate();
  isInitialized = true;

  // Handle window resize
  window.addEventListener('resize', onResize);
}

/* ──────────────────────────────────────────
   Setup: Renderer, Scene, Camera, Lights
────────────────────────────────────────── */
function setupScene() {
  clock = new THREE.Clock();

  // Scene
  scene = new THREE.Scene();

  // Camera
  const aspect = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
  camera.position.set(0, 1.2, 4);
  camera.lookAt(0, 0.3, 0);

  // Renderer — transparent background so dark site bg shows through
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  container.appendChild(renderer.domElement);

  // ---------- Lighting ----------

  // Warm ambient fill
  const ambientLight = new THREE.AmbientLight(0xfff5e1, 0.6);
  scene.add(ambientLight);

  // Main key light — warm golden from top-right
  const keyLight = new THREE.DirectionalLight(0xd4af37, 2.5);
  keyLight.position.set(3, 5, 2);
  keyLight.castShadow = false;
  scene.add(keyLight);

  // Fill light — cooler from the left to add dimension
  const fillLight = new THREE.DirectionalLight(0x8fb4c9, 0.8);
  fillLight.position.set(-4, 2, -1);
  scene.add(fillLight);

  // Rim / back light — dramatic gold edge highlight
  const rimLight = new THREE.DirectionalLight(0xd4af37, 1.5);
  rimLight.position.set(0, 3, -4);
  scene.add(rimLight);

  // Subtle point light underneath for upward glow
  const underGlow = new THREE.PointLight(0xd4af37, 0.4, 6);
  underGlow.position.set(0, -1, 1);
  scene.add(underGlow);
}

/* ──────────────────────────────────────────
   Model Loading
────────────────────────────────────────── */
function loadModel() {
  const loader = new GLTFLoader();

  loader.load(
    '/assets/models/beef steak.glb',
    (gltf) => {
      model = gltf.scene;

      // Center and scale model
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2.2 / maxDim;

      model.scale.setScalar(scale);
      modelBaseY = -center.y * scale + 0.3;
      model.position.set(-center.x * scale, modelBaseY, -center.z * scale);

      // Enhance materials — add slight metallic gloss for the seared crust look
      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.envMapIntensity = 1.2;
          child.material.needsUpdate = true;
        }
      });

      scene.add(model);
    },
    (xhr) => {
      const pct = ((xhr.loaded / xhr.total) * 100).toFixed(0);
      console.log(`Model loading: ${pct}%`);
    },
    (error) => {
      console.error('Error loading 3D model:', error);
      showFallback();
    }
  );
}

/* ──────────────────────────────────────────
   Animation Loop
────────────────────────────────────────── */
function animate() {
  animationFrameId = requestAnimationFrame(animate);

  if (!model) {
    renderer.render(scene, camera);
    return;
  }

  const elapsed = clock.getElapsedTime();

  // Idle rotation — slow continuous spin
  const idleRotation = elapsed * 0.3;

  // Scroll-driven rotation — full 360° sweep across the dish panel
  const scrollRotation = scrollProgress * Math.PI * 2;

  model.rotation.y = idleRotation + scrollRotation;

  // Idle float — gentle bob up and down
  model.position.y = modelBaseY + Math.sin(elapsed * 1.5) * 0.06;

  renderer.render(scene, camera);
}

/* ──────────────────────────────────────────
   Responsive
────────────────────────────────────────── */
function onResize() {
  if (isMobile()) {
    if (isInitialized) {
      dispose();
      showFallback();
    }
    return;
  }

  if (!isInitialized) {
    // Coming back from mobile — re-init
    removeFallback();
    setupScene();
    loadModel();
    animate();
    isInitialized = true;
    return;
  }

  if (!container || !renderer) return;

  const w = container.clientWidth;
  const h = container.clientHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

/* ──────────────────────────────────────────
   Cleanup
────────────────────────────────────────── */
function dispose() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (renderer) {
    renderer.dispose();
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }
  renderer = null;
  model = null;
  scene = null;
  camera = null;
  isInitialized = false;
}

/* ──────────────────────────────────────────
   Mobile Fallback
────────────────────────────────────────── */
function showFallback() {
  if (!container) return;
  // Don't duplicate
  if (container.querySelector('.canvas-fallback')) return;

  const img = document.createElement('img');
  img.src = '/assets/images/steak-fallback.png';
  img.alt = 'Premium steak';
  img.className = 'canvas-fallback';
  container.appendChild(img);
}

function removeFallback() {
  if (!container) return;
  const fb = container.querySelector('.canvas-fallback');
  if (fb) fb.remove();
}
