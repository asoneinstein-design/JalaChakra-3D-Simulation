import { createDefaultState, stepPhysics, exportTelemetryCSV } from '../src/core/physics.js';
import { REFERENCE, jainIndex } from '../src/core/config.js';
const assert = (v, m) => { if (!v) throw new Error(m); };
const approx = (a,b,t=1e-3) => Math.abs(a-b)<=t;

const s = createDefaultState(); s.running = true;
for (let i=0;i<60*30;i++) stepPhysics(s,1/60);
assert(s.simTime > 0.007,'simulation time did not advance in hours');
assert(s.digesters.length===4,'four digesters required');
assert(s.households.length===4,'four households required');
assert(s.manifold.branchFlowNm3h.length===4,'four source valve branches required');
assert(s.meters.length===4,'four household meters required');
assert(s.digesters.every(d=>d.productionNm3h>0),'digester production should be positive');
assert(s.digesters.every(d=>d.ratchetTooth>=0 && d.ratchetTooth<24),'ratchet bounds');
assert(s.manifold.sourceExportFlowNm3h>=0,'source export invalid');
assert(s.purifier.flowNm3h>=0,'purifier flow invalid');
assert(s.purifier.outletQuality.h2sPpm>=0,'quality invalid');
assert(s.meters.every(m=>m.totalVolumeNm3>=0),'meter invalid');
assert(Math.abs(s.massBalance.residualNm3)<0.02,'mass balance residual too high');

// Closed-valve invariant: no reverse flow through a source branch.
s.faults.valveFault={index:1,mode:'CLOSED'};
for(let i=0;i<120;i++) stepPhysics(s,1/60);
assert(s.digesters[1].exportFlowNm3h===0 || s.digesters[1].pressureKpa > s.surge.pressureKpa,'closed source valve must not force reverse flow');


// Source-side priority: a low-threshold source should satisfy a small demand before higher-threshold sources.
const pr=createDefaultState(); pr.running=true; pr.demandScale=0.30;
pr.digesters.forEach(d=>{d.pressureKpa=18.0;});
for(let i=0;i<180;i++) stepPhysics(pr,1/60);
assert(pr.digesters[0].exportFlowNm3h>0,'priority source A should open first');
assert(pr.digesters[2].exportFlowNm3h===0 && pr.digesters[3].exportFlowNm3h===0,'higher-priority-threshold sources should not open while lower threshold source satisfies demand');

// If the lowest-threshold source is stuck closed, the next available source can take the unmet requirement.
pr.faults.valveFault={index:0,mode:'CLOSED'};
for(let i=0;i<180;i++) stepPhysics(pr,1/60);
assert(pr.digesters[0].exportFlowNm3h===0,'stuck-closed source A must have zero export');
assert(pr.digesters[1].exportFlowNm3h>0,'source B should backfill when A is unavailable');

// Reverse-pressure guard: if header pressure is above a source, no branch can flow backwards.
pr.surge.pressureKpa=19; pr.digesters.forEach(d=>d.pressureKpa=10); pr.faults.valveFault={index:-1,mode:'NORMAL'};
stepPhysics(pr,1/60);
assert(pr.digesters.every(d=>d.exportFlowNm3h===0),'reverse pressure must close all source flow');

// Agitator jam: mechanism locks and mixing quality declines.
const preMix=s.digesters[0].mixingQuality; s.faults.agitatorJam[0]=true;
for(let i=0;i<600;i++) stepPhysics(s,1/60);
assert(s.digesters[0].phase==='JAMMED','agitator jam failed');
assert(s.digesters[0].mixingQuality<preMix,'jam did not degrade mixing');

// Purifier blockage: blocked stage has elevated DP, lower throughput and finite media telemetry.
const pb=createDefaultState(); pb.running=true;
for(let i=0;i<300;i++) stepPhysics(pb,1/60);
const normalPurifierFlow=pb.purifier.flowNm3h;
const normalDp=pb.purifier.totalDpKpa;
pb.faults.purifierBlockage={index:2};
for(let i=0;i<300;i++) stepPhysics(pb,1/60);
assert(pb.purifier.blockedStage===2,'purifier blockage index failed');
assert(pb.purifier.stageDpKpa[2]>normalDp/4,'blocked stage DP too low');
assert(pb.purifier.flowNm3h<=normalPurifierFlow*1.02,'blocked purifier throughput should not materially increase');
assert(pb.purifier.mediaRemainingKg.every(Number.isFinite),'media-health telemetry became non-finite');
assert(pb.purifier.cumulativeLimeConsumedKg>=0 && pb.purifier.cumulativeCondensateL>=0,'purifier consumable telemetry invalid');

// Excessive demand: demand rises and service ratio must not exceed 100%.
const normal=s.households.reduce((a,h)=>a+h.demandNm3h,0); s.faults.excessiveDemand=true; stepPhysics(s,1/60);
assert(s.households.reduce((a,h)=>a+h.demandNm3h,0)>normal*1.5,'excessive demand failed');
assert(s.households.every(h=>h.deliveredNm3h<=h.demandNm3h+1e-9),'delivery exceeds demand');

