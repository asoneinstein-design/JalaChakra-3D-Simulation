import { ASSUMPTIONS, CLAMP, REFERENCE, jainIndex, SUM } from './config.js';

export const AGITATOR_PHASES = ['FILL', 'TRIP', 'RELEASE', 'ADVANCE', 'RESET', 'JAMMED'];
const G = 9.80665;
const PI = Math.PI;
const P_STD = ASSUMPTIONS.gas.pressureStdKpa;
const T_STD = ASSUMPTIONS.gas.tempStdK;
const R_AIR = 8.314462618;

function ambientTemperatureC(hours) {
  return ASSUMPTIONS.ambient.meanC + ASSUMPTIONS.ambient.amplitudeC * Math.sin((2 * PI * (hours - 5)) / ASSUMPTIONS.ambient.periodHours);
}

function gasStateFromInventory(gasInventoryNm3, tempC, headspaceM3 = REFERENCE.digester.headspaceM3) {
  const T = tempC + 273.15;
  const absoluteKpa = P_STD * (Math.max(0.01, gasInventoryNm3) / headspaceM3) * (T / T_STD);
  return { absoluteKpa, gaugeKpa: Math.max(0, absoluteKpa - P_STD) };
}

function inventoryFromGauge(pressureKpa, tempC, headspaceM3 = REFERENCE.digester.headspaceM3) {
  const T = tempC + 273.15;
  return headspaceM3 * ((P_STD + pressureKpa) / P_STD) * (T_STD / T);
}

function gasDensity(tempC, pressureKpa = P_STD, methaneFraction = 0.55) {
  const T = tempC + 273.15;
  const mw = methaneFraction * 0.016 + (1 - methaneFraction) * 0.029;
  return ((pressureKpa * 1000) * (mw / 1000)) / (R_AIR * T);
}

function gasViscosity(methaneFraction) {
  const raw = ASSUMPTIONS.gasViscosityRawPaS;
  const ch4 = ASSUMPTIONS.gasViscosityMethanePaS;
  return raw + (ch4 - raw) * CLAMP((methaneFraction - 0.55) / 0.40, 0, 1);
}

function darcyPressureDropKpa(flowNm3h, lengthM, diameterM, tempC, methaneFraction = 0.55) {
  if (flowNm3h <= 0) return 0;
  const rho = Math.max(0.2, gasDensity(tempC, P_STD, methaneFraction));
  const v = (flowNm3h / 3600) / (PI * diameterM * diameterM / 4);
  const dpPa = ASSUMPTIONS.darcyFrictionFactor * (lengthM / diameterM) * (rho * v * v / 2);
  return dpPa / 1000;
}

function orificeFlowNm3h(deltaPkPa, valveCapacityNm3h, tempC, methaneFraction = 0.55) {
  if (deltaPkPa <= 0) return 0;
  const cd = REFERENCE.manifold.dischargeCoefficient;
  const d = REFERENCE.manifold.effectiveOrificeDiameterMm / 1000;
  const A = PI * d * d / 4;
  const rho = Math.max(0.25, gasDensity(tempC, P_STD, methaneFraction));
  const qActualM3s = cd * A * Math.sqrt((2 * deltaPkPa * 1000) / rho);
  const qNm3hRaw = qActualM3s * 3600;
  // Valve cartridge geometry limits the free orifice prediction to the supplied design capacity.
  return Math.min(valveCapacityNm3h, qNm3hRaw);
}

function makeDigester(i) {
  const temp = ASSUMPTIONS.ambient.meanC;
  const initialInventory = inventoryFromGauge(ASSUMPTIONS.digesterInitialPressureKpa[i], temp);
  return {
    id: i,
    name: `Digester ${String.fromCharCode(65 + i)}`,
    headspaceM3: REFERENCE.digester.headspaceM3,
    pressureKpa: ASSUMPTIONS.digesterInitialPressureKpa[i],
    gasInventoryNm3: initialInventory,
    nominalProductionNm3h: ASSUMPTIONS.digesterNominalProductionNm3h[i],
    productionNm3h: 0,
    exportFlowNm3h: 0,
    mixingQuality: 0.82,
    tempC: temp,
    phase: 'FILL',
    phaseIndex: 0,
    phaseT: 0,
    pistonStrokeM: 0,
    pistonVelocityMPerS: 0,
    pistonAccelerationMPerS2: 0,
    springForceN: ASSUMPTIONS.piston.springPreloadN,
    gasForceN: 0,
    netPistonForceN: 0,
    leverAngle: -0.18,
    counterweightAngle: 0,
    pawlEngaged: true,
    ratchetTooth: 0,
    shaftAngleRad: 0,
    paddleAngleRad: 0,
    cycleCount: 0,
    tripPressureKpa: 11,
    reliefOpen: false,
    reliefFlowNm3h: 0,
    checkValveOpen: false,
    sourceValveOpening: 0,
    sourceValveLatched: false,
    jammed: false,
  };
}

function makeHouseholds() {
  return REFERENCE.manifold.thresholdKpa.map((threshold, i) => ({
    id: i,
    name: `Household ${String.fromCharCode(65 + i)}`,
    sourceThresholdKpa: threshold,
    baseDemandNm3h: ASSUMPTIONS.householdDemandNm3h[i],
    demandNm3h: ASSUMPTIONS.householdDemandNm3h[i],
    deliveredNm3h: 0,
    serviceRatio: 0,
    pressureKpa: 0,
    branchValveEquivalent: 1,
    phase: 0.7 * i + 0.4,
    dailyDeliveredNm3: 0,
    dailyDemandNm3: 0,
  }));
}

function makeMeter(i) {
  return {
    id: i,
    householdId: i,
    instantaneousFlowNm3h: 0,
    totalVolumeNm3: 0,
    chamberVolumeNm3: 0,
    diaphragm: 0,
    pressureDifferentialKpa: 0,
    crankAngleRad: 0,
    gearAngleRad: 0,
    pulseCount: 0,
    odometer: [0, 0, 0, 0, 0],
  };
}

