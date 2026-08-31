import * as THREE from 'three';
import { ASSUMPTIONS, COLORS, REFERENCE, CLAMP } from '../core/config.js';

function standard(color, metalness = 0.65, roughness = 0.32, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...opts });
}
function labelTexture(text, color = '#dffaf7', bg = 'rgba(4,10,13,.86)') {
  const c = document.createElement('canvas'); c.width = 860; c.height = 160;
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.font = '700 38px Arial'; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2);
  return new THREE.CanvasTexture(c);
}
function label(text, scale = 4.2) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(text), transparent: true, depthTest: false }));
  s.scale.set(scale, 0.78, 1); return s;
}
function tag(parent, text, pos, scale = 3.8) { const s = label(text, scale); s.position.copy(pos); parent.add(s); return s; }
function cylBetween(a, b, r, material, radial = 16) {
  const dir = new THREE.Vector3().subVectors(b, a); const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, radial), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}
function pipe(a, b, r = 0.15, gas = false) { return cylBetween(a, b, r, standard(gas ? COLORS.pipeGas : COLORS.pipeDark, 0.8, 0.28)); }
function boltRing(parent, radius, y, count = 8, r = 0.055) {
  const m = standard(COLORS.steelDark, 0.85, 0.2);
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.12, 10), m);
    b.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius); parent.add(b);
  }
}
function spring(radius, turns, height, material) {
  class C extends THREE.Curve { getPoint(t) { const a = t * Math.PI * 2 * turns; return new THREE.Vector3(radius * Math.cos(a), t * height - height / 2, radius * Math.sin(a)); } }
  return new THREE.Mesh(new THREE.TubeGeometry(new C(), 96, 0.035, 7, false), material);
}
function gear(radius, teeth, depth, material) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.68, radius * 0.68, depth, 32), material); core.rotation.z = Math.PI / 2; g.add(core);
  for (let i = 0; i < teeth; i++) {
    const a = i / teeth * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.22, depth * 0.96, radius * 0.35), material);
    t.rotation.y = a; t.position.set(Math.cos(a) * radius * 0.86, 0, Math.sin(a) * radius * 0.86); g.add(t);
  }
  return g;
}
function gauge(radius = 0.42) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.18, 24), standard(COLORS.steelDark, 0.9, 0.2)); body.rotation.z = Math.PI / 2; g.add(body);
  const face = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.82, 32), standard(0xeaece9, 0.2, 0.5)); face.rotation.y = Math.PI / 2; face.position.x = 0.11; g.add(face);
  for (let i = 0; i < 9; i++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.68, 0.025, 0.025), standard(COLORS.black, 0.2, 0.6));
    tick.position.set(0.17, 0, 0); tick.rotation.z = -0.75 + i * 1.5 / 8; g.add(tick);
  }
  const needle = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.73, 0.04, 0.028), standard(COLORS.danger, 0.3, 0.3)); needle.position.x = 0.19; g.add(needle);
  return { group: g, needle };
}

