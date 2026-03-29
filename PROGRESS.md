# GeoDash — Build Progress

## Steps (Original Plan — Steps 1-6)

- [x] Step 1: Scaffold Vite + React 18 + TS + Tailwind 4 + Zustand + MapLibre
- [x] Step 2: App shell, Zustand stores (camera/data/demo), types, MapLibre globe
- [x] Step 3: RenderPipeline + ParticleSystem + GLSL shaders (instanced, trails)
- [x] Step 4: CinematicCamera — pure (shot, t)→CameraOptions, bezier, easing
- [x] Step 5: ParticleLayer as MapLibre custom layer, projection, GL state save/restore
- [x] Step 6: DemoOrchestrator + SceneRunner + Act 1 (globe shipping) + Act 2 (NYC pulse)

## Build Review Fixes (2026-03-29)

- [x] Fix 1: Vite dev/preview server port set to 3000 — committed in 1c62e7b
- [x] Fix 2: ESLint migrated from .eslintrc.cjs to eslint.config.js flat config — committed in 62acb06
- [x] Fix 3: Vitest + 58 unit tests for easing functions and CinematicCamera — committed in 87b7c91

## Steps 7-12 (Session 2)

- [x] Step 7 (Plan Step 1): Code-split MapLibre + DRY NYC hotspot data — committed in 7985219
- [x] Step 8 (Plan Step 2): Ingestion module — GeoJSON/CSV parsers with format detection — committed in d9ba003
- [x] Step 9 (Plan Step 3): DropZone UI — full-window drag overlay with particle rendering — committed in 4ffb707
- [x] Step 10 (Plan Step 4): Live data feeds — FeedRegistry + USGS + ISS providers — committed in 4836b42
- [x] Step 11 (Plan Step 5): Act 3 — ocean currents + UK rivers with crane shot — committed in b6f98d5
- [x] Step 12 (Plan Step 6): Acts 4 + 5 — live data quadrants + interactive drop — committed in 1777ab3
- [x] Step 13 (Plan Step 7): Register Acts 3-5 + DemoControls UI overlay — committed in 6513ac6
- [x] Step 14 (Plan Step 8): Post-processing — bloom, DoF, color grading — committed in fec2a1e
- [x] Step 15 (Plan Step 9): Geospatial accuracy — coordinates, scale bar, geodesic math — committed in 6144a2e
- [x] Step 16 (Plan Step 10): Data profiling — schema inference + auto-styling — committed in fe1160e
- [x] Step 17 (Plan Step 11): End-to-end polish — all tests pass (106), lint clean, build clean

## Bug Fixes (Session 3 — 2026-03-29)

- [x] Step 1: Disable broken post-processing + fix vertex shader point-size attenuation — committed in 33af5f6
- [x] Step 2: Add userInteracting flag to camera store, skip jumpTo in SceneRunner on user input — committed in 0b402c7

## Summary

- **106 tests passing** across 6 test files (easing, camera, parsers, feeds, geodesic, schema)
- **Build**: 205KB main + 803KB MapLibre (code-split), clean
- **5 demo acts**: Globe shipping → NYC pulse → Ocean currents/UK rivers → Live data → Interactive drop
- **Outcomes delivered**: O1 (5 acts), O4 (live USGS+ISS feeds), O5 (drag-drop GeoJSON/CSV with auto-styling), O6 (coordinate display + scale bar), O7 (bloom + DoF + color grading post-processing)
