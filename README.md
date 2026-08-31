# JalaChakra Engineering 3D Simulation

A modular browser-based Three.js simulation of the complete JalaChakra chain:

`Digesters → Self-Winding Escapement Agitators → Priority-Valve Manifold → Surge-Bell Accumulator → Four-Stage Purification Cascade → Mechanical Diaphragm/Bellows Meter → Households`

## Run on macOS

```bash
cd /Users/adhithyan/Downloads/jalachakra-3d
python3 -m http.server 8000
```

Open Chrome:

`http://localhost:8000`

Keep Terminal open while the simulation is running.

## Controls

- START / PAUSE / RESET
- Single fixed simulation step
- Simulation speed
- Ambient demand scale
- DAY / NIGHT / PEAK demand profiles
- Adjustable agitator trip pressure
- Relief set pressure
- Manifold target pressure
- Purifier capacity factor
- Particle density
- Camera presets
- Component click-to-inspect

## Faults

- High pressure
- Excessive demand
- Agitator 1 jam
- Agitator 2 jam
- Priority valve A/B/C/D fault cycle: stuck OPEN → stuck CLOSED → NORMAL
- Purifier stage 1/2/3/4 blockage
- Surge full
- Surge empty

## Data shown

- Header pressure
- Gas production
- Household demand / delivery
- Surge storage and bell pressure
- Purifier flow / differential pressure
- H2S, CO2, dew point and quality score
- Instantaneous meter flow
- Totalized meter volume
- Live process charts
- Event log and alarms

## Engineering fidelity

The simulation standardizes the architecture as **4 digesters → 4 source-side priority valves (8/10/12/14 kPa) → surge bell → 4-stage purifier → 4 downstream mechanical meters → 4 households**. This resolves the earlier 3-node/4-station wording conflict by using the more detailed 4-station manifold and 4-household benchmark as the master topology. The final project purification train is the default: **biotrickling/coir → laterite → gravity lime → geo-cool condensate**. The supplied cartridge drawing (iron oxide → laterite → silica gel → activated carbon) is retained as a documented mechanical variant and is not silently mixed into the active model.

The supplied baseline flow vector `[0.168131, 0.070208, 0.051960, 0.036296]` has a verified Jain index of **71.66%**. It is rescaled so the normalized DAY profile integrates to **8.22 Nm³ over 24 h**. The current JalaChakra model reports its own live service fairness separately from that benchmark.

Mass conservation is checked on the closed process inventory: initial digester gas + initial surge gas + cumulative production − current stored gas − cumulative household delivery − relief loss. The residual should remain close to zero.

The agitator uses the supplied 24-tooth ratchet geometry, i.e. **15° per ratchet tooth**, rather than the conflicting 30° value in an earlier text block; the drawing is the more specific mechanical reference.

## Verification

```bash
node tests/smoke.mjs
```

Expected:

`JalaChakra engineering smoke test passed`

The physics test covers normal flow, four-source topology, source-side priority ordering, closed-valve no-reverse-flow, agitator cycling/jam, purifier blockage and pressure drop, excessive demand, high-pressure relief, valve fault cycling, surge full/empty, exact 8.22 Nm³/day baseline demand, meter-volume consistency, and 24 h mass conservation.

## Camera / interaction controls

The 3D viewport is interactive:

- **Left-drag:** orbit / rotate around the current target.
- **Shift + left-drag:** pan the camera.
- **Right-drag:** pan the camera (right click menu is disabled inside the viewport).
- **Middle-drag:** pan the camera.
- **Mouse wheel / trackpad scroll:** zoom in and out.
- **Double-click a component:** focus the camera on that component.
- **Space:** start / pause the simulation.
- **R:** return to the complete system view.
- **+ / =:** zoom in.
- **- / _:** zoom out.

The sidebar also provides HOME, ISOMETRIC, TOP, ZOOM +, ZOOM -, and CONTROLS buttons.

## If the viewport looks static

Make sure the page was started from a local web server, not opened with Finder. From the project folder run:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in Chrome. The simulation loop calls the physics engine at a fixed 60 Hz step and updates the mechanical scene from simulation state every rendered frame.