export function createDefaultState() {
  return {
    running: false,
    simTime: 0,
    speed: ASSUMPTIONS.defaultSpeed,
    demandScale: 1,
    demandProfile: 'DAY',
    parameters: {
      tripPressure: 11,
      reliefPressure: ASSUMPTIONS.reliefKpa,
      purifierCapacityScale: 1,
      surgeTargetKpa: 10.2,
      particleDensity: 240,
      ambientOffsetC: 0,
    },
    faults: {
      highPressure: false,
      excessiveDemand: false,
      agitatorJam: [false, false, false, false],
      valveFault: { index: -1, mode: 'NORMAL' },
      purifierBlockage: { index: -1 },
      surgeMode: 'NORMAL',
    },
    digesters: [0, 1, 2, 3].map(makeDigester),
    manifold: {
      pressureKpa: 10.1,
      inletFlowNm3h: 0,
      sourceExportFlowNm3h: 0,
      branchFlowNm3h: [0, 0, 0, 0],
      valveOpening: [0, 0, 0, 0],
      checkValveOpen: [false, false, false, false],
      stationDpKpa: [0, 0, 0, 0],
      headerLineDpKpa: 0,
      backpressureKpa: 0,
      priorityOrder: [0, 1, 2, 3],
    },
    surge: {
      volumeNm3: 0.0076,
      level: 0.5,
      pressureKpa: 9.85,
      bellElevationM: 0.127,
      inflowNm3h: 0,
      outflowNm3h: 0,
      reliefOpen: false,
      waterSealL: 7,
      chargeRateNm3h: 0,
      releaseRateNm3h: 0,
    },
    purifier: {
      flowNm3h: 0,
      inletFlowNm3h: 0,
      blockedStage: -1,
      stageDpKpa: [0, 0, 0, 0],
      totalDpKpa: 0,
      stageLoading: [0, 0, 0, 0],
      residenceTimeS: [0, 0, 0, 0],
      mediaRemainingKg: [...ASSUMPTIONS.purifierMediaInitialKg],
      mediaInitialKg: [...ASSUMPTIONS.purifierMediaInitialKg],
      cumulativeH2SRemovedKg: 0,
      cumulativeCO2RemovedKg: 0,
      cumulativeLimeConsumedKg: 0,
      cumulativeCondensateL: 0,
      lifeFraction: [1, 1, 1, 1],
      inletQuality: { ...ASSUMPTIONS.purifierQualityIn },
      outletQuality: { h2sPpm: 420, co2Pct: 38, methanePct: 55, moisturePct: 6, odorIndex: 100, dewPointC: 0 },
      qualityScore: 0,
      viscosityPaS: ASSUMPTIONS.gasViscosityRawPaS,
      densityKgM3: ASSUMPTIONS.gasDensityKgM3,
    },
    meters: [0, 1, 2, 3].map(makeMeter),
    households: makeHouseholds(),
    massBalance: {
      initialDigesterInventoryNm3: [0, 1, 2, 3].reduce((a, i) => a + makeDigester(i).gasInventoryNm3, 0),
      initialSurgeInventoryNm3: 0.0076,
      cumulativeProductionNm3: 0,
      cumulativeSourceNm3: 0,
      cumulativeDemandNm3: 0,
      cumulativeDeliveredNm3: 0,
      cumulativeSurgeChargeNm3: 0,
      cumulativeSurgeReleaseNm3: 0,
      cumulativeReliefNm3: 0,
      sourceInventoryResidualNm3: 0,
      systemInventoryNm3: 0,
      residualNm3: 0,
    },
    fairness: {
      absoluteFlowJain: 1,
      serviceRatioJain: 1,
      baselineReferenceJain: REFERENCE.benchmark.reportedBaselineJain,
      targetReferenceJain: 0.999,
    },
    alarms: [],
    eventLog: [],
    history: {
      t: [],
      pressure: [],
      surgeVolume: [],
      sourcePressure: [[], [], [], []],
      sourceFlow: [[], [], [], []],
      demand: [],
      delivered: [],
      storage: [],
      purifiedFlow: [],
      h2s: [],
      co2: [],
      methane: [],
      dew: [],
      fairness: [],
      serviceFairness: [],
      massResidual: [],
      stageDp: [[], [], [], []],
      surgePressure: [],
      householdDelivered: [[], [], [], []],
      householdCumulative: [[], [], [], []],
      meterVolume: [[], [], [], []],
    },
    historyAccumulatorSimS: 0,
    telemetryAccumulatorSimS: 0,
    telemetry: {
      t: [], pressure: [], surgePressure: [], surgeVolume: [],
      sourceFlow: [[], [], [], []], demand: [], delivered: [],
      householdDelivered: [[], [], [], []], householdCumulative: [[], [], [], []],
      meterVolume: [[], [], [], []],
      purifiedFlow: [], h2s: [], co2: [], methane: [], dew: [],
      fairness: [], serviceFairness: [], massResidual: [],
      stageDp: [[], [], [], []]
    },
    lastStep: {
      sourceFlow: 0,
      purifierFlow: 0,
      cleanDemand: 0,
      charge: 0,
      release: 0,
      delivery: 0,
      relief: 0,
    },
  };
}

function logEvent(state, level, message) {
  const last = state.eventLog[state.eventLog.length - 1];
  if (last && last.message === message && state.simTime - last.t < 0.03) return;
  state.eventLog.push({ t: state.simTime, level, message });
  if (state.eventLog.length > 80) state.eventLog.shift();
}

function updateDemand(state) {
  const hHour = state.simTime % 24;
  let commonFactor = 1;
  if (state.demandProfile === 'DAY') {
    const morning = Math.exp(-0.5 * ((hHour - 7.5) / 1.6) ** 2);
    const evening = Math.exp(-0.5 * ((hHour - 19.0) / 2.0) ** 2);
    const rawShape = 0.55 + 0.48 * morning + 0.62 * evening;
    commonFactor = rawShape / ASSUMPTIONS.dayShapeMean;
  } else {
    const schedule = ASSUMPTIONS.demandProfiles[state.demandProfile] || ASSUMPTIONS.demandProfiles.DAY;
    // Non-DAY profiles are deterministic scenario multipliers, not claims about the baseline daily volume.
    commonFactor = 1;
    state.households.forEach((h, i) => { h._profileFactor = schedule[i] ?? 1; });
  }

  let total = 0;
  state.households.forEach((h, i) => {
    const ripple = 1.0 + 0.04 * Math.sin((2 * PI * state.simTime) / 0.5 + h.phase);
    const profileFactor = state.demandProfile === 'DAY' ? commonFactor : (h._profileFactor ?? 1);
    const fault = state.faults.excessiveDemand ? 2.8 : 1;
    h.demandNm3h = h.baseDemandNm3h * profileFactor * ripple * state.demandScale * fault;
    total += h.demandNm3h;
    h.dailyDemandNm3 += h.demandNm3h / 3600 * ASSUMPTIONS.dt;
  });
  return total;
}

