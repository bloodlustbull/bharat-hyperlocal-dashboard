import * as THREE from 'three';

export function createParticles(scene, count = 600) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 60;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 5;
    sizes[i] = Math.random() * 2.5 + 0.5;
    speeds[i] = Math.random() * 0.3 + 0.1;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    color: 0xf7c948,
    size: 0.08,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  return { points, speeds, material };
}

export function animateParticles(particleSystem, time) {
  const positions = particleSystem.points.geometry.attributes.position.array;
  const count = positions.length / 3;

  for (let i = 0; i < count; i++) {
    positions[i * 3 + 1] += Math.sin(time * 0.5 + i) * 0.003 * particleSystem.speeds[i];
    positions[i * 3] += Math.cos(time * 0.3 + i * 0.7) * 0.002 * particleSystem.speeds[i];

    if (positions[i * 3 + 1] > 20) positions[i * 3 + 1] = -20;
    if (positions[i * 3 + 1] < -20) positions[i * 3 + 1] = 20;
  }

  particleSystem.points.geometry.attributes.position.needsUpdate = true;
}

export function setParticleColor(particleSystem, color) {
  particleSystem.material.color.set(color);
}