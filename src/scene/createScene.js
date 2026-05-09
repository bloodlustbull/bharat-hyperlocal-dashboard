import * as THREE from 'three';

const MAX_DPR = 2;

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060910);
  scene.fog = new THREE.FogExp2(0x060910, 0.018);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 18);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  const dpr = Math.min(window.devicePixelRatio, MAX_DPR);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const canvas = renderer.domElement;
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = '0';
  canvas.id = 'three-canvas';

  return { scene, camera, renderer, canvas, dpr };
}