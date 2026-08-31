import * as THREE from 'three';

export function createCamera(dom) {
  const camera = new THREE.PerspectiveCamera(42, Math.max(1, dom.clientWidth) / Math.max(1, dom.clientHeight), 0.1, 500);
  const target = new THREE.Vector3(2.5, 4.5, 0);
  const defaultTarget = target.clone();
  const spherical = new THREE.Spherical(78, 1.08, 0.35);
  const pan = new THREE.Vector3();
  let orbiting = false;
  let panning = false;
  let last = { x: 0, y: 0 };

  function apply() {
    const offset = new THREE.Vector3().setFromSpherical(spherical);
    camera.position.copy(target).add(pan).add(offset);
    camera.lookAt(target.clone().add(pan));
  }

  function focus(pos, distance = 34, phi = 1.08, theta = 0.35) {
    target.copy(pos);
    pan.set(0, 0, 0);
    spherical.radius = THREE.MathUtils.clamp(distance, 10, 150);
    spherical.phi = THREE.MathUtils.clamp(phi, 0.28, 1.52);
    spherical.theta = theta;
    apply();
  }

  function home() { focus(defaultTarget, 78, 1.08, 0.35); }
  function zoomBy(factor) {
    spherical.radius = THREE.MathUtils.clamp(spherical.radius * factor, 10, 150);
    apply();
  }
  function topView() { focus(target.clone(), 64, 0.42, 0.0); }
  function isoView() { focus(target.clone(), 62, 0.95, 0.42); }

  dom.style.touchAction = 'none';
  dom.addEventListener('contextmenu', e => e.preventDefault());
  dom.addEventListener('pointerdown', e => {
    orbiting = e.button === 0 && !e.shiftKey;
    panning = e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey);
    last.x = e.clientX; last.y = e.clientY;
    dom.setPointerCapture?.(e.pointerId);
  });
  dom.addEventListener('pointerup', e => { orbiting = false; panning = false; dom.releasePointerCapture?.(e.pointerId); });
  dom.addEventListener('pointercancel', e => { orbiting = false; panning = false; dom.releasePointerCapture?.(e.pointerId); });
  dom.addEventListener('pointermove', e => {
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    last.x = e.clientX; last.y = e.clientY;
    if (orbiting) {
      spherical.theta -= dx * 0.006;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + dy * 0.005, 0.22, 1.52);
      apply();
    } else if (panning) {
      const scale = spherical.radius * 0.0017;
      const right = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      right.crossVectors(camera.getWorldDirection(new THREE.Vector3()), up).normalize();
      pan.addScaledVector(right, -dx * scale);
      pan.y += dy * scale;
      apply();
    }
  });
  dom.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = Math.exp(e.deltaY * 0.001);
    zoomBy(factor);
  }, { passive: false });

  home();
  return { camera, focus, home, zoomBy, topView, isoView, update() {} };
}
