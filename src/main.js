import * as THREE from 'three';
import gsap from 'gsap';
import { createScene } from './scene/createScene.js';
import { addLights, setThemeLights } from './scene/lights.js';
import { createParticles, animateParticles, setParticleColor } from './scene/particles.js';
import { createBrandObjects, animateBrandEntry, animateBrandIdle, hoverBrand, animateBrandExit } from './scene/brandObjects.js';
import { setupInteractions, applyParallax } from './scene/interactions.js';
import { setupResponsive, isMobile, adjustCameraForDevice } from './scene/responsive.js';
import './styles/main.css';

const APP_STATE = {
  phase: 'intro',
  selectedBrand: null,
  reducedMotion: false,
};

const BRAND_THEMES = {
  blinkit: { primary: '#f7c948', threeColor: 0xf7c948, className: 'blinkit' },
  zepto: { primary: '#8b3cf7', threeColor: 0x8b3cf7, className: 'zepto' },
  instamart: { primary: '#ff5722', threeColor: 0xff5722, className: 'instamart' },
  bigbasket_now: { primary: '#22c55e', threeColor: 0xef4444, accentColor: 0xef4444, className: 'bigbasket_now' },
  dunzo: { primary: '#60a5fa', threeColor: 0x22c55e, accentColor: 0xfbbf24, className: 'dunzo' },
};

let brandMeshes = [];

function init() {
  const { scene, camera, renderer, canvas } = createScene();
  const lights = addLights(scene);
  const particles = createParticles(scene, isMobile() ? 300 : 600);
  brandMeshes = createBrandObjects(scene);
  const responsive = setupResponsive(camera, renderer);

  APP_STATE.reducedMotion = responsive.prefersReducedMotion();

  adjustCameraForDevice(camera);

  document.getElementById('three-container').appendChild(canvas);

  const interactions = setupInteractions(camera, renderer, brandMeshes, onBrandClick, onBrandHover);

  const timer = new THREE.Timer();
  timer.connect(document);

  function animate(timestamp) {
    requestAnimationFrame(animate);
    timer.update(timestamp);
    const elapsed = timer.getElapsed();

    if (!APP_STATE.reducedMotion) {
      animateParticles(particles, elapsed);
    }

    if (APP_STATE.phase === 'brandMap' || APP_STATE.phase === 'intro') {
      animateBrandIdle(brandMeshes, elapsed);
    }

    if (APP_STATE.phase !== 'dashboard') {
      const mouse = interactions.getMouse();
      applyParallax(camera, mouse, APP_STATE.reducedMotion ? 0.1 : 0.4);
    }

    interactions.update();
    renderer.render(scene, camera);
  }

  animate();
  showIntroOverlay();
  startIntroSequence();
}

function showIntroOverlay() {
  const overlay = document.getElementById('three-overlay');
  if (!overlay) return;

  gsap.fromTo('#intro-eyebrow', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.3 });
  gsap.fromTo('#intro-title', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.9, delay: 0.5 });
  gsap.fromTo('#intro-subtitle', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.8 });
  gsap.fromTo('#intro-cta', { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.6, delay: 1.2, ease: 'back.out(1.5)' });
}

function startIntroSequence() {
  setTimeout(() => {
    animateBrandEntry(brandMeshes, () => {});
  }, 800);
}

function onBrandClick(brandId) {
  if (APP_STATE.phase !== 'brandMap') return;
  selectBrand(brandId);
}

function onBrandHover(mesh, isHovered) {
  hoverBrand(mesh, isHovered);

  const label = document.getElementById('brand-label');
  if (!label) return;
  if (isHovered && mesh) {
    label.textContent = mesh.userData.brandName;
    label.style.color = mesh.userData.textColor;
    label.classList.add('visible');
  } else {
    label.classList.remove('visible');
  }
}

function selectBrand(brandId) {
  APP_STATE.selectedBrand = brandId;
  APP_STATE.phase = 'transitioning';

  const theme = BRAND_THEMES[brandId];
  if (theme) {
    document.documentElement.style.setProperty('--theme-primary', theme.primary);
  }

  animateBrandExit(brandMeshes, brandId, () => {
    transitionToDashboard(brandId);
  });

  const overlay = document.getElementById('three-overlay');
  if (overlay) {
    gsap.to(overlay, {
      opacity: 0,
      duration: 0.6,
      delay: 0.5,
      onComplete: () => {
        overlay.classList.add('hidden');
      },
    });
  }
}

function transitionToDashboard(brandId) {
  APP_STATE.phase = 'dashboard';

  const canvas = document.getElementById('three-canvas');
  if (canvas) {
    gsap.to(canvas, { opacity: 0, duration: 0.5, onComplete: () => canvas.remove() });
  }

  const container = document.getElementById('three-container');
  if (container) container.classList.add('hidden');

  if (typeof window.enterDashboard === 'function') {
    window.enterDashboard(brandId);
  } else {
    document.body.dataset.platform = brandId;
    const theme = BRAND_THEMES[brandId];
    if (theme) {
      document.documentElement.style.setProperty('--theme-primary', theme.primary);
    }
  }

  const dashboardView = document.getElementById('dashboardView');
  if (dashboardView) {
    dashboardView.classList.add('view-active');
  }

  const landingView = document.getElementById('landingView');
  if (landingView) landingView.classList.remove('view-active');

  const brandMapView = document.getElementById('brandMapView');
  if (brandMapView) brandMapView.classList.remove('view-active');
}

function showBrandMap() {
  if (typeof window.showBrandMap === 'function') {
    window.showBrandMap();
    return;
  }

  APP_STATE.phase = 'brandMap';

  const threeContainer = document.getElementById('three-container');
  if (threeContainer) threeContainer.classList.add('hidden');

  const overlay = document.getElementById('three-overlay');
  if (overlay) overlay.classList.add('hidden');

  const landingView = document.getElementById('landingView');
  if (landingView) {
    landingView.style.display = '';
    landingView.classList.remove('view-active');
  }

  const brandMapView = document.getElementById('brandMapView');
  if (brandMapView) {
    brandMapView.style.display = '';
    brandMapView.classList.add('view-active');
  }

  const introContent = document.getElementById('intro-content');
  if (introContent) {
    gsap.to(introContent, {
      opacity: 0,
      y: -30,
      duration: 0.5,
      onComplete: () => {
        introContent.classList.add('hidden');
      },
    });
  }

  const brandHint = document.getElementById('brand-hint');
  if (brandHint) {
    brandHint.classList.remove('hidden');
    gsap.fromTo(brandHint, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const ctaBtn = document.getElementById('intro-cta');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', showBrandMap);
    }
    init();
  });
} else {
  const ctaBtn = document.getElementById('intro-cta');
  if (ctaBtn) {
    ctaBtn.addEventListener('click', showBrandMap);
  }
  init();
}

export { APP_STATE, BRAND_THEMES };
