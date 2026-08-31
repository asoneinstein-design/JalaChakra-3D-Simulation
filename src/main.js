import * as THREE from 'three';
import { Simulation } from './core/simulation.js';
import { buildSystemScene, updateMechanicalScene } from './scene/components.js';
import { createCamera } from './scene/camera.js';
import { ParticleFlow } from './scene/particles.js';
import { Dashboard } from './ui/dashboard.js';
import { REFERENCE } from './core/config.js';
import { exportTelemetryCSV } from './core/physics.js';

const mount = document.getElementById('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  const fail = document.createElement('div'); fail.className='fatal-overlay'; fail.textContent='WebGL could not initialize. Enable hardware acceleration in Chrome and reload.'; document.body.appendChild(fail); throw err;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(Math.max(1,mount.clientWidth), Math.max(1,mount.clientHeight));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
mount.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071116);
scene.fog = new THREE.Fog(0x071116, 48, 125);
scene.add(new THREE.HemisphereLight(0xc5e7e6, 0x071116, 1.8));
const key = new THREE.DirectionalLight(0xffffff, 3.1); key.position.set(-30, 40, 28); key.castShadow = true; scene.add(key);
const rim = new THREE.PointLight(0x39d6c5, 22, 80); rim.position.set(0, 25, 15); scene.add(rim);
const root = new THREE.Group(); scene.add(root);
const groups = buildSystemScene(root);
const particles = new ParticleFlow(root, 520);
const cam = createCamera(renderer.domElement); const camera = cam.camera;
const sim = new Simulation();
const dash = new Dashboard(sim.state);

let cutaway = false;
function setCutaway(on) {
  cutaway = on;
  groups.digesters.userData.cutawayMeshes?.forEach(m => { if (!m.material) return; m.material.transparent = true; m.material.opacity = on ? 0.07 : 0.23; m.material.depthWrite = !on; });
  groups.manifold.userData.stations?.forEach(s => { s.userData.upper.material.opacity = on ? 0.08 : 0.28; });
  groups.surge.userData.shell.material.opacity = on ? 0.08 : 0.28;
  groups.purifier.userData.stages.forEach(s => { s.shell.material.opacity = on ? 0.08 : 0.30; });
  groups.meters.userData.meters.forEach(m => { m.userData.housing.material.opacity = on ? 0.08 : 0.24; });
}

