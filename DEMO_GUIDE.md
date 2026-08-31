# Hackathon demo guide

## Recommended 2-minute demo

1. Start in `System` camera view and click START.
2. Show the two digester agitators cycling through FILL → TRIP → RELEASE → ADVANCE → RESET.
3. Click one agitator and show piston stroke, trip setpoint, ratchet tooth, cycles and mixing quality.
4. Move to `Manifold` camera. Point out A/B/C/D setpoints: 8/10/12/14 kPa. Explain that low-threshold demand is served first.
5. Move to `Surge bell` and select PEAK demand. Show storage falling as the accumulator buffers demand.
6. Move to `Purifier` and point out the four media stages. Show live H2S, CO2, dew point and differential pressure telemetry.
7. Move to `Meter` and show the diaphragm, crank, gears and totalizer advancing from delivered flow.
8. Enable `Cutaway: ON` for the agitator / vessels when explaining internal mechanics.

## Strong fault demonstrations

### Agitator jam
- Click `Jam agitator 1`.
- The mechanism freezes, phase becomes JAMMED, mixing quality falls, production degrades and event/alarms appear.

### Priority valve stuck open
- Click `Valve B`.
- B remains forced open and can disturb priority fairness and manifold pressure.

### Purifier blockage
- Click a purifier stage.
- That vessel highlights as blocked, differential pressure rises and the downstream quality indicators degrade.

### Surge full / empty
- Use `Surge full` or `Surge empty`.
- The accumulator is pinned to its boundary state and the network shows the corresponding pressure/storage condition.

### High pressure
- Enable `High pressure`.
- Digester pressure rises, relief valves open, alarms appear and the relief mechanics move.

### Excessive demand
- Enable `Excessive demand` or select PEAK.
- Household delivery falls, the surge bell releases stored gas and the storage trend drops.
