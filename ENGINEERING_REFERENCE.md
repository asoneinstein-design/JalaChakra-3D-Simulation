# JalaChakra engineering reference mapping

This version uses the three supplied engineering blueprints as the visual and behavioral reference.

## 1. Self-winding escapement agitator

Drawing-derived features represented in the 3D model:
- Pressure inlet from digester headspace
- Cylinder cap
- Piston
- Compression spring
- Adjustable trip point / collar
- Counterweighted escapement lever
- Pawl
- 24-tooth ratchet wheel
- Drive shaft
- Four paddle blades
- Digester lid / mounting flange
- Relief / bleed valve with spring and seat
- Gas headspace and slurry cutaway

Drawing-derived values:
- Operating pressure: 5–20 kPa
- Trip pressure: 8–15 kPa adjustable
- Piston stroke: ~70 mm
- Ratchet advance: ~15° / tooth
- Paddle diameter: ~320 mm
- Agitator overall height: ~460 mm
- Flange OD: ~220 mm
- Adjustable immersion depth: ~350 mm
- Shaft / wetted material references: SS304 / GI
- Seals: NBR / EPDM
- Temperature range: 10–60 °C

Behavioral model:
1. pressure fill
2. trip point reached
3. lever release
4. pawl disengages / ratchet advances one tooth
5. pawl re-engages and piston resets

No external electrical input is modeled.

## 2. Priority-valve manifold

Drawing-derived features:
- Four sealed pressure traps
- Four pressure-operated priority valves
- Isolation valve body / common header
- Check-valve behavior
- Four thresholds: A 8 kPa, B 10 kPa, C 12 kPa, D 14 kPa
- Common 25 mm class header and ~600 mm four-station manifold reference

Behavior:
- Lower threshold station gets first allocation.
- A higher threshold station opens when lower-priority demand is sufficiently satisfied and manifold pressure is above its threshold.
- Stuck-open faults can cause non-fair allocation and pressure instability.

## 3. Surge bell accumulator

Drawing-derived features:
- Top cap / inspection port
- Gas connection
- Bellows / diaphragm stack
- Guide rod / float
- Water seal chamber
- Base / drain
- Relief protection

Drawing-derived values:
- ~300 mm diameter
- ~900 mm total height
- 6–8 L water seal reference
- 12–20 L usable gas storage reference at ~10 kPa
- 15 kPa maximum operating pressure
- 25 kPa test pressure
- 18–20 kPa relief-setting reference

Behavior:
- surplus supply raises storage
- excess demand lowers storage and releases buffered gas
- full/empty upsets are exposed as explicit faults

## 4. Purification cascade

Drawing-derived four stages:
1. Iron oxide / H2S removal
2. Laterite / CO2 reduction
3. Silica gel / moisture removal
4. Activated carbon / polishing and odor control

Mechanical features represented:
- Four cartridge vessels
- media beds
- inlet/outlet piping
- differential-pressure indications
- service / blockage state

The displayed outlet quality is a simulation metric, not a certification value.

## 5. Mechanical diaphragm / bellows meter

The current 3D representation includes:
- sealed mechanical housing
- diaphragm / bellows element
- link / crank
- two-stage gear train
- pointer dial
- mechanical odometer

The displacement and gear ratio are explicitly treated as simulation assumptions unless a project-specific meter drawing is supplied.

## Assumption policy

Any numeric parameter not explicitly visible in the supplied blueprints is located in `src/core/config.js` and presented as a simulation assumption in the UI.