function updateAgitator(d, dt, state) {
  const A = PI * (ASSUMPTIONS.piston.diameterMm / 1000) ** 2 / 4;
  const strokeMax = REFERENCE.agitator.pistonStrokeMm / 1000;
  const tripX = strokeMax * ASSUMPTIONS.piston.tripStrokeFraction;
  d.jammed = state.faults.agitatorJam[d.id];
  d.tripPressureKpa = state.parameters.tripPressure;
  d.tempC = ambientTemperatureC(state.simTime) + state.parameters.ambientOffsetC;
  if (state.faults.highPressure) {
    d.gasInventoryNm3 = Math.max(d.gasInventoryNm3, 2.16);
    d.pressureKpa = Math.max(d.pressureKpa, gasStateFromInventory(d.gasInventoryNm3, d.tempC, d.headspaceM3).gaugeKpa);
  }
  d.gasForceN = Math.max(0, d.pressureKpa - 0) * 1000 * A;
  d.springForceN = ASSUMPTIONS.piston.springPreloadN + ASSUMPTIONS.piston.springRateNPerM * d.pistonStrokeM;
  d.netPistonForceN = d.gasForceN - d.springForceN - ASSUMPTIONS.piston.counterForceN - ASSUMPTIONS.piston.dampingNsPerM * d.pistonVelocityMPerS;
  d.reliefOpen = d.pressureKpa >= state.parameters.reliefPressure || (state.faults.highPressure && d.pressureKpa >= 16.5);
  d.reliefFlowNm3h = d.reliefOpen ? CLAMP((d.pressureKpa - state.parameters.reliefPressure) * ASSUMPTIONS.reliefCoefficientNm3hPerKpa + (state.faults.highPressure ? 0.3 : 0), 0, 0.9) : 0;

  if (d.jammed) {
    d.phase = 'JAMMED'; d.phaseIndex = 5; d.pawlEngaged = true;
    d.pistonVelocityMPerS = CLAMP(d.pistonVelocityMPerS - 4 * dt, -0.05, 0.05);
    d.pistonStrokeM = CLAMP(d.pistonStrokeM + d.pistonVelocityMPerS * dt, 0, tripX);
    d.mixingQuality = CLAMP(d.mixingQuality - dt * 0.0020, 0.20, 1);
    return;
  }

  const phaseDur = { TRIP: 0.10, RELEASE: 0.15, ADVANCE: 0.18, RESET: 0.55 };
  if (d.phase === 'FILL') {
    d.pistonAccelerationMPerS2 = d.netPistonForceN / ASSUMPTIONS.piston.massKg;
    d.pistonVelocityMPerS = CLAMP(d.pistonVelocityMPerS + d.pistonAccelerationMPerS2 * dt, -0.3, 0.7);
    if (d.netPistonForceN <= 0) d.pistonVelocityMPerS *= 0.92;
    d.pistonStrokeM = CLAMP(d.pistonStrokeM + d.pistonVelocityMPerS * dt, 0, strokeMax);
    d.pawlEngaged = true;
    d.leverAngle = -0.18 - 0.68 * (d.pistonStrokeM / strokeMax);
    if (d.pistonStrokeM >= tripX && d.pressureKpa >= d.tripPressureKpa) {
      d.phase = 'TRIP'; d.phaseIndex = 1; d.phaseT = 0; d.pistonVelocityMPerS = 0;
      logEvent(state, 'INFO', `${d.name} trip point reached`);
    }
  } else if (d.phase === 'TRIP') {
    const u = CLAMP(d.phaseT / phaseDur.TRIP, 0, 1);
    d.pawlEngaged = true;
    d.leverAngle = -0.86 + 0.95 * u;
    d.counterweightAngle = -0.65 * u;
    d.phaseT += dt;
    if (d.phaseT >= phaseDur.TRIP) { d.phase = 'RELEASE'; d.phaseIndex = 2; d.phaseT = 0; }
  } else if (d.phase === 'RELEASE') {
    const u = CLAMP(d.phaseT / phaseDur.RELEASE, 0, 1);
    d.pawlEngaged = false;
    d.leverAngle = 0.2 - 0.82 * u;
    d.counterweightAngle = -0.65 - 1.15 * u;
    d.phaseT += dt;
    if (d.phaseT >= phaseDur.RELEASE) { d.phase = 'ADVANCE'; d.phaseIndex = 3; d.phaseT = 0; }
  } else if (d.phase === 'ADVANCE') {
    const u = CLAMP(d.phaseT / phaseDur.ADVANCE, 0, 1);
    d.pawlEngaged = false;
    d.shaftAngleRad = d.ratchetTooth * (PI * 2 / 24) + (PI * 2 / 24) * u;
    d.paddleAngleRad = d.shaftAngleRad;
    d.counterweightAngle = -1.85 + 0.35 * Math.sin(PI * u);
    d.phaseT += dt;
    if (d.phaseT >= phaseDur.ADVANCE) {
      d.ratchetTooth = (d.ratchetTooth + 1) % 24;
      d.shaftAngleRad = d.ratchetTooth * (PI * 2 / 24);
      d.paddleAngleRad = d.shaftAngleRad;
      d.cycleCount += 1;
      d.mixingQuality = CLAMP(d.mixingQuality + 0.16, 0.3, 1);
      d.phase = 'RESET'; d.phaseIndex = 4; d.phaseT = 0;
      logEvent(state, 'INFO', `${d.name} ratchet advanced one tooth`);
    }
  } else if (d.phase === 'RESET') {
    const springReturn = 0.32 + 0.35 * CLAMP(d.springForceN / 20, 0, 1);
    d.pistonAccelerationMPerS2 = -springReturn * 9;
    d.pistonVelocityMPerS = CLAMP(d.pistonVelocityMPerS + d.pistonAccelerationMPerS2 * dt, -0.45, 0.3);
    d.pistonStrokeM = CLAMP(d.pistonStrokeM + d.pistonVelocityMPerS * dt, 0, strokeMax);
    d.pawlEngaged = true;
    d.leverAngle = -0.18 - 0.68 * (d.pistonStrokeM / strokeMax);
    d.counterweightAngle += (-0.08 - d.counterweightAngle) * dt * 8;
    d.phaseT += dt;
    if (d.pistonStrokeM <= 0.001 || d.phaseT >= phaseDur.RESET) { d.pistonStrokeM = 0; d.pistonVelocityMPerS = 0; d.phase = 'FILL'; d.phaseIndex = 0; d.phaseT = 0; }
  }
  d.mixingQuality = CLAMP(d.mixingQuality - dt * 0.0015, 0.25, 1);
}

function updateDigesters(state, dt) {
  state.digesters.forEach((d, i) => updateAgitator(d, dt, state));
  state.digesters.forEach(d => {
    const tempFactor = CLAMP(1 + 0.004 * (d.tempC - 30), 0.88, 1.10);
    const mixingFactor = 0.55 + 0.45 * d.mixingQuality;
    const pressureFactor = CLAMP(1.04 - Math.max(0, d.pressureKpa - 14) * 0.025, 0.55, 1.05);
    d.productionNm3h = d.nominalProductionNm3h * mixingFactor * tempFactor * pressureFactor * (state.faults.highPressure ? 1.22 : 1);
  });
}