function inspectData(name) {
  const s = sim.state;
  if (name.includes('Digester')) {
    const idx = Math.max(0, Math.min(3, Number(name.match(/([A-D])/i)?.[1]?.toUpperCase().charCodeAt(0) - 65 || 0)));
    const d = s.digesters[idx];
    return { name, desc: groups.digesters.children[idx]?.userData.desc || '', stats: {
      Pressure: `${d.pressureKpa.toFixed(2)} kPa`, 'Gas inventory': `${d.gasInventoryNm3.toFixed(3)} Nm³`, Phase: d.phase,
      'Piston stroke': `${(d.pistonStrokeM*1000).toFixed(1)} mm`, 'Trip setpoint': `${d.tripPressureKpa.toFixed(1)} kPa`,
      'Gas force': `${d.gasForceN.toFixed(2)} N`, 'Spring force': `${d.springForceN.toFixed(2)} N`, 'Net piston force': `${d.netPistonForceN.toFixed(2)} N`,
      'Ratchet': `${d.ratchetTooth}/24`, 'Cycles': d.cycleCount, 'Source valve': `${d.sourceValveLatched?'OPEN':'CLOSED'} ${Math.round(d.sourceValveOpening*100)}%`,
      'Export flow': `${d.exportFlowNm3h.toFixed(3)} Nm³/h`, 'Production': `${d.productionNm3h.toFixed(3)} Nm³/h`, 'Relief': d.reliefOpen?'OPEN':'SEATED', 'Mixing quality': `${(d.mixingQuality*100).toFixed(0)}%`
    }};
  }
  if (name === 'Priority-Valve Manifold') return { name, desc: groups.manifold.userData.desc, stats: {
    'Header pressure': `${s.manifold.pressureKpa.toFixed(2)} kPa`, 'Surge backpressure': `${s.surge.pressureKpa.toFixed(2)} kPa`,
    'Source export': `${s.manifold.sourceExportFlowNm3h.toFixed(3)} Nm³/h`, 'Header ΔP': `${s.manifold.headerLineDpKpa.toFixed(3)} kPa`,
    ...s.digesters.map((d,i)=>[`Valve ${String.fromCharCode(65+i)}`,`${d.sourceValveLatched?'OPEN':'CLOSED'} ${Math.round(d.sourceValveOpening*100)}% • ${d.exportFlowNm3h.toFixed(3)} Nm³/h`]).reduce((o,[k,v])=>(o[k]=v,o),{})
  }};
  if (name === 'Surge Bell Accumulator') return { name, desc: groups.surge.userData.desc, stats: {
    Storage: `${s.surge.volumeNm3.toFixed(4)} Nm³`, Level: `${(s.surge.level*100).toFixed(1)}%`, 'Bell elevation': `${(s.surge.bellElevationM*1000).toFixed(0)} mm`,
    Pressure: `${s.surge.pressureKpa.toFixed(2)} kPa`, Charge: `${s.surge.chargeRateNm3h.toFixed(3)} Nm³/h`, Release: `${s.surge.releaseRateNm3h.toFixed(3)} Nm³/h`, Relief: s.surge.reliefOpen?'OPEN':'NORMAL'
  }};
  if (name === 'Purification Cascade') return { name, desc: groups.purifier.userData.desc, stats: {
    'Design basis': REFERENCE.purifier.designBasis, 'Throughput': `${s.purifier.flowNm3h.toFixed(3)} Nm³/h`, 'Total ΔP': `${s.purifier.totalDpKpa.toFixed(3)} kPa`,
    'Stage DP': s.purifier.stageDpKpa.map(v=>v.toFixed(3)).join(' / ') + ' kPa', 'H₂S outlet': `${s.purifier.outletQuality.h2sPpm.toFixed(1)} ppm`, 'CO₂ outlet': `${s.purifier.outletQuality.co2Pct.toFixed(1)}%`,
    'CH₄ purity': `${s.purifier.outletQuality.methanePct.toFixed(1)}%`, 'Dew point': `${s.purifier.outletQuality.dewPointC.toFixed(1)} °C`, 'Quality score': `${Math.round(s.purifier.qualityScore*100)}%`
  }};
  if (name === 'Mechanical Meter Bank' || name.startsWith('Mechanical Meter')) return { name, desc: groups.meters.userData.desc, stats: Object.fromEntries(s.meters.map((m,i)=>[`Meter ${String.fromCharCode(65+i)}`,`${m.totalVolumeNm3.toFixed(4)} Nm³ • ${m.pulseCount} pulses • ${m.instantaneousFlowNm3h.toFixed(3)} Nm³/h`])) };
  if (name === 'Households') return { name, desc: groups.households.userData.desc, stats: Object.fromEntries(s.households.map(h=>[h.name,`${h.deliveredNm3h.toFixed(3)} / ${h.demandNm3h.toFixed(3)} Nm³/h • ${(h.serviceRatio*100).toFixed(1)}% service`])) };
  return { name:'System overview', desc:'Four-digester source pool → pressure priority manifold → water-sealed surge bell → four-stage purification → four mechanical meters → four households.', stats:{'Sim time':`${s.simTime.toFixed(2)} h`,'Flow Jain':`${(s.fairness.absoluteFlowJain*100).toFixed(1)}%`,'Service Jain':`${(s.fairness.serviceRatioJain*100).toFixed(1)}%`,'Mass residual':`${s.massBalance.residualNm3.toFixed(4)} Nm³`}};
}

