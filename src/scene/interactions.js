import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(9999, 9999);
let currentHovered = null;

export function setupInteractions(camera, renderer, brandMeshes, onBrandClick, onBrandHover) {
  const canvas = renderer.domElement;

  canvas.addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  });

  canvas.addEventListener('click', (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    const clickables = brandMeshes.map((m) => m.userData.card).filter(Boolean);
    const intersects = raycaster.intersectObjects(clickables, false);

    if (intersects.length > 0) {
      const parentGroup = intersects[0].object.parent;
      if (parentGroup && parentGroup.userData.brandId) {
        if (onBrandClick) onBrandClick(parentGroup.userData.brandId);
      }
    }
  });

  return {
    update: () => {
      raycaster.setFromCamera(pointer, camera);
      const clickables = brandMeshes.map((m) => m.userData.card).filter(Boolean);
      const intersects = raycaster.intersectObjects(clickables, false);

      let hoveredId = null;

      if (intersects.length > 0) {
        const parentGroup = intersects[0].object.parent;
        if (parentGroup && parentGroup.userData.brandId) {
          hoveredId = parentGroup.userData.brandId;
        }
      }

      if (hoveredId !== currentHovered) {
        if (currentHovered && onBrandHover) {
          const prevMesh = brandMeshes.find((m) => m.userData.brandId === currentHovered);
          onBrandHover(prevMesh, false);
        }
        currentHovered = hoveredId;
        if (hoveredId && onBrandHover) {
          const mesh = brandMeshes.find((m) => m.userData.brandId === hoveredId);
          onBrandHover(mesh, true);
        }
        canvas.style.cursor = hoveredId ? 'pointer' : 'default';
      }
    },
    getMouse: () => pointer,
  };
}

export function applyParallax(camera, pointer, intensity = 0.4) {
  const targetX = pointer.x * intensity;
  const targetY = pointer.y * intensity;

  camera.position.x += (targetX - camera.position.x) * 0.04;
  camera.position.y += (targetY - camera.position.y) * 0.04;
  camera.lookAt(0, 0, 0);
}