function makeAgitator(i) {
  const g = new THREE.Group();
  const zSlots = [-7.0, -2.35, 2.35, 7.0];
  g.position.set(-27.0, 0, zSlots[i]);
  g.scale.setScalar(0.68);

  const vessel = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 2.65, 4.8, 48), standard(COLORS.steel, 0.75, 0.28, { transparent: true, opacity: 0.23, side: THREE.DoubleSide, depthWrite: false })); shell.position.y = 2.4; vessel.add(shell);
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.22, 48), standard(COLORS.steelDark, 0.86, 0.24)); bottom.position.y = 0; vessel.add(bottom);
  const slurry = new THREE.Mesh(new THREE.CylinderGeometry(2.54, 2.54, 2.45, 48), standard(COLORS.slurry, 0.22, 0.72, { transparent: true, opacity: 0.9 })); slurry.position.y = 1.25; vessel.add(slurry);
  const gas = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.55, 1.18, 48), standard(COLORS.gas, 0.15, 0.5, { transparent: true, opacity: 0.09, emissive: COLORS.gas, emissiveIntensity: 0.55 })); gas.position.y = 3.76; vessel.add(gas);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(2.78, 2.78, 0.26, 48), standard(COLORS.steelDark, 0.88, 0.2)); lid.position.y = 4.86; vessel.add(lid); boltRing(vessel, 2.38, 4.98, 16, 0.065);

  const actuator = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.83, 0.83, 0.24, 28), standard(COLORS.steelDark, 0.86, 0.2)); cap.position.y = 8.12; actuator.add(cap); boltRing(actuator, 0.7, 8.23, 8, 0.045);
  const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 2.15, 32), standard(COLORS.steel, 0.76, 0.28, { transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false })); cylinder.position.y = 7.05; actuator.add(cylinder);
  const topFitting = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.45, 18), standard(COLORS.brass, 0.8, 0.26)); topFitting.position.y = 8.5; actuator.add(topFitting);
  const inlet = pipe(new THREE.Vector3(-0.6, 8.48, 0), new THREE.Vector3(-0.6, 9.4, 0), 0.12, true); actuator.add(inlet);
  const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.22, 24), standard(COLORS.steel, 0.82, 0.22)); piston.position.y = 7.2; actuator.add(piston);
  const pistonRod = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 1.35, 16), standard(COLORS.steelDark, 0.85, 0.2)); pistonRod.position.y = 6.35; actuator.add(pistonRod);
  const sp = spring(0.38, 7, 1.25, standard(COLORS.brass, 0.78, 0.27)); sp.position.y = 6.65; actuator.add(sp);
  const tripCollar = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.055, 8, 24), standard(COLORS.brass, 0.75, 0.25)); tripCollar.position.y = 5.75; actuator.add(tripCollar);

  const leverPivot = new THREE.Group(); leverPivot.position.set(0.85, 5.75, 0); actuator.add(leverPivot);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.18, 0.16), standard(COLORS.brass, 0.6, 0.34)); lever.position.x = 0.55; leverPivot.add(lever);
  const counter = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.38, 18), standard(COLORS.steelDark, 0.85, 0.22)); counter.rotation.z = Math.PI / 2; counter.position.x = 1.8; leverPivot.add(counter);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.3, 18), standard(COLORS.steelDark, 0.86, 0.2)); pin.rotation.z = Math.PI / 2; leverPivot.add(pin);

  const esc = new THREE.Group(); esc.position.set(2.42, 4.72, 0); actuator.add(esc);
  const ratchet = gear(0.88, 24, 0.22, standard(COLORS.steelDark, 0.88, 0.2)); esc.add(ratchet);
  const pawlPivot = new THREE.Group(); pawlPivot.position.set(-0.6, 0.35, 0); esc.add(pawlPivot);
  const pawl = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.13, 0.14), standard(COLORS.brass, 0.55, 0.34)); pawl.position.x = 0.45; pawlPivot.add(pawl);
  const escapementWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.32, 20), standard(COLORS.brassDark, 0.78, 0.28)); escapementWheel.rotation.z = Math.PI / 2; escapementWheel.position.x = -0.12; pawlPivot.add(escapementWheel);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.15, 18), standard(COLORS.steelDark, 0.86, 0.2)); shaft.position.y = 2.45; actuator.add(shaft);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.32, 20), standard(COLORS.steelDark, 0.84, 0.22)); hub.rotation.x = Math.PI / 2; hub.position.set(0, 0.58, 0); vessel.add(hub);
  const paddles = new THREE.Group(); paddles.position.y = 1.28; vessel.add(paddles);
  for (let k = 0; k < 4; k++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.13, 0.12), standard(COLORS.steel, 0.76, 0.28)); arm.position.x = 0.8; arm.rotation.y = k * Math.PI / 2; paddles.add(arm);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.5), standard(COLORS.steel, 0.78, 0.3)); blade.position.x = 1.44; blade.rotation.z = 0.17; blade.rotation.y = k * Math.PI / 2; paddles.add(blade);
  }

  const relief = new THREE.Group(); relief.position.set(-2.25, 5.55, 0); actuator.add(relief);
  const rvBody = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.68, 20), standard(COLORS.brass, 0.72, 0.3)); rvBody.rotation.z = Math.PI / 2; relief.add(rvBody);
  const rvSpring = spring(0.16, 5, 0.44, standard(COLORS.brass, 0.78, 0.28)); rvSpring.rotation.z = Math.PI / 2; relief.add(rvSpring);
  const rvDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 16), standard(COLORS.steelDark, 0.84, 0.23)); rvDisc.rotation.z = Math.PI / 2; rvDisc.position.x = 0.36; relief.add(rvDisc);
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.32, 12), standard(COLORS.brassDark, 0.8, 0.25)); screw.rotation.z = Math.PI / 2; screw.position.x = -0.45; relief.add(screw);

  const pg = gauge(0.42); pg.group.position.set(0.95, 8.9, 0); actuator.add(pg.group);
  tag(g, `DIGESTER ${String.fromCharCode(65 + i)}`, new THREE.Vector3(0, 11.4, 0), 4.2);
  tag(g, `SELF-WINDING ESCAPEMENT • ${REFERENCE.agitator.paddleDiameterMm} mm PADDLE`, new THREE.Vector3(0, 10.75, 0), 3.8);
  tag(g, `5–20 kPa • 8–15 kPa TRIP • 70 mm STROKE`, new THREE.Vector3(0, -1.0, 0), 3.4);

  g.add(vessel, actuator);
  g.userData = {
    type: 'AGITATOR', name: `Digester ${String.fromCharCode(65 + i)} / Self-Winding Escapement`,
    desc: 'Pressure inlet → piston → compression spring → adjustable trip collar → counterweighted lever → pawl → one-tooth ratchet advance → drive shaft → four 320 mm paddles. Relief valve protects against over-pressure and jam-induced stall.',
    vessel, actuator, piston, pistonRod, sp, tripCollar, leverPivot, ratchet, pawlPivot, shaft, paddles, relief, rvDisc, rvSpring, gauge: pg.group,
    cutaway: [shell, cylinder, gas, lid],
  };
  return g;
}

