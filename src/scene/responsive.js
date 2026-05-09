const MAX_DPR = 2;

export function setupResponsive(camera, renderer) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  window.addEventListener('resize', handleResize);
  handleResize();

  return {
    prefersReducedMotion: () => prefersReducedMotion.matches,
    destroy: () => {
      window.removeEventListener('resize', handleResize);
    },
  };
}

export function isMobile() {
  return window.innerWidth < 768;
}

export function isTablet() {
  return window.innerWidth >= 768 && window.innerWidth < 1024;
}

export function adjustCameraForDevice(camera) {
  if (isMobile()) {
    camera.position.set(0, 0, 24);
    camera.fov = 70;
  } else if (isTablet()) {
    camera.position.set(0, 0, 21);
    camera.fov = 65;
  } else {
    camera.position.set(0, 0, 18);
    camera.fov = 60;
  }
  camera.updateProjectionMatrix();
}