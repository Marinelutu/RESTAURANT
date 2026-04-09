import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { setScrollProgress } from './scene.js';
import { setWineScrollProgress } from './wineScene.js';

gsap.registerPlugin(ScrollTrigger);

/**
 * Labyrinth scroll pattern:
 *   1. →  Hero         (step RIGHT — first panel, on-load entrance)
 *   2. →  Dish         (step RIGHT — horizontal scrub)
 *   3. →  Menu         (step RIGHT — horizontal scrub)
 *   4. ↓  About        (step IN  — vertical fade-up)
 *   5. →  Gallery      (step RIGHT — horizontal pin+scrub)
 *   6. ↓  CTA          (step IN  — vertical fade-up)
 */

export function initAnimations() {
  heroEntrance();
  horizontalTrack();
  aboutReveal();
  trackGalleryWine();
  ctaReveal();
}

/* ────────────────────────────────────────────
   1 →  HERO — on-load staggered entrance (first panel)
──────────────────────────────────────────── */
function heroEntrance() {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  gsap.set('.hero h1', { opacity: 0, y: 60 });
  gsap.set('.hero .tagline', { opacity: 0, y: 40 });
  gsap.set('.hero .cta-button', { opacity: 0, y: 30 });

  tl.to('.hero h1', {
    opacity: 1,
    y: 0,
    duration: 1.2,
    delay: 0.3,
  })
    .to(
      '.hero .tagline',
      { opacity: 1, y: 0, duration: 1 },
      '-=0.7'
    )
    .to(
      '.hero .cta-button',
      { opacity: 1, y: 0, duration: 0.8 },
      '-=0.5'
    );
}

/* ────────────────────────────────────────────
   1-2-3 →→→  HERO + DISH + MENU — 3-panel horizontal pin & scrub
──────────────────────────────────────────── */
function horizontalTrack() {
  const track = document.getElementById('track-dishes');
  if (!track) return;
  const panels = track.querySelector('.horizontal-panels');
  if (!panels) return;

  // ---------- Main horizontal tween (3 panels) ----------
  const scrollTween = gsap.to(panels, {
    x: () => -(panels.scrollWidth - window.innerWidth),
    ease: 'none',
    scrollTrigger: {
      trigger: track,
      start: 'top top',
      end: () => `+=${panels.scrollWidth - window.innerWidth}`,
      pin: true,
      scrub: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        // Feed normalized scroll progress (0→1) to the 3D scene
        setScrollProgress(self.progress);
      },
    },
  });

  // ---------- Dish content reveals (2nd panel) ----------
  gsap.set(['.dish h2', '.dish-content p'], { opacity: 0, y: 40 });

  gsap.to('.dish h2', {
    opacity: 1,
    y: 0,
    duration: 0.5,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '.dish h2',
      containerAnimation: scrollTween,
      start: 'left 80%',
    },
  });

  gsap.to('.dish-content p', {
    opacity: 1,
    y: 0,
    duration: 0.5,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '.dish-content p',
      containerAnimation: scrollTween,
      start: 'left 75%',
    },
  });

  // ---------- Menu content reveals (3rd panel) ----------
  gsap.set('.menu h2', { opacity: 0, y: 40 });
  gsap.set('.menu-card', { opacity: 0, y: 40 });

  gsap.to('.menu h2', {
    opacity: 1,
    y: 0,
    duration: 0.5,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '.menu h2',
      containerAnimation: scrollTween,
      start: 'left 80%',
    },
  });

  const cards = gsap.utils.toArray('.menu-card');
  cards.forEach((card) => {
    gsap.to(card, {
      opacity: 1,
      y: 0,
      duration: 0.5,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: card,
        containerAnimation: scrollTween,
        start: 'left 85%',
      },
    });
  });
}

/* ────────────────────────────────────────────
   4 ↓  ABOUT — vertical fade-up
──────────────────────────────────────────── */
function aboutReveal() {
  gsap.set('.about-grid', { opacity: 0, y: 80 });

  gsap.to('.about-grid', {
    opacity: 1,
    y: 0,
    duration: 1.2,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '.about',
      start: 'top 80%',
      toggleActions: 'play none none reverse',
    },
  });
}

/* ────────────────────────────────────────────
   5 ↓  TRACK 2 — Gallery → Wine Text → Wine 3D
──────────────────────────────────────────── */
function trackGalleryWine() {
  const track = document.getElementById('track-gallery-wine');
  if (!track) return;
  const panels = track.querySelector('.track-2-panels');

  const getScrollAmount = () => -(panels.scrollWidth - window.innerWidth);

  // We build a timeline with two steps: 
  // 1. Slide panels horizontally.
  // 2. Pause horizontally and use the remaining scrub progress to pour the wine.
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: track,
      start: 'top top',
      // Added +200% viewport height to give the pour animation long scrub duration
      end: () => `+=${panels.scrollWidth + window.innerWidth * 2}`,
      pin: true,
      scrub: 1,
      invalidateOnRefresh: true,
      onUpdate: () => {
        const p = tl.progress();
        // Since step 1 duration is 1, and step 2 duration is 0.8:
        // The horizontal transition finishes at 1 / 1.8 = ~0.555 progress
        const ratio = 1 / 1.8;
        
        if (p <= ratio) {
          setWineScrollProgress(0);
        } else {
          setWineScrollProgress((p - ratio) / (1 - ratio));
        }
      }
    }
  });

  tl.to(panels, {
    x: getScrollAmount,
    ease: 'none',
    duration: 1
  });

  tl.to({}, { 
    duration: 0.8
  });
}

/* ────────────────────────────────────────────
   6 ↓  CTA — vertical fade-up
──────────────────────────────────────────── */
function ctaReveal() {
  const container = document.querySelector('.cta-container');
  if (!container) return;

  gsap.set(container, { opacity: 0, y: 60 });

  gsap.to(container, {
    opacity: 1,
    y: 0,
    duration: 1,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '.cta',
      start: 'top 80%',
      toggleActions: 'play none none reverse',
    },
  });
}