function makeValveStation(i) {
  const threshold = REFERENCE.manifold.thresholdKpa[i];
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.74, 28, 18), standard(COLORS.brass, 0.75, 0.25)); body.scale.y = 0.7; g.add(body);
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.48, 24), standard(COLORS.brassDark, 0.7, 0.3)); lower.position.y = -0.48; g.add(lower);
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.0, 28), standard(COLORS.steel, 0.78, 0.28, { transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })); upper.position.y = 0.5; g.add(upper);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.72, 24), standard(COLORS.water, 0.2, 0.4, { transparent: true, opacity: 0.45, emissive: COLORS.water, emissiveIntensity: 0.15 })); water.position.y = 0.18; g.add(water);
  const diaphragm = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 10, 30), standard(COLORS.rubber, 0.35, 0.7)); diaphragm.position.y = -0.05; g.add(diaphragm);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.72, 14), standard(COLORS.steelDark, 0.82, 0.22)); rod.position.y = 0.48; g.add(rod);
  const springMesh = spring(0.18, 5, 0.46, standard(COLORS.brass, 0.78, 0.28)); springMesh.position.y = 0.85; g.add(springMesh);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.12, 20), standard(COLORS.brassDark, 0.75, 0.3)); disc.rotation.z = Math.PI / 2; disc.position.y = -0.48; g.add(disc);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.06, 8, 22), standard(COLORS.brassDark, 0.75, 0.3)); wheel.position.set(0.72, -0.25, 0); wheel.rotation.y = Math.PI / 2; g.add(wheel);
  const trapGauge = gauge(0.31); trapGauge.group.position.set(0.0, 1.45, 0); trapGauge.group.rotation.y = Math.PI; g.add(trapGauge.group);
  tag(g, `${String.fromCharCode(65 + i)} • ${threshold} kPa`, new THREE.Vector3(0, 2.15, 0), 2.6);
  g.userData = { threshold, body, upper, water, rod, spring: springMesh, disc, wheel, gauge: trapGauge.group, needle: trapGauge.needle };
  return g;
}

