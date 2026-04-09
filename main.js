import './style.css';
import Lenis from '@studio-freight/lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

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

// Set up for animations and scene
console.log('App Initialized: Lenis and GSAP connected.');