function updatePriorityManifold(state, dt) {
  const m = state.manifold;
  const surgeP = state.surge.pressureKpa;
  const sourceTemp = state.digesters.reduce((a, d) => a + d.tempC, 0) / state.digesters.length;
  const totalPotential = state.digesters.reduce((a, d) => a + d.productionNm3h, 0);
  const totalDemand = SUM(state.households.map(h => h.demandNm3h));
  const purifierCapacity = ASSUMPTIONS.purifierCapacityNm3h * state.parameters.purifierCapacityScale * (state.faults.purifierBlockage.index >= 0 ? 0.50 : 1);
  const usefulNeed = Math.min(totalDemand, purifierCapacity);
  const storageTarget = CLAMP(state.parameters.surgeTargetKpa, ASSUMPTIONS.surgeMinKpa, ASSUMPTIONS.surgeMaxKpa);
  const storageDeficitL = Math.max(0, (storageTarget - surgeP) / Math.max(0.01, ASSUMPTIONS.surgeMaxKpa - ASSUMPTIONS.surgeMinKpa) * REFERENCE.surge.designStorageL);
  const storageChargeNeed = CLAMP(storageDeficitL / 1000 * 4, 0, 0.16);
  let rawNeed = Math.min(purifierCapacity, usefulNeed + storageChargeNeed);

  const sourceFlows = [0, 0, 0, 0];
  const openings = [0, 0, 0, 0];
  const stationDp = [0, 0, 0, 0];
  const candidate = state.digesters.map((d, i) => {
    const threshold = REFERENCE.manifold.thresholdKpa[i];
    const crack = threshold + REFERENCE.manifold.hysteresisKpa;
    const close = threshold - REFERENCE.manifold.hysteresisKpa;
    const forced = state.faults.valveFault.index === i;
    const stuckOpen = forced && state.faults.valveFault.mode === 'OPEN';
    const stuckClosed = forced && state.faults.valveFault.mode === 'CLOSED';

    if (stuckClosed) d.sourceValveLatched = false;
    else if (stuckOpen) d.sourceValveLatched = true;
    else if (!d.sourceValveLatched && d.pressureKpa >= crack) d.sourceValveLatched = true;
    else if (d.sourceValveLatched && d.pressureKpa <= close) d.sourceValveLatched = false;

    const excess = Math.max(0, d.pressureKpa - threshold);
    const targetOpening = d.sourceValveLatched && !stuckClosed ? CLAMP(excess / 2.5, 0.05, 1) : 0;
    d.sourceValveOpening += (targetOpening - d.sourceValveOpening) * CLAMP(dt * 8, 0, 1);

    // Source-side admission only: common-header pressure must be lower than digester pressure.
    const deltaP = Math.max(0, d.pressureKpa - surgeP);
    const qOrifice = orificeFlowNm3h(deltaP, ASSUMPTIONS.sourceValveMaxNm3h[i], sourceTemp, 0.55);
    const storageAvailable = Math.max(0.01, d.gasInventoryNm3 * 1800);
    const qPotential = Math.min(qOrifice * d.sourceValveOpening, Math.max(d.productionNm3h, storageAvailable));
    const lineDp = darcyPressureDropKpa(qPotential, ASSUMPTIONS.sourceBranchLineLengthM[i], ASSUMPTIONS.sourceBranchDiameterM, d.tempC);
    const hydraulicFraction = CLAMP(1 - lineDp / Math.max(0.5, deltaP), 0.20, 1);
    return { i, d, threshold, stuckClosed, qPotential: qPotential * hydraulicFraction, deltaP, lineDp, crack, close };
  }).sort((a, b) => a.threshold - b.threshold);

  // Priority rule: lower-threshold source valves are admitted first; higher-threshold sources only contribute when need remains.
  for (const c of candidate) {
    const allocated = c.stuckClosed ? 0 : Math.min(c.qPotential, Math.max(0, rawNeed));
    sourceFlows[c.i] = allocated;
    openings[c.i] = c.d.sourceValveOpening;
    stationDp[c.i] = Math.max(0, c.deltaP - c.lineDp);
    c.d.exportFlowNm3h = allocated * (state.faults.highPressure ? 0.25 : 1);
    c.d.checkValveOpen = c.d.exportFlowNm3h > 1e-4;
    rawNeed -= allocated;
  }

  // If a surge-full fault is active, do not admit gas into an already full buffer unless actual demand remains.
  if (state.surge.level >= 0.995 || state.faults.surgeMode === 'FULL') {
    const keep = usefulNeed;
    const actualSource = SUM(sourceFlows);
    if (actualSource > keep && keep >= 0) {
      const scale = keep / Math.max(actualSource, 1e-9);
      state.digesters.forEach((d, i) => { d.exportFlowNm3h *= scale; sourceFlows[i] *= scale; });
    }
  }

  const total = SUM(sourceFlows);
  m.inletFlowNm3h = totalPotential;
  m.sourceExportFlowNm3h = total;
  m.branchFlowNm3h = sourceFlows;
  m.valveOpening = openings;
  m.checkValveOpen = state.digesters.map(d => d.checkValveOpen);
  m.stationDpKpa = stationDp;
  m.headerLineDpKpa = darcyPressureDropKpa(total, ASSUMPTIONS.headerLineLengthM, ASSUMPTIONS.headerDiameterM, sourceTemp);
  const downstreamAllowance = CLAMP(state.purifier.totalDpKpa, 0, 1.8);
  m.pressureKpa = CLAMP(surgeP + m.headerLineDpKpa + 0.15 + downstreamAllowance, 6.0, state.faults.highPressure ? 20.5 : 16.0);
  m.backpressureKpa = m.pressureKpa - surgeP;

  state.digesters.forEach(d => {
    const withdrawal = d.exportFlowNm3h + d.reliefFlowNm3h;
    d.gasInventoryNm3 = Math.max(0.25, d.gasInventoryNm3 + (d.productionNm3h - withdrawal) * dt / 3600);
    const gs = gasStateFromInventory(d.gasInventoryNm3, d.tempC, d.headspaceM3);
    d.pressureKpa = CLAMP(gs.gaugeKpa, 4.5, state.faults.highPressure ? 24 : 20);
  });
  if (state.faults.highPressure) logEvent(state, 'HIGH', 'High-pressure upset active');
}