function makeManifold() {
  const g = new THREE.Group();
  g.position.set(-13.4, 4.35, 0);
  const header = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 9.4, 32), standard(COLORS.brass, 0.73, 0.3)); header.rotation.z = Math.PI / 2; g.add(header);
  const stations = [];
  [-3.55, -1.18, 1.18, 3.55].forEach((x, i) => { const s = makeValveStation(i); s.position.set(x, 1.0, 0); g.add(s); stations.push(s); });
  const inlet = pipe(new THREE.Vector3(-5.2, 0.3, 0), new THREE.Vector3(-4.6, 0.3, 0), 0.18, true); inlet.position.set(-5.2, 0.3, 0); g.add(inlet);
  const outlet = pipe(new THREE.Vector3(4.7, 0.3, 0), new THREE.Vector3(5.7, 0.3, 0), 0.18, true); outlet.position.set(4.7, 0.3, 0); g.add(outlet);
  tag(g, 'PRIORITY-VALVE MANIFOLD', new THREE.Vector3(0, 3.35, 0), 4.8);
  tag(g, 'A 8 kPa • B 10 kPa • C 12 kPa • D 14 kPa', new THREE.Vector3(0, 2.8, 0), 3.6);
  g.userData = { type: 'MANIFOLD', name: 'Priority-Valve Manifold', desc: 'Four source-side sealed pressure traps compare each digester pressure against the downstream surge-bell pressure plus an 8 / 10 / 12 / 14 kPa cracking threshold. Hysteresis prevents chatter and check valves prevent reverse flow. The valves pool surplus gas into the common header; household delivery happens downstream.', stations, header };
  return g;
}

function makeSurge() {
  const g = new THREE.Group(); g.position.set(-3.4, 1.8, 0);
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 5.8, 40), standard(COLORS.steel, 0.78, 0.28, { transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })); shell.position.y = 2.9; g.add(shell);
  const top = new THREE.Mesh(new THREE.SphereGeometry(2.12, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), standard(COLORS.steelDark, 0.82, 0.24)); top.position.y = 5.8; g.add(top);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.3, 40), standard(COLORS.steelDark, 0.84, 0.24)); base.position.y = 0; g.add(base);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.88, 1.88, 1.05, 36), standard(COLORS.water, 0.18, 0.38, { transparent: true, opacity: 0.52, emissive: COLORS.water, emissiveIntensity: 0.12 })); water.position.y = 0.58; g.add(water);
  const bellows = new THREE.Group();
  for (let i = 0; i < 8; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45 + 0.10 * (i % 2), 0.12, 8, 36), standard(COLORS.steelDark, 0.8, 0.24)); ring.position.y = 2.2 + i * 0.38; bellows.add(ring); }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.8, 18), standard(COLORS.steelDark, 0.86, 0.22)); stem.position.y = 2.6; bellows.add(stem);
  const float = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), standard(COLORS.steel, 0.8, 0.26)); float.position.y = 1.7; bellows.add(float);
  g.add(bellows);
  const inlet = pipe(new THREE.Vector3(-4.4, 3.2, 0), new THREE.Vector3(-2.1, 3.2, 0), 0.18, true); g.add(inlet);
  const outlet = pipe(new THREE.Vector3(2.1, 3.8, 0), new THREE.Vector3(4.2, 3.8, 0), 0.18, true); g.add(outlet);
  const drain = pipe(new THREE.Vector3(0, 0.0, 0), new THREE.Vector3(0, -0.8, 0), 0.11, false); g.add(drain);
  const pg = gauge(0.36); pg.group.position.set(0, 6.5, 0); g.add(pg.group);
  tag(g, 'SURGE BELL ACCUMULATOR', new THREE.Vector3(0, 7.2, 0), 4.0);
  tag(g, '300 mm Ø • 900 mm H • 12–20 L usable storage', new THREE.Vector3(0, 6.72, 0), 3.0);
  g.userData = { type: 'SURGE', name: 'Surge Bell Accumulator', desc: 'Water-sealed gas accumulator. A flexible bellows/diaphragm expands and contracts against the water seal, storing surplus gas and releasing it when demand exceeds supply. Relief protects the downstream line.', shell, bellows, stem, float, gauge: pg.group, inlet, outlet };
  return g;
}

