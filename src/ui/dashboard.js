export class Dashboard {
  constructor(state) {
    this.state = state;
    this.onRun = () => {};
    this.onReset = () => {};
    this.onFault = () => {};
    this.onClearFaults = () => {};
    this.onProfile = () => {};
    this.onParameter = () => {};
    this.onCamera = () => {};
    this.onCutaway = () => {};
    this.onDensity = () => {};
    this.onRun24 = () => {};
    this.onExport = () => {};
    this.buildDynamicRows();
    this.bind();
  }
  $(id) { return document.getElementById(id); }
  buildDynamicRows() {
    const cycle = this.$('cycleRows');
    if (cycle) cycle.innerHTML = Array.from({ length: 4 }, (_, i) => `<div class="cycle-row"><div><span>Digester ${String.fromCharCode(65+i)}</span><strong id="phase${i}">FILL</strong><small>cycle <b id="cycle${i}">0</b> • tooth <b id="ratchet${i}">0 / 24</b></small></div><div class="mini-state"><span id="piston${i}">0.0 mm</span><span id="pressure${i}">0.0 kPa</span><span id="valve${i}">CLOSED</span></div></div>`).join('');
    const houses = this.$('houseRows');
    if (houses) houses.innerHTML = Array.from({ length: 4 }, (_, i) => `<div class="house-row" id="hh${i}"><strong>${String.fromCharCode(65+i)}</strong><span class="demand">0.000</span><span>/</span><span class="delivered">0.000</span><small>Nm³/h</small><span class="service">0%</span><div class="bar"><i></i></div></div>`).join('');
  }
  bind() {
    this.$('startBtn').onclick = () => this.onRun(true);
    this.$('pauseBtn').onclick = () => this.onRun(false);
    this.$('resetBtn').onclick = () => this.onReset();
    this.$('stepBtn').onclick = () => this.onParameter('singleStep', true);
    this.$('run24Btn').onclick = () => this.onRun24();
    this.$('exportBtn').onclick = () => this.onExport();
    this.$('speed').oninput = e => this.onParameter('speed', +e.target.value);
    this.$('demandScale').oninput = e => this.onParameter('demandScale', +e.target.value);
    this.$('tripPressure').oninput = e => this.onParameter('tripPressure', +e.target.value);
    this.$('reliefPressure').oninput = e => this.onParameter('reliefPressure', +e.target.value);
    this.$('surgeTarget').oninput = e => this.onParameter('surgeTargetKpa', +e.target.value);
    this.$('purifierScale').oninput = e => this.onParameter('purifierCapacityScale', +e.target.value);
    this.$('particleDensity').oninput = e => this.onDensity(+e.target.value);
    this.$('profileDay').onclick = () => this.onProfile('DAY');
    this.$('profileNight').onclick = () => this.onProfile('NIGHT');
    this.$('profilePeak').onclick = () => this.onProfile('PEAK');
    document.querySelectorAll('[data-fault]').forEach(btn => btn.onclick = () => this.onFault(btn.dataset.fault));
    this.$('clearFaults').onclick = () => this.onClearFaults();
    document.querySelectorAll('[data-camera]').forEach(btn => btn.onclick = () => this.onCamera(btn.dataset.camera));
    const wire = (id, fn) => { const el = this.$(id); if (el) el.onclick = fn; };
    wire('homeView', () => this.onCamera('system'));
    wire('isoView', () => window.dispatchEvent(new CustomEvent('jalachakra:iso')));
    wire('topView', () => window.dispatchEvent(new CustomEvent('jalachakra:top')));
    wire('zoomIn', () => window.dispatchEvent(new CustomEvent('jalachakra:zoom', { detail: 0.84 })));
    wire('zoomOut', () => window.dispatchEvent(new CustomEvent('jalachakra:zoom', { detail: 1.19 })));
    wire('helpToggle', () => this.$('controlHelp')?.classList.toggle('hidden'));
    this.$('closeInspect').onclick = () => this.closeInspect();
  }
  syncInputs() {
    const s = this.state;
    this.$('speed').value = s.speed; this.$('speedOut').textContent = `${s.speed.toFixed(1)}×`;
    this.$('demandScale').value = s.demandScale; this.$('demandOut').textContent = `${Math.round(s.demandScale * 100)}%`;
    this.$('tripPressure').value = s.parameters.tripPressure; this.$('tripOut').textContent = `${s.parameters.tripPressure.toFixed(1)} kPa`;
    this.$('reliefPressure').value = s.parameters.reliefPressure; this.$('reliefOut').textContent = `${s.parameters.reliefPressure.toFixed(1)} kPa`;
    this.$('surgeTarget').value = s.parameters.surgeTargetKpa; this.$('surgeTargetOut').textContent = `${s.parameters.surgeTargetKpa.toFixed(1)} kPa`;
    this.$('purifierScale').value = s.parameters.purifierCapacityScale; this.$('purifierOut').textContent = `${s.parameters.purifierCapacityScale.toFixed(2)}×`;
    this.$('particleDensity').value = s.parameters.particleDensity;
  }
  sync() {
    const s = this.state; this.syncInputs();
    this.$('simTime').textContent = s.simTime.toFixed(2);
    this.$('runState').textContent = s.running ? 'RUNNING' : 'PAUSED';
    this.$('runDot').className = `dot ${s.running ? 'run' : 'idle'}`;
    this.$('headerPressure').textContent = `${s.manifold.pressureKpa.toFixed(2)} kPa`;
    this.$('production').textContent = `${s.manifold.sourceExportFlowNm3h.toFixed(3)} Nm³/h`;
    this.$('totalDemand').textContent = `${s.households.reduce((a,h)=>a+h.demandNm3h,0).toFixed(3)} Nm³/h`;
    this.$('storage').textContent = `${Math.round(s.surge.level * 100)}%`;
    this.$('purifiedFlow').textContent = `${s.purifier.flowNm3h.toFixed(3)} Nm³/h`;
    this.$('deliveredFlow').textContent = `${s.households.reduce((a,h)=>a+h.deliveredNm3h,0).toFixed(3)} Nm³/h`;
    this.$('meterTotal').textContent = `${s.meters.reduce((a,m)=>a+m.totalVolumeNm3,0).toFixed(3)} Nm³`;
    this.$('serviceJain').textContent = `${(s.fairness.serviceRatioJain*100).toFixed(1)}%`;
    this.$('flowJain').textContent = `${(s.fairness.absoluteFlowJain*100).toFixed(1)}%`;
    this.$('massResidual').textContent = `${s.massBalance.residualNm3.toFixed(4)} Nm³`;
    this.$('methane').textContent = `${s.purifier.outletQuality.methanePct.toFixed(1)}%`;
    this.$('h2s').textContent = `${s.purifier.outletQuality.h2sPpm.toFixed(1)} ppm`;
    this.$('bellPressure').textContent = `${s.surge.pressureKpa.toFixed(2)} kPa`;
    this.$('bellVolume').textContent = `${s.surge.volumeNm3.toFixed(3)} Nm³`;
    this.$('dp').textContent = `${s.purifier.totalDpKpa.toFixed(2)} kPa`;
    this.$('co2').textContent = `${s.purifier.outletQuality.co2Pct.toFixed(1)}%`;
    this.$('methane2').textContent = `${s.purifier.outletQuality.methanePct.toFixed(1)}%`;
    this.$('dew').textContent = `${s.purifier.outletQuality.dewPointC.toFixed(1)}°C`;
    s.purifier.lifeFraction.forEach((v,i)=>{ const el=this.$(`media${i+1}`); if(el) el.textContent=`${(v*100).toFixed(1)}%`; });
    const ev = s.eventLog.at(-1); this.$('eventText').textContent = ev ? `${ev.message} · ${ev.t.toFixed(2)} h` : 'No events';

    s.digesters.forEach((d, i) => {
      this.$(`phase${i}`).textContent = d.phase;
      this.$(`cycle${i}`).textContent = d.cycleCount;
      this.$(`ratchet${i}`).textContent = `${d.ratchetTooth} / 24`;
      this.$(`piston${i}`).textContent = `${(d.pistonStrokeM*1000).toFixed(1)} mm`;
      this.$(`pressure${i}`).textContent = `${d.pressureKpa.toFixed(1)} kPa`;
      this.$(`valve${i}`).textContent = d.checkValveOpen ? `OPEN ${Math.round(d.sourceValveOpening*100)}%` : 'CLOSED';
    });

    s.households.forEach((h, i) => {
      const row = this.$(`hh${i}`); const ratio = h.serviceRatio * 100;
      row.querySelector('.demand').textContent = h.demandNm3h.toFixed(3);
      row.querySelector('.delivered').textContent = h.deliveredNm3h.toFixed(3);
      row.querySelector('.service').textContent = `${ratio.toFixed(0)}%`;
      row.querySelector('.bar > i').style.width = `${Math.min(100, ratio)}%`;
      row.classList.toggle('starved', ratio < 85);
    });

    document.querySelectorAll('[data-fault]').forEach(btn => btn.classList.remove('active'));
    if (s.faults.highPressure) this.$('faultHigh').classList.add('active');
    if (s.faults.excessiveDemand) this.$('faultDemand').classList.add('active');
    s.faults.agitatorJam.forEach((on,i) => { if(on) document.querySelector(`[data-fault="agitatorJam${i+1}"]`)?.classList.add('active'); });
    if (s.faults.valveFault.index >= 0) document.querySelector(`[data-fault="valve${String.fromCharCode(65+s.faults.valveFault.index)}"]`)?.classList.add('active');
    if (s.faults.purifierBlockage.index >= 0) document.querySelector(`[data-fault="purifier${s.faults.purifierBlockage.index+1}"]`)?.classList.add('active');
    if (s.faults.surgeMode === 'FULL') document.querySelector('[data-fault="surgeFull"]')?.classList.add('active');
    if (s.faults.surgeMode === 'EMPTY') document.querySelector('[data-fault="surgeEmpty"]')?.classList.add('active');

    this.draw('pressureChart', s.history.pressure, 6, 18, 'pressure');
    this.drawDual('flowChart', s.history.t, s.history.sourceFlow[0], s.history.delivered, 0, 0.8, ['#4db8ff','#33d3c6']);
    this.drawDual('qualityChart', s.history.t, s.history.h2s, s.history.methane, 0, 100, ['#f0b34a','#67df8a'], true);
    this.drawDual('storageChart', s.history.t, s.history.storage, s.history.serviceFairness, 0, 100, ['#63b6ff','#c18cff']);
    const alarmText = s.alarms.map(x => x.message).join(' • '); this.$('alarmBanner').textContent = alarmText; this.$('alarmBanner').classList.toggle('hidden', !alarmText);
  }
  draw(id, data, min, max, kind) {
    const c = this.$(id), rect = c.getBoundingClientRect(); if (!rect.width) return;
    const dpr = devicePixelRatio || 1; c.width = Math.max(1, rect.width*dpr); c.height = Math.max(1, rect.height*dpr); const x = c.getContext('2d'); x.setTransform(dpr,0,0,dpr,0,0); const w=rect.width,h=rect.height; x.clearRect(0,0,w,h);
    x.strokeStyle='#183139'; x.lineWidth=1; for(let i=1;i<4;i++){x.beginPath();x.moveTo(0,h*i/4);x.lineTo(w,h*i/4);x.stroke();}
    if(data.length<2) return; const color=kind==='h2s'?'#f0b34a':kind==='storage'?'#63b6ff':'#33d3c6'; x.strokeStyle=color; x.lineWidth=2; x.beginPath(); data.forEach((v,i)=>{const px=i/(data.length-1)*w; const py=h-(Math.max(min,Math.min(max,v))-min)/(max-min)*h; i?x.lineTo(px,py):x.moveTo(px,py);}); x.stroke();
  }
  drawDual(id, t, a, b, min, max, colors, secondaryIsDifferentScale=false) {
    const c=this.$(id), rect=c.getBoundingClientRect(); if(!rect.width || t.length<2) return;
    const dpr=devicePixelRatio||1;c.width=rect.width*dpr;c.height=rect.height*dpr;const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);const w=rect.width,h=rect.height;x.clearRect(0,0,w,h);
    x.strokeStyle='#183139';for(let i=1;i<4;i++){x.beginPath();x.moveTo(0,h*i/4);x.lineTo(w,h*i/4);x.stroke();}
    const draw=(data,color,lo=min,hi=max)=>{x.strokeStyle=color;x.lineWidth=2;x.beginPath();data.forEach((v,i)=>{const px=i/(data.length-1)*w;const py=h-(Math.max(lo,Math.min(hi,v))-lo)/(hi-lo)*h;i?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();};
    draw(a,colors[0]); draw(b,colors[1]);
  }
  inspect(data) {
    this.$('inspectTitle').textContent=data.name;this.$('inspectDesc').textContent=data.desc;const box=this.$('inspectStats');box.innerHTML='';Object.entries(data.stats||{}).forEach(([k,v])=>{const r=document.createElement('div');r.className='stat-row';r.innerHTML=`<span>${k}</span><b>${v}</b>`;box.appendChild(r);});this.$('inspectPanel').classList.remove('hidden');
  }
  closeInspect(){this.$('inspectPanel').classList.add('hidden');this.$('selection').textContent='System overview';}
}