function updateSurge(state, dt) {
  const s = state.surge;
  const source = state.manifold.sourceExportFlowNm3h;
  const currentDemand = SUM(state.households.map(h => h.demandNm3h));
  const purifierCap = ASSUMPTIONS.purifierCapacityNm3h * state.parameters.purifierCapacityScale * (state.faults.purifierBlockage.index >= 0 ? 0.50 : 1);
  const maxUsefulFlow = Math.min(currentDemand, purifierCap);
  let release = 0;
  let charge = 0;

  if (state.faults.surgeMode === 'FULL') s.volumeNm3 = REFERENCE.surge.designStorageL / 1000;
  if (state.faults.surgeMode === 'EMPTY') s.volumeNm3 = 0;

  if (state.faults.surgeMode !== 'EMPTY' && source < maxUsefulFlow) {
    const needed = maxUsefulFlow - source;
    const storageReleaseLimit = Math.min(ASSUMPTIONS.surgeMaxReleaseNm3h, (s.volumeNm3 / Math.max(1e-6, dt / 3600)) * 0.08);
    release = Math.min(needed, storageReleaseLimit);
  } else if (source > maxUsefulFlow && state.faults.surgeMode !== 'FULL') {
    charge = source - maxUsefulFlow;
  }

  const freeSpace = Math.max(0, REFERENCE.surge.designStorageL / 1000 - s.volumeNm3);
  charge = Math.min(charge, freeSpace / Math.max(1e-6, dt / 3600));
  const maxVolume = REFERENCE.surge.designStorageL / 1000;
  s.volumeNm3 = CLAMP(s.volumeNm3 + (charge - release) * dt / 3600, 0, maxVolume);

  const A = PI * (REFERENCE.surge.diameterMm / 1000) ** 2 / 4;
  const y = s.volumeNm3 / A;
  const weightPressureKpa = (REFERENCE.surge.shellMassKg * G / A) / 1000;
  const springPressureKpa = (REFERENCE.surge.springRateNPerM * y / A) / 1000;
  s.bellElevationM = y;
  s.pressureKpa = CLAMP(weightPressureKpa + springPressureKpa, ASSUMPTIONS.surgeMinKpa, ASSUMPTIONS.surgeMaxKpa);
  s.level = CLAMP(s.volumeNm3 / maxVolume, 0, 1);
  s.inflowNm3h = charge;
  s.outflowNm3h = release;
  s.chargeRateNm3h = charge;
  s.releaseRateNm3h = release;
  s.reliefOpen = s.pressureKpa >= REFERENCE.surge.maxOperatingPressureKpa || (state.faults.highPressure && s.pressureKpa >= 14.5);
  if (s.reliefOpen) logEvent(state, 'WARN', 'Surge-bell relief condition active');
}

function ergunDpKpa(flowNm3h, stage, tempC, methaneFraction) {
  if (flowNm3h <= 0) return 0;
  const eps = ASSUMPTIONS.purifierVoidFraction[stage];
  const dp = ASSUMPTIONS.purifierParticleDiameterM[stage];
  const phi = ASSUMPTIONS.purifierSphericity[stage];
  const A = PI * (REFERENCE.purifier.cartridgeDiameterMm / 1000) ** 2 / 4;
  const v = (flowNm3h / 3600) / A;
  const mu = gasViscosity(methaneFraction);
  const rho = gasDensity(tempC, P_STD, methaneFraction);
  const L = REFERENCE.purifier.cartridgeHeightMm / 1000;
  const dPperL = 150 * ((1 - eps) ** 2 / eps ** 3) * (mu * v / (phi ** 2 * dp ** 2)) + 1.75 * ((1 - eps) / eps ** 3) * (rho * v * v / (phi * dp));
  return (dPperL * L) / 1000;
}