function makePurifier() {
  const g = new THREE.Group(); g.position.set(6.8, 0.5, 0);
  const stageMedia = [COLORS.media1, COLORS.media2, COLORS.media3, COLORS.media4];
  const stages = [];
  for (let i = 0; i < 4; i++) {
    const st = new THREE.Group(); st.position.x = i * 3.05;
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.16, 1.16, 4.6, 32), standard(COLORS.steel, 0.75, 0.3, { transparent: true, opacity: 0.30, side: THREE.DoubleSide, depthWrite: false })); shell.position.y = 2.4; st.add(shell);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.28, 0.24, 32), standard(COLORS.steelDark, 0.86, 0.22)); cap.position.y = 4.82; st.add(cap); boltRing(st, 0.98, 4.92, 12, 0.045);
    const media = new THREE.Mesh(new THREE.CylinderGeometry(0.87, 0.87, 2.55, 26), standard(stageMedia[i], 0.15, 0.72)); media.position.y = 2.05; st.add(media);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.9, 14), standard(COLORS.gas, 0.2, 0.5, { emissive: COLORS.gas, emissiveIntensity: 0.3, transparent: true, opacity: 0.7 })); core.position.y = 2.4; st.add(core);
    const pg = gauge(0.30); pg.group.position.set(0, 5.55, 0); st.add(pg.group);
    tag(st, `${i + 1} • ${REFERENCE.purifier.stages[i].name}`, new THREE.Vector3(0, 6.2, 0), 2.5);
    stages.push({ st, shell, media, core, gauge: pg.group, needle: pg.needle }); g.add(st);
  }
  for (let i = 0; i < 3; i++) g.add(pipe(new THREE.Vector3(i * 3.05 + 1.05, 4.7, 0), new THREE.Vector3((i + 1) * 3.05 - 1.05, 4.7, 0), 0.15, true));
  const inP = pipe(new THREE.Vector3(-2.5, 4.7, 0), new THREE.Vector3(-1.2, 4.7, 0), 0.15, true); g.add(inP);
  const outP = pipe(new THREE.Vector3(10.2, 4.7, 0), new THREE.Vector3(12.5, 4.7, 0), 0.15, true); g.add(outP);
  tag(g, 'PURIFICATION CASCADE', new THREE.Vector3(4.55, 7.5, 0), 4.3);
  tag(g, '1 BIOTRICKLING → 2 LATERITE → 3 LIME → 4 GEO-COOL', new THREE.Vector3(4.55, 6.96, 0), 2.8);
  g.userData = { type: 'PURIFIER', name: 'Purification Cascade', desc: 'Four passive stages: biotrickling/coir for H₂S, laterite for CO₂ and residual H₂S, gravity-fed lime for CO₂, and geo-cool condensate removal for moisture. Differential pressure rises across a blocked stage.', stages };
  return g;
}