// High pressure: relief opens on at least one digester.
s.faults.excessiveDemand=false; s.faults.highPressure=true;
for(let i=0;i<1800;i++) stepPhysics(s,1/60);
assert(s.digesters.some(d=>d.reliefOpen || d.pressureKpa>=16.5),'relief should respond under high pressure');

// Stuck-open source valve: valve remains latched even below its normal threshold, but check-valve direction still prevents reverse flow.
s.faults.highPressure=false; s.faults.purifierBlockage={index:-1}; s.faults.valveFault={index:1,mode:'OPEN'};
for(let i=0;i<120;i++) stepPhysics(s,1/60);
assert(s.digesters[1].sourceValveLatched,'stuck-open source valve did not latch open');
assert(s.digesters[1].exportFlowNm3h>=0,'stuck-open source valve produced invalid reverse flow');

// Surge full/empty fault invariants.
s.faults.valveFault={index:-1,mode:'NORMAL'}; s.faults.surgeMode='FULL'; stepPhysics(s,1/60);
assert(s.surge.level>0.99,'surge full fault failed');
s.faults.surgeMode='EMPTY'; stepPhysics(s,1/60);
assert(s.surge.level<0.01,'surge empty fault failed');
s.faults.surgeMode='NORMAL';

// Jain's index verifies the supplied 71.66% baseline vector.
const baseline=[0.168131,0.070208,0.051960,0.036296];
assert(Math.abs(jainIndex(baseline)-0.7166)<0.001,'baseline Jain index mismatch');

// 24-hour clean baseline run: start from a fresh state so earlier fault injection does not contaminate conservation.
const s24=createDefaultState();
s24.running=true;
for(let i=0;i<24*3600;i++) stepPhysics(s24,1);
assert(s24.simTime>24.0,'24h test did not advance');
assert(Number.isFinite(s24.massBalance.residualNm3),'mass balance became non-finite');
assert(Math.abs(s24.massBalance.residualNm3)<0.5,'24h mass balance drift too high');
assert(Math.abs(s24.massBalance.sourceInventoryResidualNm3)<0.5,'source-side inventory mass balance drift too high');
assert(Math.abs(s24.massBalance.cumulativeDemandNm3-REFERENCE.benchmark.targetDailyVolumeNm3)<0.01,'24h demand does not match 8.22 Nm³ target');
assert(Math.abs(s24.meters.reduce((a,m)=>a+m.totalVolumeNm3,0)-s24.massBalance.cumulativeDeliveredNm3)<0.001,'meter total does not match delivered volume');
assert(s24.meters.every(m=>Number.isFinite(m.totalVolumeNm3)),'meter total became non-finite');
assert(s24.purifier.cumulativeLimeConsumedKg>0,'lime consumption model did not run');
assert(s24.purifier.cumulativeCondensateL>=0,'condensate model invalid');


// CSV regression: export must contain complete 1-second telemetry, not the current-state values repeated across history.
const csv = exportTelemetryCSV(s24);
const csvLines = csv.split('\n');
const csvHeader = csvLines[0].split(',');
assert(csvHeader.length===30,'CSV schema should contain 30 columns');
assert(csvLines.length-1===86400,'24h CSV should contain one telemetry row per simulated second');
const lastCsv = csvLines[csvLines.length-1].split(',');
assert(Math.abs(Number(lastCsv[0])-s24.simTime)<1e-9,'CSV final timestamp mismatch');
assert(Math.abs(Number(lastCsv[26])-s24.meters[0].totalVolumeNm3)<1e-6,'CSV meter A total mismatch');
assert(Math.abs(Number(lastCsv[27])-s24.meters[1].totalVolumeNm3)<1e-6,'CSV meter B total mismatch');
assert(Math.abs(Number(lastCsv[28])-s24.meters[2].totalVolumeNm3)<1e-6,'CSV meter C total mismatch');
assert(Math.abs(Number(lastCsv[29])-s24.meters[3].totalVolumeNm3)<1e-6,'CSV meter D total mismatch');
const csvDelivered = Number(lastCsv[5]);
const csvMeterSum = lastCsv.slice(26,30).reduce((a,v)=>a+Number(v),0);
assert(Math.abs(csvMeterSum-s24.massBalance.cumulativeDeliveredNm3)<1e-6,'CSV cumulative meter total mismatch');
assert(csvLines[1]!==csvLines[csvLines.length-1],'CSV history must not repeat one snapshot for every row');

console.log('JalaChakra v5 engineering smoke test passed');
console.log(JSON.stringify({
  simHours:s24.simTime,
  sourceFlow:s24.manifold.sourceExportFlowNm3h,
  delivered:s24.households.reduce((a,h)=>a+h.deliveredNm3h,0),
  storage:s24.surge.volumeNm3,
  flowJain:s24.fairness.absoluteFlowJain,
  serviceJain:s24.fairness.serviceRatioJain,
  massResidual:s24.massBalance.residualNm3,
  meterTotal:s24.meters.reduce((a,m)=>a+m.totalVolumeNm3,0),
}));