function updatePurifier(state, dt) {
  const p = state.purifier;
  const blocked = state.faults.purifierBlockage.index;
  p.blockedStage = blocked;
  // Equivalent instantaneous feed is source export + raw gas released from the accumulator.
  p.inletFlowNm3h = Math.max(0, state.manifold.sourceExportFlowNm3h + state.surge.releaseRateNm3h);
  const capacity = ASSUMPTIONS.purifierCapacityNm3h * state.parameters.purifierCapacityScale * (blocked >= 0 ? 0.50 : 1);
  const totalDemand = SUM(state.households.map(h => h.demandNm3h));
  p.flowNm3h = Math.min(p.inletFlowNm3h, capacity, totalDemand);

  const tempC = ambientTemperatureC(state.simTime) + state.parameters.ambientOffsetC;
  let methaneFraction = p.inletQuality.methanePct / 100;
  p.densityKgM3 = gasDensity(tempC, P_STD, methaneFraction);
  p.viscosityPaS = gasViscosity(methaneFraction);

  p.lifeFraction = p.mediaInitialKg.map((initial, i) => CLAMP(p.mediaRemainingKg[i] / Math.max(1e-9, initial), 0, 1));
  p.stageLoading = p.lifeFraction.map((life, i) => {
    const hydraulicLoad = CLAMP(p.flowNm3h / Math.max(0.01, capacity), 0, 1.5);
    return CLAMP((1 - life) * 0.8 + hydraulicLoad * 0.35 + (blocked === i ? 0.55 : 0), 0, 1.8);
  });
  p.stageDpKpa = p.stageDpKpa.map((_, i) => {
    const ergun = ergunDpKpa(p.flowNm3h, i, tempC, methaneFraction);
    const base = ASSUMPTIONS.purifierStageBaseDpKpa[i] * (0.6 + 0.7 * p.stageLoading[i]);
    return base + ergun + (blocked === i ? 1.65 : 0);
  });
  p.totalDpKpa = SUM(p.stageDpKpa);
  p.residenceTimeS = p.residenceTimeS.map((_, i) => {
    const eps = ASSUMPTIONS.purifierVoidFraction[i];
    const A = PI * (REFERENCE.purifier.cartridgeDiameterMm / 1000) ** 2 / 4;
    const Vbed = A * (REFERENCE.purifier.cartridgeHeightMm / 1000) * eps;
    return Vbed / Math.max(1e-6, p.flowNm3h / 3600);
  });

  let h2s = p.inletQuality.h2sPpm;
  let co2 = p.inletQuality.co2Pct;
  let methane = p.inletQuality.methanePct;
  let moisture = p.inletQuality.moisturePct;
  let odor = p.inletQuality.odorIndex;
  const molarVolumeNm3PerKmol = 22.414;
  const gasMolarFlowKmolH = p.flowNm3h / molarVolumeNm3PerKmol;
  const dtH = dt / 3600;

  const tau1 = p.residenceTimeS[0];
  const eta1 = (1 - Math.exp(-ASSUMPTIONS.purifierKineticRatePerS[0] * tau1 * (blocked === 0 ? 0.18 : 1))) * p.lifeFraction[0];
  h2s *= (1 - CLAMP(eta1, 0, 0.995));
  const h2sRemovedKgH = gasMolarFlowKmolH * (p.inletQuality.h2sPpm - h2s) / 1e6 * 34.08;
  p.cumulativeH2SRemovedKg += Math.max(0, h2sRemovedKgH * dtH);

  const tau2 = p.residenceTimeS[1];
  const eta2 = (1 - Math.exp(-ASSUMPTIONS.purifierKineticRatePerS[1] * tau2)) * (blocked === 1 ? 0.28 : 1) * p.lifeFraction[1];
  const co2AfterLaterite = co2 * (1 - CLAMP(eta2, 0, 0.72));
  const co2RemovedLateritePct = Math.max(0, co2 - co2AfterLaterite);
  co2 = co2AfterLaterite;

  const tau3 = p.residenceTimeS[2];
  const limeCapacityMass = p.mediaRemainingKg[2] * 0.12;
  const limeEta = (1 - Math.exp(-ASSUMPTIONS.purifierKineticRatePerS[2] * tau3)) * (blocked === 2 ? 0.35 : 1) * p.lifeFraction[2];
  const stoichPotentialPct = gasMolarFlowKmolH > 0 ? (Math.max(0, limeCapacityMass) / Math.max(1e-9, gasMolarFlowKmolH * 44.01 / 100)) * 100 : 0;
  const eta3 = CLAMP(Math.min(limeEta, stoichPotentialPct / Math.max(1, co2)), 0, 0.65);
  const co2AfterLime = co2 * (1 - eta3);
  const co2RemovedPct = Math.max(0, co2 - co2AfterLime);
  co2 = co2AfterLime;
  const lateriteRemovedKgH = gasMolarFlowKmolH * co2RemovedLateritePct / 100 * 44.01;
  const limeRemovedKgH = gasMolarFlowKmolH * co2RemovedPct / 100 * 44.01;
  const co2RemovedKgH = lateriteRemovedKgH + limeRemovedKgH;
  const limeConsumedKgH = limeRemovedKgH * ASSUMPTIONS.limeStoichKgPerKgCO2 / Math.max(0.01, ASSUMPTIONS.limeUtilizationFraction);
  const lateriteMediaConsumedKgH = lateriteRemovedKgH / Math.max(1e-6, ASSUMPTIONS.lateriteCapacityKgCO2PerKgMedia);
  p.mediaRemainingKg[1] = CLAMP(p.mediaRemainingKg[1] - Math.max(0, lateriteMediaConsumedKgH * dtH), 0, p.mediaInitialKg[1]);
  p.mediaRemainingKg[2] = CLAMP(p.mediaRemainingKg[2] - limeConsumedKgH * dtH, 0, p.mediaInitialKg[2]);
  p.cumulativeCO2RemovedKg += Math.max(0, co2RemovedKgH * dtH);
  p.cumulativeLimeConsumedKg += Math.max(0, limeConsumedKgH * dtH);

  const tau4 = p.residenceTimeS[3];
  const eta4 = (1 - Math.exp(-ASSUMPTIONS.purifierKineticRatePerS[3] * tau4)) * (blocked === 3 ? 0.30 : 1) * p.lifeFraction[3];
  const moistureCondensed = moisture * CLAMP((1 - Math.exp(-0.5 * tau4)) * ASSUMPTIONS.geoCoolCondensationEfficiency * p.lifeFraction[3], 0, 0.995);
  moisture *= (1 - CLAMP(moistureCondensed, 0, 0.995));
  const waterMassFlowKgH = gasMolarFlowKmolH * p.inletQuality.moisturePct / 100 * 18.015;
  p.cumulativeCondensateL += Math.max(0, waterMassFlowKgH * moistureCondensed * dtH);
  odor *= (1 - CLAMP(0.20 * eta4, 0, 0.5));
  p.mediaRemainingKg[0] = CLAMP(p.mediaRemainingKg[0] - Math.max(0, h2sRemovedKgH * dtH * 4), 0, p.mediaInitialKg[0]);
  p.mediaRemainingKg[3] = CLAMP(p.mediaRemainingKg[3] - Math.max(0, waterMassFlowKgH * moistureCondensed * dtH * 0.02), 0, p.mediaInitialKg[3]);

  // Preserve a simple composition sum: removed CO₂/contaminants increase methane fraction by renormalization.
  const other = Math.max(1, 100 - p.inletQuality.methanePct - p.inletQuality.co2Pct - p.inletQuality.moisturePct);
  const scaledOther = Math.max(0.5, other * (1 - 0.25 * eta4));
  const sum = methane + co2 + moisture * 0.1 + scaledOther;
  methane = (methane / sum) * 100;
  co2 = (co2 / sum) * 100;

  p.lifeFraction = p.mediaRemainingKg.map((v, i) => CLAMP(v / Math.max(1e-9, p.mediaInitialKg[i]), 0, 1));
  p.outletQuality = {
    h2sPpm: CLAMP(h2s, 0.5, p.inletQuality.h2sPpm),
    co2Pct: CLAMP(co2, 2, p.inletQuality.co2Pct),
    methanePct: CLAMP(methane, 45, 98),
    moisturePct: CLAMP(moisture, 0.05, p.inletQuality.moisturePct),
    odorIndex: CLAMP(odor, 1, p.inletQuality.odorIndex),
    dewPointC: CLAMP(-2 - (p.inletQuality.moisturePct - moisture) * 2.2, -25, 10),
  };

  const h2sScore = CLAMP(1 - p.outletQuality.h2sPpm / p.inletQuality.h2sPpm, 0, 1);
  const co2Score = CLAMP(1 - p.outletQuality.co2Pct / p.inletQuality.co2Pct, 0, 1);
  const moistureScore = CLAMP(1 - p.outletQuality.moisturePct / p.inletQuality.moisturePct, 0, 1);
  const odorScore = CLAMP(1 - p.outletQuality.odorIndex / p.inletQuality.odorIndex, 0, 1);
  p.qualityScore = CLAMP(0.30 * h2sScore + 0.30 * co2Score + 0.20 * moistureScore + 0.20 * odorScore, 0, 1);

  if (blocked >= 0 && p.stageDpKpa[blocked] >= ASSUMPTIONS.clogDpAlertKpa) logEvent(state, 'HIGH', `Purifier stage ${blocked + 1} ΔP high / blockage`);
  void dt;
}