function makeMeterUnit(i) {
  const g = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.0, 2.8), standard(COLORS.steelDark, 0.72, 0.28, { transparent: true, opacity: 0.24, depthWrite: false })); housing.position.y = 2.0; g.add(housing);
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.08, 36), standard(0xe8ece8, 0.22, 0.5)); face.rotation.y = Math.PI / 2; face.position.set(2.15, 2.5, 0); g.add(face);
  const bellows = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.16, 32), standard(COLORS.rubber, 0.25, 0.68)); bellows.rotation.z = Math.PI / 2; bellows.position.set(0.65, 2.5, 0); g.add(bellows);
  const link = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.12), standard(COLORS.brass, 0.65, 0.3)); link.position.set(-0.1, 1.45, 0); g.add(link);
  const crank = new THREE.Group(); crank.position.set(-0.55, 1.45, 0.35); g.add(crank);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.10, 0.10), standard(COLORS.brassDark, 0.68, 0.3)); arm.position.x = 0.48; crank.add(arm);
  const g1 = gear(0.70, 20, 0.18, standard(COLORS.brass, 0.78, 0.27)); g1.position.set(0.85, 1.45, 0.48); g1.rotation.y = Math.PI / 2; g.add(g1);
  const g2 = gear(0.47, 14, 0.16, standard(COLORS.blue, 0.7, 0.3)); g2.position.set(1.75, 1.45, 0.48); g2.rotation.y = Math.PI / 2; g.add(g2);
  const pointer = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.05, 0.04), standard(COLORS.danger, 0.25, 0.28)); pointer.position.set(2.15, 2.5, 0.1); pointer.rotation.z = -1.0; g.add(pointer);
  const odometer = new THREE.Group(); odometer.position.set(0, 3.75, 1.25); g.add(odometer);
  const digits = [];
  for (let j = 0; j < 5; j++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.14), standard(COLORS.black, 0.5, 0.4)); d.position.x = (j - 2) * 0.48; odometer.add(d); digits.push(d); }
  const inlet = pipe(new THREE.Vector3(-2.4, 2.2, 0), new THREE.Vector3(-1.7, 2.2, 0), 0.10, true); g.add(inlet);
  const outlet = pipe(new THREE.Vector3(2.0, 2.2, 0), new THREE.Vector3(2.7, 2.2, 0), 0.10, true); g.add(outlet);
  tag(g, `METER ${String.fromCharCode(65 + i)}`, new THREE.Vector3(0, 5.6, 0), 2.9);
  g.userData = { type: 'METER', name: `Mechanical Meter ${String.fromCharCode(65 + i)}`, desc: 'Four-chamber bellows/diaphragm concept represented as a displacement meter: delivered gas fills a fixed stroke volume, the diaphragm deflects, crank and gear train rotate, and a mechanical totalizer advances one pulse per calibrated chamber displacement.', housing, bellows, link, crank, g1, g2, pointer, odometer, digits };
  return g;
}

function makeMeters() {
  const g = new THREE.Group(); g.position.set(16.5, 0.8, 0);
  const meters = [];
  [-5.2, -1.75, 1.75, 5.2].forEach((z, i) => { const m = makeMeterUnit(i); m.position.z = z; g.add(m); meters.push(m); });
  tag(g, '4× MECHANICAL DIAPHRAGM / BELLOWS METERS', new THREE.Vector3(0, 7.2, 0), 4.0);
  tag(g, 'INDIVIDUAL VOLUMETRIC TOTALIZATION • NO ELECTRONICS', new THREE.Vector3(0, 6.65, 0), 2.9);
  g.userData = { type: 'METERS', name: 'Mechanical Meter Bank', desc: 'Four independent mechanical bellows meters, one per household branch, with fixed chamber displacement, crank linkage, gears and mechanical totalizers.', meters };
  return g;
}

function makeHouseholds() {
  const g = new THREE.Group(); g.position.set(29.2, 0, 0);
  const houses = [];
  [-4.8, -1.6, 1.6, 4.8].forEach((z, i) => {
    const h = new THREE.Group(); h.position.z = z;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 2.5), standard(COLORS.steelDark, 0.35, 0.68)); plinth.position.y = 0.08; h.add(plinth);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.8, 2.1), standard(0x71807f, 0.42, 0.54)); body.position.y = 1.0; h.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.1, 4), standard(0x4a5d62, 0.6, 0.36)); roof.rotation.y = Math.PI / 4; roof.position.y = 2.45; h.add(roof);
    const regulator = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.48, 18), standard(COLORS.brass, 0.72, 0.3)); regulator.rotation.z = Math.PI / 2; regulator.position.set(-1.7, 1.35, 0); h.add(regulator);
    const meter = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.18), standard(COLORS.steelDark, 0.65, 0.36)); meter.position.set(0.85, 1.1, 1.15); h.add(meter);
    const burner = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), standard(COLORS.gasSoft, 0.15, 0.3, { emissive: COLORS.gasSoft, emissiveIntensity: 0.7 })); burner.position.set(0, 1.05, 1.12); h.add(burner);
    const pipeIn = pipe(new THREE.Vector3(-1.75, 1.4, 0), new THREE.Vector3(-1.75, 1.4, 0.95), 0.10, true); h.add(pipeIn);
    tag(h, `${String.fromCharCode(65 + i)} • ${REFERENCE.manifold.thresholdKpa[i]} kPa`, new THREE.Vector3(0, 4.15, 0), 2.3);
    houses.push({ h, burner, regulator, meter, body }); g.add(h);
  });
  g.userData = { type: 'HOUSES', name: 'Households', desc: 'Four variable-demand consumers downstream of the purification cascade. Each branch has its own pressure drop, flow and mechanical meter. Source-side priority thresholds belong to the digester admission valves, not to these consumer branches.', houses };
  return g;
}

