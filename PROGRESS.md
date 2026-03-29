# GeoDash — Build Progress

## Steps

- [x] Step 1: Scaffold Vite + React 18 + TS + Tailwind 4 + Zustand + MapLibre
- [x] Step 2: App shell, Zustand stores (camera/data/demo), types, MapLibre globe
- [x] Step 3: RenderPipeline + ParticleSystem + GLSL shaders (instanced, trails)
- [x] Step 4: CinematicCamera — pure (shot, t)→CameraOptions, bezier, easing
- [x] Step 5: ParticleLayer as MapLibre custom layer, projection, GL state save/restore
- [x] Step 6: DemoOrchestrator + SceneRunner + Act 1 (globe shipping) + Act 2 (NYC pulse)
- [ ] Step 7: Drag-and-drop data ingestion (GeoJSON/CSV, Web Worker)

## Build Review Fixes (2026-03-29)

- [x] Fix 1: Vite dev/preview server port set to 3000 — committed in 1c62e7b
- [x] Fix 2: ESLint migrated from .eslintrc.cjs to eslint.config.js flat config — committed in 62acb06
- [x] Fix 3: Vitest + 58 unit tests for easing functions and CinematicCamera — committed in 87b7c91
- [ ] Step 8: Data intelligence (schema inference, story detection, auto-styling)
- [ ] Step 9: Geospatial accuracy (CRS, coordinate display, scale bar, geodesic math)
- [ ] Step 10: Live data feeds (USGS earthquakes, ISS tracker, Act 4)
- [ ] Step 11: Post-processing (bloom, DoF, color grading, motion blur)
- [ ] Step 12: Complete Acts 3+5, demo controls, end-to-end polish
