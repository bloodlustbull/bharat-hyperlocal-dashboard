import * as THREE from 'three';
import gsap from 'gsap';

const BRANDS = [
  { id: 'blinkit', name: 'Blinkit', color: 0xf7c948, emissive: 0xf7c948, textColor: '#f7c948', position: [-5.5, 2.5, 0] },
  { id: 'zepto', name: 'Zepto', color: 0x8b3cf7, emissive: 0x8b3cf7, textColor: '#8b3cf7', position: [5.5, 2.5, 0] },
  { id: 'instamart', name: 'Swiggy Instamart', color: 0xff5722, emissive: 0xff5722, textColor: '#ff5722', position: [-6, -2.5, 0] },
  { id: 'bigbasket_now', name: 'BigBasket Now', color: 0x22c55e, emissive: 0x22c55e, textColor: '#22c55e', accentColor: 0xef4444, position: [6, -2, 1] },
  { id: 'dunzo', name: 'Dunzo', color: 0x60a5fa, emissive: 0x60a5fa, textColor: '#60a5fa', accentColor: 0x22c55e, position: [0, -4.5, 0.5] },
];

function createCardMesh(brand) {
  const group = new THREE.Group();

  const cardGeo = new THREE.PlaneGeometry(2.8, 3.6, 1, 1);
  const cardMat = new THREE.MeshPhysicalMaterial({
    color: 0x0c1225,
    emissive: brand.emissive,
    emissiveIntensity: 0.08,
    metalness: 0.3,
    roughness: 0.4,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    clearcoat: 0.4,
    clearcoatRoughness: 0.2,
  });
  const card = new THREE.Mesh(cardGeo, cardMat);
  group.add(card);

  const borderGeo = new THREE.EdgesGeometry(cardGeo);
  const borderMat = new THREE.LineBasicMaterial({ color: brand.color, transparent: true, opacity: 0.6 });
  const border = new THREE.LineSegments(borderGeo, borderMat);
  group.add(border);

  const glowGeo = new THREE.PlaneGeometry(3.2, 4.0);
  const glowMat = new THREE.MeshBasicMaterial({
    color: brand.color,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.z = -0.05;
  group.add(glow);

  const sphereGeo = new THREE.SphereGeometry(0.55, 32, 32);
  const sphereMat = new THREE.MeshPhysicalMaterial({
    color: brand.color,
    emissive: brand.emissive,
    emissiveIntensity: 0.35,
    metalness: 0.5,
    roughness: 0.15,
    clearcoat: 0.8,
  });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.position.y = 0.5;
  group.add(sphere);

  const ringGeo = new THREE.RingGeometry(0.6, 0.68, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color: brand.color,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.5;
  ring.position.z = 0.02;
  group.add(ring);

  if (brand.accentColor) {
    const accentRingGeo = new THREE.RingGeometry(0.72, 0.78, 48, 1, Math.PI * 0.6, Math.PI * 0.8);
    const accentRingMat = new THREE.MeshBasicMaterial({
      color: brand.accentColor,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const accentRing = new THREE.Mesh(accentRingGeo, accentRingMat);
    accentRing.position.y = 0.5;
    accentRing.position.z = 0.03;
    group.add(accentRing);
  }

  group.userData = {
    brandId: brand.id,
    brandName: brand.name,
    brandColor: brand.color,
    textColor: brand.textColor,
    basePosition: new THREE.Vector3(...brand.position),
    hovered: false,
    ring,
    sphere,
    card,
    glow,
  };

  return group;
}

export function createBrandObjects(scene) {
  const brandMeshes = [];

  BRANDS.forEach((brand, i) => {
    const mesh = createCardMesh(brand);
    mesh.position.set(...brand.position);
    mesh.position.z = -15;
    mesh.scale.set(0.01, 0.01, 0.01);
    scene.add(mesh);
    brandMeshes.push(mesh);
  });

  return brandMeshes;
}

export function animateBrandEntry(brandMeshes, onComplete) {
  brandMeshes.forEach((mesh, i) => {
    gsap.to(mesh.position, {
      z: mesh.userData.basePosition.z,
      duration: 1.4,
      delay: i * 0.18 + 0.3,
      ease: 'power3.out',
    });
    gsap.to(mesh.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 1.2,
      delay: i * 0.18 + 0.3,
      ease: 'back.out(1.4)',
    });
  });

  const totalDelay = brandMeshes.length * 0.18 + 0.3 + 1.4;
  if (onComplete) setTimeout(onComplete, totalDelay * 1000);
}

export function animateBrandIdle(brandMeshes, time) {
  brandMeshes.forEach((mesh, i) => {
    const offset = i * 1.3;
    mesh.position.y = mesh.userData.basePosition.y + Math.sin(time * 0.8 + offset) * 0.25;
    mesh.rotation.y = Math.sin(time * 0.5 + offset) * 0.08;
    mesh.rotation.x = Math.sin(time * 0.4 + offset * 0.5) * 0.04;

    const ring = mesh.userData.ring;
    ring.rotation.z = time * 0.5 + offset;
    ring.scale.setScalar(1 + Math.sin(time * 1.2 + offset) * 0.08);
  });
}

export function hoverBrand(mesh, isHovered) {
  if (!mesh) return;
  mesh.userData.hovered = isHovered;

  gsap.to(mesh.scale, {
    x: isHovered ? 1.12 : 1,
    y: isHovered ? 1.12 : 1,
    z: isHovered ? 1.12 : 1,
    duration: 0.4,
    ease: 'power2.out',
  });

  gsap.to(mesh.userData.card.material, {
    emissiveIntensity: isHovered ? 0.2 : 0.08,
    opacity: isHovered ? 0.95 : 0.88,
    duration: 0.35,
  });

  gsap.to(mesh.userData.sphere.material, {
    emissiveIntensity: isHovered ? 0.6 : 0.35,
    duration: 0.35,
  });
}

export function animateBrandExit(brandMeshes, selectedId, onComplete) {
  brandMeshes.forEach((mesh) => {
    const isSelected = mesh.userData.brandId === selectedId;
    const targetZ = isSelected ? 3 : -20;
    const targetScale = isSelected ? 1.8 : 0.01;
    const targetOpacity = isSelected ? 1 : 0;

    gsap.to(mesh.position, {
      z: targetZ,
      duration: isSelected ? 1.2 : 0.8,
      ease: isSelected ? 'power2.out' : 'power2.in',
    });
    gsap.to(mesh.scale, {
      x: targetScale,
      y: targetScale,
      z: targetScale,
      duration: isSelected ? 1.2 : 0.6,
      ease: isSelected ? 'power2.out' : 'power2.in',
    });
    gsap.to(mesh.userData.card.material, {
      opacity: targetOpacity,
      duration: 0.6,
    });
  });

  if (onComplete) setTimeout(onComplete, 1500);
}