dash.onRun = v => { sim.state.running = v; };
dash.onReset = () => { sim.reset(); dash.state = sim.state; dash.buildDynamicRows(); };
dash.onClearFaults = () => sim.clearFaults();
dash.onProfile = p => sim.setDemandProfile(p);
dash.onParameter = (k,v) => {
  if (k === 'singleStep') { sim.stepOnce(); return; }
  if (k === 'speed') sim.state.speed=v;
  else if (k === 'demandScale') sim.state.demandScale=v;
  else if (k in sim.state.parameters) sim.state.parameters[k]=v;
};
dash.onDensity = v => sim.state.parameters.particleDensity=v;
dash.onFault = k => sim.toggleFault(k);
dash.onRun24 = () => {
  // Clean 24 h baseline with the same 1 s physics step used by the verification harness.
  sim.reset();
  sim.state.running = true;
  for (let i = 0; i < 24 * 3600; i++) sim.stepPhysics(1, false);
  sim.state.running = false;
  const delivered = sim.state.massBalance.cumulativeDeliveredNm3;
  const residual = sim.state.massBalance.residualNm3;
  sim.state.eventLog.push({
    t: sim.state.simTime,
    level: 'INFO',
    message: `24 h test: ${delivered.toFixed(3)} Nm³ delivered • Jain ${(sim.state.fairness.absoluteFlowJain*100).toFixed(1)}% • residual ${residual.toExponential(2)} Nm³`,
  });
};

dash.onExport = () => {
  const blob = new Blob([exportTelemetryCSV(sim.state)], {type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='jalachakra_simulation_results.csv'; a.click(); URL.revokeObjectURL(a.href);
};
dash.onCamera = name => {
  const pts = {
    system:[new THREE.Vector3(0,4.0,0),82,1.10,0.40],
    agitator:[new THREE.Vector3(-27,4.2,0),26,1.04,0.25],
    manifold:[new THREE.Vector3(-13.4,5.0,0),23,1.03,0.25],
    surge:[new THREE.Vector3(-3.4,4.4,0),18,0.96,0.2],
    purifier:[new THREE.Vector3(11.3,4.0,0),25,1.02,0.3],
    meters:[new THREE.Vector3(16.5,3.0,0),22,1.04,0.35],
    households:[new THREE.Vector3(29.2,2.1,0),20,1.08,0.35]
  }; const p=pts[name]||pts.system; cam.focus(...p);
};

const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2();
function inspectAt(clientX,clientY) {
  const r=renderer.domElement.getBoundingClientRect(); mouse.x=((clientX-r.left)/r.width)*2-1; mouse.y=-((clientY-r.top)/r.height)*2+1; ray.setFromCamera(mouse,camera);
  const hits=ray.intersectObjects(groups._interactables,true); if(!hits.length) return;
  let o=hits[0].object; while(o&&o!==root&&!o.userData.name) o=o.parent;
  if(o&&o.userData.name){ dash.$('selection').textContent=o.userData.name; dash.inspect(inspectData(o.userData.name)); }
}
renderer.domElement.addEventListener('dblclick',e=>inspectAt(e.clientX,e.clientY));
renderer.domElement.addEventListener('click',e=>inspectAt(e.clientX,e.clientY));

let last=performance.now(); let acc=0;
function frame(now){
  requestAnimationFrame(frame);
  const realDt=Math.min(0.08,(now-last)/1000); last=now;
  acc+=realDt*sim.state.speed;
  while(acc>=1/60){ sim.stepPhysics(1/60); acc-=1/60; }
  updateMechanicalScene(groups,sim.state);
  particles.update(realDt,sim.state);
  cam.update(); dash.sync(); renderer.render(scene,camera);
}
requestAnimationFrame(frame);

window.addEventListener('keydown', e=>{
  if(e.target && ['INPUT','BUTTON','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
  if(e.key===' '){e.preventDefault();sim.state.running=!sim.state.running;}
  if(e.key.toLowerCase()==='r') cam.home();
  if(e.key.toLowerCase()==='f') cam.isoView();
  if(e.key==='+'||e.key==='=') cam.zoomBy(0.84);
  if(e.key==='-'||e.key==='_') cam.zoomBy(1.19);
});
window.addEventListener('jalachakra:iso',()=>cam.isoView());
window.addEventListener('jalachakra:top',()=>cam.topView());
window.addEventListener('jalachakra:zoom',e=>cam.zoomBy(e.detail??1));
window.addEventListener('resize',()=>{camera.aspect=Math.max(1,mount.clientWidth)/Math.max(1,mount.clientHeight);camera.updateProjectionMatrix();renderer.setSize(Math.max(1,mount.clientWidth),Math.max(1,mount.clientHeight));});
window.__JALACHAKRA__={sim,groups,scene,renderer,camera,cam};