export function buildSystemScene(root) {
  const groups = {};
  groups.floor = new THREE.Group(); root.add(groups.floor);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(76, 0.3, 22), standard(0x101a1d, 0.18, 0.82)); floor.position.set(2, -0.2, 0); groups.floor.add(floor);
  for (let x = -36; x <= 38; x += 2) { const line = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 22), standard(COLORS.grid, 0.1, 0.95)); line.position.set(x, -0.02, 0); groups.floor.add(line); }
  for (let z = -10; z <= 10; z += 2) { const line = new THREE.Mesh(new THREE.BoxGeometry(76, 0.012, 0.012), standard(COLORS.grid, 0.1, 0.95)); line.position.set(2, -0.02, z); groups.floor.add(line); }

  groups.digesters = new THREE.Group(); groups.digesters.position.y = 0; root.add(groups.digesters);
  groups.digesters.add(...[0,1,2,3].map(makeAgitator));
  groups.manifold = makeManifold(); root.add(groups.manifold);
  groups.surge = makeSurge(); root.add(groups.surge);
  groups.purifier = makePurifier(); root.add(groups.purifier);
  groups.meters = makeMeters(); root.add(groups.meters);
  groups.households = makeHouseholds(); root.add(groups.households);

  const zSlots = [-7.0, -2.35, 2.35, 7.0];
  zSlots.forEach((z) => root.add(pipe(new THREE.Vector3(-23.5, 8.4, z), new THREE.Vector3(-18.7, 4.9, z * 0.55), 0.14, true)));
  zSlots.forEach((z) => root.add(pipe(new THREE.Vector3(-18.7, 4.9, z * 0.55), new THREE.Vector3(-18.1, 4.0, 0), 0.14, true)));
  root.add(pipe(new THREE.Vector3(-18.1, 4.0, 0), new THREE.Vector3(-13.4, 4.0, 0), 0.18, true));
  root.add(pipe(new THREE.Vector3(-8.6, 4.2, 0), new THREE.Vector3(-5.5, 4.2, 0), 0.18, true));
  root.add(pipe(new THREE.Vector3(-1.2, 5.0, 0), new THREE.Vector3(3.2, 5.0, 0), 0.17, true));
  root.add(pipe(new THREE.Vector3(13.0, 5.2, 0), new THREE.Vector3(14.8, 4.0, 0), 0.16, true));
  root.add(pipe(new THREE.Vector3(18.0, 3.0, 0), new THREE.Vector3(27.0, 3.0, 0), 0.16, true));
  [-5.2, -1.75, 1.75, 5.2].forEach(z => root.add(pipe(new THREE.Vector3(27.0, 3.0, 0), new THREE.Vector3(29.2, 2.1, z), 0.075, true)));

  groups._interactables = [
    ...groups.digesters.children,
    groups.manifold,
    groups.surge,
    groups.purifier,
    groups.meters,
    groups.households
  ];
  groups.digesters.userData.cutawayMeshes = groups.digesters.children.flatMap(x => x.userData.cutaway);
  return groups;
}

