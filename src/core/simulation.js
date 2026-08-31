import { createDefaultState, stepPhysics, applyDemandProfile } from './physics.js';

export class Simulation {
  constructor() { this.state = createDefaultState(); }
  reset() { this.state = createDefaultState(); }
  stepPhysics(dt = 1 / 60, recordHistory = true) { stepPhysics(this.state, dt, recordHistory); }
  stepOnce() { const was = this.state.running; this.state.running = true; stepPhysics(this.state, 1 / 60); this.state.running = was; }
  toggleRunning(v) { this.state.running = v ?? !this.state.running; }
  setDemandProfile(profile) { applyDemandProfile(this.state, profile); }
  toggleFault(key) {
    const f = this.state.faults;
    if (key === 'highPressure') {
      f.highPressure = !f.highPressure;
      if (f.highPressure) {
        // Fault injection represents a downstream restriction/regulator failure; raise source inventory immediately so the relief system responds visibly.
        this.state.digesters.forEach(d => { d.gasInventoryNm3 = Math.max(d.gasInventoryNm3, 2.16); });
        this.state.eventLog.push({ t:this.state.simTime, level:'HIGH', message:'High-pressure fault injected: downstream restriction' });
      }
    }
    else if (key === 'excessiveDemand') f.excessiveDemand = !f.excessiveDemand;
    else if (/^agitatorJam[1-4]$/.test(key)) {
      const idx = Number(key.slice(-1)) - 1; f.agitatorJam[idx] = !f.agitatorJam[idx];
    } else if (key === 'surgeFull') f.surgeMode = f.surgeMode === 'FULL' ? 'NORMAL' : 'FULL';
    else if (key === 'surgeEmpty') f.surgeMode = f.surgeMode === 'EMPTY' ? 'NORMAL' : 'EMPTY';
    else if (/^valve[A-D]$/.test(key)) {
      const idx = key.charCodeAt(5) - 65;
      if (f.valveFault.index !== idx) f.valveFault = { index: idx, mode: 'OPEN' };
      else if (f.valveFault.mode === 'OPEN') f.valveFault = { index: idx, mode: 'CLOSED' };
      else f.valveFault = { index: -1, mode: 'NORMAL' };
      this.state.eventLog.push({ t:this.state.simTime, level:'HIGH', message:`Priority valve ${String.fromCharCode(65+idx)} fault → ${f.valveFault.mode}` });
    } else if (/^purifier[1-4]$/.test(key)) {
      const idx = Number(key.slice(-1)) - 1;
      f.purifierBlockage = f.purifierBlockage.index === idx ? { index:-1 } : { index:idx };
    }
  }
  clearFaults() {
    this.state.faults = {
      highPressure:false,
      excessiveDemand:false,
      agitatorJam:[false,false,false,false],
      valveFault:{index:-1,mode:'NORMAL'},
      purifierBlockage:{index:-1},
      surgeMode:'NORMAL'
    };
  }
}