function updateDistributionAndMeters(state, dt) {
  const totalDemand = SUM(state.households.map(h => h.demandNm3h));
  const availableClean = state.purifier.flowNm3h;
  const deliveredTotal = Math.min(totalDemand, availableClean);

  // Consumer branches are independent and can only flow when their own demand exists.
  // No source priority valve is reused as a household valve: source valves pool gas; downstream branches meter delivery.
  const deficits = state.households.map(h => Math.max(0, h.demandNm3h));
  let remaining = deliveredTotal;
  const shares = deficits.map(d => totalDemand > 0 ? d / totalDemand : 0);
  state.households.forEach((h, i) => {
    const branch = Math.min(h.demandNm3h, Math.max(0, remaining * (shares[i] + (i === 0 ? 0 : 0))));
    h.deliveredNm3h = branch;
  });
  // Exact proportional split after the first pass prevents floating-point drift.
  const sumFirst = SUM(state.households.map(h => h.deliveredNm3h));
  if (sumFirst > 0) state.households.forEach(h => { h.deliveredNm3h *= deliveredTotal / sumFirst; });
  remaining = deliveredTotal;

  state.households.forEach((h, i) => {
    h.serviceRatio = h.demandNm3h > 0 ? CLAMP(h.deliveredNm3h / h.demandNm3h, 0, 1) : 1;
    h.pressureKpa = Math.max(0, state.purifier.flowNm3h > 0 ? state.surge.pressureKpa - ASSUMPTIONS.householdPressureLossKpa[i] : 0);
    h.dailyDeliveredNm3 += h.deliveredNm3h / 3600 * ASSUMPTIONS.dt;
  });

  state.meters.forEach((m, i) => {
    const h = state.households[i];
    m.instantaneousFlowNm3h = h.deliveredNm3h;
    m.totalVolumeNm3 += m.instantaneousFlowNm3h * dt / 3600;
    const displacement = REFERENCE.meter.displacementNm3PerCycle;
    const cyclesExact = m.totalVolumeNm3 / displacement;
    m.pulseCount = Math.floor(cyclesExact + 1e-9);
    m.chamberVolumeNm3 = Math.max(0, m.totalVolumeNm3 - m.pulseCount * displacement);
    m.diaphragm = CLAMP(m.chamberVolumeNm3 / displacement, 0, 1);
    m.crankAngleRad = m.diaphragm * 2 * PI;
    m.gearAngleRad = (cyclesExact * 2 * PI) * REFERENCE.meter.gearRatio;
    const pDrop = h.deliveredNm3h > 0 ? CLAMP(0.2 + 0.6 * h.serviceRatio, 0, 1.5) : 0;
    m.pressureDifferentialKpa = pDrop;
    const digits = m.pulseCount % 100000;
    m.odometer = [10000, 1000, 100, 10, 1].map(unit => Math.floor(digits / unit) % 10);
  });
  state.meter = state.meters[0]; // backwards-compatible alias for older scene/UI modules.
  return { deliveredTotal, totalDemand };
}

function updateFairness(state) {
  const flows = state.households.map(h => h.deliveredNm3h);
  const services = state.households.map(h => h.serviceRatio);
  state.fairness.absoluteFlowJain = jainIndex(flows);
  state.fairness.serviceRatioJain = jainIndex(services);
}

function updateMassBalance(state, dt) {
  const source = state.manifold.sourceExportFlowNm3h;
  const production = SUM(state.digesters.map(d => d.productionNm3h));
  const demand = SUM(state.households.map(h => h.demandNm3h));
  const delivered = SUM(state.households.map(h => h.deliveredNm3h));
  const charge = state.surge.chargeRateNm3h;
  const release = state.surge.releaseRateNm3h;
  const relief = SUM(state.digesters.map(d => d.reliefFlowNm3h));
  const dtH = dt / 3600;

  state.massBalance.cumulativeProductionNm3 += production * dtH;
  state.massBalance.cumulativeSourceNm3 += source * dtH;
  state.massBalance.cumulativeDemandNm3 += demand * dtH;
  state.massBalance.cumulativeDeliveredNm3 += delivered * dtH;
  state.massBalance.cumulativeSurgeChargeNm3 += charge * dtH;
  state.massBalance.cumulativeSurgeReleaseNm3 += release * dtH;
  state.massBalance.cumulativeReliefNm3 += relief * dtH;

  const digesterInventory = SUM(state.digesters.map(d => d.gasInventoryNm3));
  const systemInventory = digesterInventory + state.surge.volumeNm3;
  state.massBalance.systemInventoryNm3 = systemInventory;

  // Closed-system conservation including the four digesters and the hydraulic accumulator.
  // Initial stored gas + production = current stored gas + useful delivery + relief losses.
  state.massBalance.residualNm3 = (
    state.massBalance.initialDigesterInventoryNm3 + state.massBalance.initialSurgeInventoryNm3 + state.massBalance.cumulativeProductionNm3
    - systemInventory - state.massBalance.cumulativeDeliveredNm3 - state.massBalance.cumulativeReliefNm3
  );

  // Source-side diagnostic: production + initial digester inventory = digester inventory + source export + relief.
  state.massBalance.sourceInventoryResidualNm3 = (
    state.massBalance.initialDigesterInventoryNm3 + state.massBalance.cumulativeProductionNm3
    - digesterInventory - state.massBalance.cumulativeSourceNm3 - state.massBalance.cumulativeReliefNm3
  );
}

function updateAlarms(state) {
  const a = [];
  const p = state.manifold.pressureKpa;
  if (p >= ASSUMPTIONS.alertPressureHighKpa) a.push({ level: 'HIGH', message: 'Header pressure high' });
  if (p <= ASSUMPTIONS.alertPressureLowKpa) a.push({ level: 'LOW', message: 'Header pressure low' });
  if (state.surge.level <= ASSUMPTIONS.alertStorageLow) a.push({ level: 'HIGH', message: 'Surge bell nearly empty' });
  if (state.surge.level >= ASSUMPTIONS.alertStorageHigh) a.push({ level: 'HIGH', message: 'Surge bell near full' });
  if (state.purifier.totalDpKpa >= ASSUMPTIONS.clogDpAlertKpa * 4) a.push({ level: 'HIGH', message: 'Purifier differential pressure high' });
  state.digesters.forEach((d, i) => {
    if (d.jammed) a.push({ level: 'HIGH', message: `Agitator ${i + 1} jammed` });
    if (d.reliefOpen) a.push({ level: 'WARN', message: `Digester ${String.fromCharCode(65 + i)} relief valve open` });
  });
  state.purifier.stageDpKpa.forEach((dp, i) => {
    if (dp >= ASSUMPTIONS.clogDpAlertKpa) a.push({ level: 'WARN', message: `Purifier stage ${i + 1} ΔP > 0.5 kPa` });
  });
  state.alarms = a;
}