export function updateMechanicalScene(groups, state) {
  state.digesters.forEach((d, i) => {
    const g = groups.digesters.children[i]; if (!g) return; const u = g.userData;
    u.piston.position.y = 7.2 - (d.pistonStrokeM / 0.07) * 0.95;
    u.pistonRod.position.y = 6.35 - (d.pistonStrokeM / 0.07) * 0.45;
    u.sp.scale.y = 0.55 + (d.pistonStrokeM / 0.07) * 0.7;
    u.tripCollar.position.y = 5.75 - (d.pistonStrokeM / 0.07) * 0.18;
    u.leverPivot.rotation.z = d.leverAngle;
    u.pawlPivot.rotation.z = d.pawlEngaged ? 0.08 : -0.42;
    u.ratchet.rotation.y = d.shaftAngleRad;
    u.shaft.rotation.y = d.shaftAngleRad;
    u.paddles.rotation.y = d.paddleAngleRad;
    u.rvDisc.position.x = d.reliefOpen ? 0.46 : 0.36;
    u.rvSpring.scale.x = d.reliefOpen ? 0.62 : 1;
    u.gauge.children.forEach(m => { if (m.geometry && m.material && m.material.color && m.geometry.type === 'BoxGeometry') m.rotation.z = -0.78 + CLAMP((d.pressureKpa - 5) / 15, 0, 1) * 1.55; });
    u.ratchet.children.forEach(m => { if (m.material) m.material.color.setHex(d.jammed ? COLORS.danger : COLORS.steelDark); });
    u.paddles.traverse(m => { if (m.isMesh && m.material.emissive) m.material.emissive.setHex(d.phase === 'ADVANCE' || d.phase === 'RELEASE' ? COLORS.accent : 0); });
  });

  groups.manifold.userData.stations.forEach((s, i) => {
    const d = state.digesters[i], u = s.userData;
    const opening = d.sourceValveOpening;
    u.water.scale.y = 0.8 + opening * 0.2;
    u.rod.position.y = 0.48 + opening * 0.35;
    u.spring.scale.y = 1 - 0.22 * opening;
    u.disc.rotation.z = opening * 1.2;
    u.wheel.rotation.z += opening * 0.05;
    u.body.material.color.setHex(d.checkValveOpen ? COLORS.ok : COLORS.warn);
    u.needle.rotation.z = -0.82 + CLAMP((d.pressureKpa - (state.surge.pressureKpa + u.threshold)) / 6, 0, 1) * 1.55;
  });

  const bell = groups.surge.userData.bellows; const level = state.surge.level;
  bell.position.y = -0.55 + level * 0.85;
  bell.scale.y = 0.72 + level * 0.35;
  groups.surge.userData.stem.position.y = 2.55 + level * 0.9;
  groups.surge.userData.float.position.y = 1.65 + level * 1.2;

  if (groups.surge.userData.gauge) groups.surge.userData.gauge.children.forEach(m => { if (m.geometry?.type === 'BoxGeometry') m.rotation.z = -0.78 + CLAMP((state.surge.pressureKpa - 7.8) / 7.2, 0, 1) * 1.55; });

  groups.purifier.userData.stages.forEach((st, i) => {
    const load = state.purifier.stageLoading[i];
    st.media.scale.y = 0.9 + 0.18 * load;
    st.core.scale.y = 0.9 + 0.22 * load;
    if (i === state.purifier.blockedStage) st.media.material.color.setHex(COLORS.danger);
    else st.media.material.color.setHex([COLORS.media1, COLORS.media2, COLORS.media3, COLORS.media4][i]);
    st.needle.rotation.z = -0.82 + CLAMP(state.purifier.stageDpKpa[i] / 4.5, 0, 1) * 1.55;
  });

  groups.meters.userData.meters.forEach((g, i) => {
    const u = g.userData, m = state.meters[i];
    u.bellows.position.x = 0.65 + m.diaphragm * 0.42;
    u.link.position.x = -0.1 + m.diaphragm * 0.30;
    u.crank.rotation.z = m.crankAngleRad;
    u.g1.rotation.x = m.gearAngleRad;
    u.g2.rotation.x = -m.gearAngleRad * 1.7;
    u.pointer.rotation.z = -1.0 + CLAMP(m.instantaneousFlowNm3h / 0.45, 0, 1) * 2.1;
    u.digits.forEach((d, j) => { d.scale.y = 0.9 + (m.odometer[j] / 9) * 0.1; });
  });

  groups.households.userData.houses.forEach((x, i) => {
    const h = state.households[i]; const ratio = h.demandNm3h > 0 ? h.deliveredNm3h / h.demandNm3h : 0;
    x.burner.scale.setScalar(0.45 + ratio * 1.55);
    x.burner.material.emissiveIntensity = 0.4 + ratio * 1.2;
    x.body.material.color.setHex(ratio > 0.92 ? 0x71807f : ratio > 0.55 ? 0x856f51 : 0x7b4f55);
  });
}
