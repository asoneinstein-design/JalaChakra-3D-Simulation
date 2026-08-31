import * as THREE from 'three';

export class ParticleFlow {
  constructor(root, count = 520) {
    this.count = count;
    this.points = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({ color: 0x5af4dc, size: 0.16, transparent: true, opacity: 0.85, depthWrite: false })
    );
    root.add(this.points);
    this.samples = Array.from({ length: count }, (_, i) => ({ u: Math.random(), path: Math.floor(Math.random() * 4), speed: 0.07 + Math.random() * 0.18 }));
    this.positions = new Float32Array(count * 3);
    this.points.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
  }
  pathPoint(path, t, zOffset) {
    const slots = [-7.0, -2.35, 2.35, 7.0];
    const z0 = slots[path] || 0;
    if (t < 0.32) {
      const q = t / 0.32;
      return new THREE.Vector3(-27.0 + 8.5*q, 6.0 - 2.0*q, z0*(1-q) + z0*0.55*q + zOffset);
    }
    if (t < 0.52) {
      const q = (t-0.32)/0.20;
      return new THREE.Vector3(-18.5 + 5.0*q, 4.3 + 0.2*q, z0*0.55*(1-q)+zOffset);
    }
    if (t < 0.68) {
      const q = (t-0.52)/0.16;
      return new THREE.Vector3(-13.4 + 9.5*q, 4.4 + 0.4*q, zOffset);
    }
    if (t < 0.82) {
      const q=(t-0.68)/0.14;
      return new THREE.Vector3(-3.9 + 15*q, 5.0 + 0.1*Math.sin(q*Math.PI), zOffset);
    }
    const q=(t-0.82)/0.18;
    return new THREE.Vector3(11.1 + 17*q, 4.6 - 1.8*q, zOffset*0.55);
  }
  update(dt, state) {
    const throughput = Math.max(0.04, state.manifold.sourceExportFlowNm3h / 0.5);
    this.samples.forEach((p, i) => {
      p.u = (p.u + dt * p.speed * throughput) % 1.0;
      const v = this.pathPoint(p.path, p.u, (i % 17 - 8) * 0.055);
      this.positions[i*3] = v.x; this.positions[i*3+1] = v.y; this.positions[i*3+2] = v.z;
    });
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.visible = state.parameters.particleDensity > 0 && state.manifold.sourceExportFlowNm3h > 0.001;
    this.points.material.size = 0.07 + state.parameters.particleDensity / 1500;
  }
}
