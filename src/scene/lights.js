import * as THREE from 'three';

export function addLights(scene) {
  const ambient = new THREE.AmbientLight(0x8b9dc3, 0.6);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xfff4e6, 1.2);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  const pointA = new THREE.PointLight(0xf7c948, 1.5, 50);
  pointA.position.set(-6, 4, 6);
  scene.add(pointA);

  const pointB = new THREE.PointLight(0x8b3cf7, 1.0, 50);
  pointB.position.set(6, -2, 4);
  scene.add(pointB);

  const pointC = new THREE.PointLight(0x22c55e, 0.6, 40);
  pointC.position.set(0, -6, 8);
  scene.add(pointC);

  const spot = new THREE.SpotLight(0xffffff, 0.8, 60, Math.PI / 6, 0.5, 1);
  spot.position.set(0, 12, 10);
  spot.target.position.set(0, 0, 0);
  scene.add(spot);
  scene.add(spot.target);

  return { ambient, dirLight, pointA, pointB, pointC, spot };
}

export function setThemeLights(lights, themeColor) {
  const color = new THREE.Color(themeColor);
  lights.pointA.color.copy(color);
  lights.pointA.intensity = 1.8;
}