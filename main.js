import './style.css';
import Lenis from '@studio-freight/lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initAnimations } from './src/animations.js';
import { initScene } from './src/scene.js';
import { initWineScene } from './src/wineScene.js';

gsap.registerPlugin(ScrollTrigger);

// Initialize Lenis
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  direction: 'vertical',
  gestureDirection: 'vertical',
  smooth: true,
  mouseMultiplier: 1,
  smoothTouch: false,
  touchMultiplier: 2,
  infinite: false,
});

// Update ScrollTrigger on Lenis scroll
lenis.on('scroll', ScrollTrigger.update);

// Connect GSAP ticker to Lenis rAF
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});

// Disable GSAP lag smoothing to prevent conflicts
gsap.ticker.lagSmoothing(0);

// Initialize GSAP ScrollTrigger animations
initAnimations();

// Initialize the Three.js 3D scenes
initScene();
initWineScene();

/* ========================================================================
   PRELOADER — visual-only fade, no scroll interference
   ======================================================================== */
const preloader = document.getElementById('preloader');
const preloaderFill = document.getElementById('preloader-bar-fill');
let loadProgress = 0;

function advancePreloader(target) {
  const step = () => {
    if (loadProgress < target) {
      loadProgress += 2;
      if (preloaderFill) preloaderFill.style.width = `${Math.min(loadProgress, target)}%`;
      requestAnimationFrame(step);
    }
  };
  step();
}

advancePreloader(40);

window.addEventListener('load', () => {
  advancePreloader(100);
  setTimeout(() => {
    if (preloader) preloader.classList.add('is-hidden');
  }, 800);
});

/* ========================================================================
   CUSTOM CURSOR
   ======================================================================== */
const cursor = document.getElementById('custom-cursor');
const cursorDot = document.getElementById('custom-cursor-dot');
let mouseX = 0, mouseY = 0;
let cursorX = 0, cursorY = 0;

function isTouchDevice() {
  return window.matchMedia('(hover: none)').matches;
}

if (!isTouchDevice() && cursor && cursorDot) {
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    cursorDot.style.left = `${mouseX}px`;
    cursorDot.style.top = `${mouseY}px`;

    if (!cursor.classList.contains('is-visible')) {
      cursor.classList.add('is-visible');
      cursorDot.classList.add('is-visible');
    }
  });

  document.addEventListener('mouseleave', () => {
    cursor.classList.remove('is-visible');
    cursorDot.classList.remove('is-visible');
  });

  document.addEventListener('mouseenter', () => {
    cursor.classList.add('is-visible');
    cursorDot.classList.add('is-visible');
  });

  function animateCursor() {
    cursorX += (mouseX - cursorX) * 0.12;
    cursorY += (mouseY - cursorY) * 0.12;
    cursor.style.left = `${cursorX}px`;
    cursor.style.top = `${cursorY}px`;
    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  const hoverTargets = document.querySelectorAll(
    'a, button, .menu-card, .cta-button, .gallery-img, input'
  );
  hoverTargets.forEach((el) => {
    el.addEventListener('mouseenter', () => cursor.classList.add('is-hovering'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('is-hovering'));
  });
}

/* ========================================================================
   NAVIGATION — scroll-aware backdrop (simple scroll listener, no ST)
   ======================================================================== */
const nav = document.getElementById('navigation');

if (nav) {
  lenis.on('scroll', ({ scroll }) => {
    if (scroll > 80) {
      nav.classList.add('is-scrolled');
    } else {
      nav.classList.remove('is-scrolled');
    }
  });
}

/* ========================================================================
   MOBILE HAMBURGER MENU
   ======================================================================== */
const hamburger = document.getElementById('nav-hamburger');
const navLinks = document.getElementById('nav-links');

if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('is-open');
    navLinks.classList.toggle('is-open');
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('is-open');
      navLinks.classList.remove('is-open');
    });
  });
}

/* ========================================================================
   RESERVATION FORM
   ======================================================================== */
const form = document.querySelector('.reservation-form');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const btn = form.querySelector('.cta-button');
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = 'Reserved! ✨';
      btn.style.borderColor = '#4CAF50';
      btn.style.color = '#4CAF50';

      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.borderColor = '';
        btn.style.color = '';
        form.reset();
      }, 2500);
    }
  });
}

console.log('IGNIS initialized — Lenis, GSAP, Three.js, cursor, and preloader connected.');