function captureTelemetry(state, target) {
  target.t.push(state.simTime);
  target.pressure.push(state.manifold.pressureKpa);
  target.surgePressure.push(state.surge.pressureKpa);
  target.surgeVolume.push(state.surge.volumeNm3);
  state.digesters.forEach((d, i) => {
    if (target.sourcePressure?.[i]) target.sourcePressure[i].push(d.pressureKpa);
    target.sourceFlow[i].push(d.exportFlowNm3h);
  });
  target.demand.push(SUM(state.households.map(x => x.demandNm3h)));
  target.delivered.push(SUM(state.households.map(x => x.deliveredNm3h)));
  state.households.forEach((h, i) => {
    target.householdDelivered[i].push(h.deliveredNm3h);
    target.householdCumulative[i].push(h.dailyDeliveredNm3);
    target.meterVolume[i].push(state.meters[i].totalVolumeNm3);
  });
  target.purifiedFlow.push(state.purifier.flowNm3h);
  target.h2s.push(state.purifier.outletQuality.h2sPpm);
  target.co2.push(state.purifier.outletQuality.co2Pct);
  target.methane.push(state.purifier.outletQuality.methanePct);
  target.dew.push(state.purifier.outletQuality.dewPointC);
  target.fairness.push(state.fairness.absoluteFlowJain * 100);
  target.serviceFairness.push(state.fairness.serviceRatioJain * 100);
  target.massResidual.push(state.massBalance.residualNm3);
  state.purifier.stageDpKpa.forEach((v, i) => target.stageDp[i].push(v));
}

function pushHistory(state) {
  const h = state.history;
  captureTelemetry(state, h);
  h.storage = h.storage || [];
  h.storage.push(state.surge.level * 100);
  // `surgeVolume` is the physical quantity used by CSV; `storage` remains a percent for the dashboard.

  // Keep chart history bounded; the full-resolution telemetry buffer is never truncated.
  const max = 900;
  const scalar = ['t','pressure','surgePressure','surgeVolume','storage','demand','delivered','purifiedFlow','h2s','co2','methane','dew','fairness','serviceFairness','massResidual'];
  scalar.forEach(k => { if (h[k]) h[k].splice(0, Math.max(0, h[k].length - max)); });
  ['sourceFlow','householdDelivered','householdCumulative','meterVolume','stageDp'].forEach(k => {
    h[k].forEach(v => v.splice(0, Math.max(0, v.length - max)));
  });
}

function pushFullTelemetry(state) {
  captureTelemetry(state, state.telemetry);
}

export function stepPhysics(state, dt = ASSUMPTIONS.dt, recordHistory = true) {
  if (!state.running) return;
  const dtSim = Math.max(0, dt);
  updateDemand(state);
  updateDigesters(state, dtSim);
  updatePriorityManifold(state, dtSim);
  updateSurge(state, dtSim);
  updatePurifier(state, dtSim);
  const dist = updateDistributionAndMeters(state, dtSim);
  // Correct surge flow after knowing actual purifier demand; stored raw gas is charged/released by updateSurge.
  updateFairness(state);
  updateMassBalance(state, dtSim);

  state.lastStep = {
    sourceFlow: state.manifold.sourceExportFlowNm3h,
    purifierFlow: state.purifier.flowNm3h,
    cleanDemand: dist.totalDemand,
    charge: state.surge.chargeRateNm3h,
    release: state.surge.releaseRateNm3h,
    delivery: dist.deliveredTotal,
    relief: SUM(state.digesters.map(d => d.reliefFlowNm3h)),
  };
  updateAlarms(state);
  state.simTime += dtSim / 3600;
  if (recordHistory) {
    state.historyAccumulatorSimS += dtSim;
    state.telemetryAccumulatorSimS += dtSim;
    if (state.historyAccumulatorSimS >= 2) {
      state.historyAccumulatorSimS -= 2;
      pushHistory(state);
    }
    if (state.telemetryAccumulatorSimS >= 1) {
      // One physically consistent sample per simulated second: complete 24 h runs produce 86,400 rows.
      state.telemetryAccumulatorSimS -= 1;
      pushFullTelemetry(state);
    }
  }
}

export function applyDemandProfile(state, profile) {
  if (!ASSUMPTIONS.demandProfiles[profile]) return;
  state.demandProfile = profile;
  state.eventLog.push({ t: state.simTime, level: 'INFO', message: `Demand profile → ${profile}` });
}

export function exportTelemetryCSV(state) {
  const rows = [[
    'sim_time_h','header_pressure_kPa','surge_pressure_kPa','source_total_Nm3_h',
    'demand_Nm3_h','delivered_Nm3_h','surge_volume_Nm3','purified_flow_Nm3_h',
    'H2S_ppm','CO2_pct','CH4_pct','service_Jain_pct','flow_Jain_pct','mass_residual_Nm3',
    'DP1_kPa','DP2_kPa','DP3_kPa','DP4_kPa',
    'A_flow_Nm3_h','B_flow_Nm3_h','C_flow_Nm3_h','D_flow_Nm3_h',
    'A_cumulative_Nm3','B_cumulative_Nm3','C_cumulative_Nm3','D_cumulative_Nm3',
    'A_meter_total_Nm3','B_meter_total_Nm3','C_meter_total_Nm3','D_meter_total_Nm3'
  ]];
  const t = state.telemetry;
  const n = t.t.length;
  const at = (arr, i) => arr[i] ?? '';
  for (let i = 0; i < n; i++) {
    rows.push([
      at(t.t,i), at(t.pressure,i), at(t.surgePressure,i),
      t.sourceFlow.reduce((sum,a) => sum + Number(at(a,i) || 0), 0),
      at(t.demand,i), at(t.delivered,i), at(t.surgeVolume,i), at(t.purifiedFlow,i),
      at(t.h2s,i), at(t.co2,i), at(t.methane,i), at(t.serviceFairness,i), at(t.fairness,i), at(t.massResidual,i),
      at(t.stageDp[0],i), at(t.stageDp[1],i), at(t.stageDp[2],i), at(t.stageDp[3],i),
      at(t.householdDelivered[0],i), at(t.householdDelivered[1],i), at(t.householdDelivered[2],i), at(t.householdDelivered[3],i),
      at(t.householdCumulative[0],i), at(t.householdCumulative[1],i), at(t.householdCumulative[2],i), at(t.householdCumulative[3],i),
      at(t.meterVolume[0],i), at(t.meterVolume[1],i), at(t.meterVolume[2],i), at(t.meterVolume[3],i)
    ]);
  }
  // If the user exports before the first 1-second telemetry boundary, still provide one exact current-state row.
  if (n === 0) {
    pushFullTelemetry(state);
    return exportTelemetryCSV(state);
  }
  const escape = v => {
    const str = String(v ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g,'""')}"` : str;
  };
  return rows.map(r => r.map(escape).join(',')).join('\n');
}

