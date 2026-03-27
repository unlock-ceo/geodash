# GeoDash — Outcomes

## O1: The demo makes you stop and stare
- Opening the app triggers the demo sequence automatically
- Act 1 (globe with shipping/flight particles) renders within 3s
- Camera transitions are smooth and cinematic (no jerky interpolation)
- At least 4 distinct demo acts play in sequence
- **Verification:** Screen recording of full demo sequence, noting any stutter or pop-in

## O2: Particles feel physical, not plotted
- The particle engine renders 100K+ particles at 60fps
- Particles have visible trails that fade over time
- At least one demo scene shows particles with physics behaviour (flow, gravity, or pulse)
- Particle transitions between views are animated (morph, not cut)
- **Verification:** Screenshot of particle flow scene + FPS counter showing 60fps

## O3: The globe-to-city transition is seamless
- Camera moves from orbital globe to street-level NYC in one continuous motion
- No mode switch, loading screen, or visual discontinuity during the dive
- Motion blur visible during fast camera movement
- **Verification:** Screen recording of the globe-to-NYC transition

## O4: Live data actually updates
- At least one data source updates in real time without page reload
- USGS earthquake feed or ISS tracker shows new data arriving
- Visual indication of data freshness (pulse, fade-in, timestamp)
- **Verification:** Screenshots 30 seconds apart showing new data points

## O5: Drop any geo file and it just works
- Drag-and-drop a GeoJSON file → features render on the map within 2s
- Drag-and-drop a CSV with lat/lon → points render automatically
- The system auto-selects a sensible visualisation (not just raw dots)
- **Verification:** Screenshot of auto-visualised dropped data

## O6: It sounds as good as it looks
- Sonification produces audible output when enabled
- Spatial audio pans with mouse position or data location
- Sound responds to data density or attribute values
- **Verification:** Description of audio behaviour during demo playback

## O7: Post-processing makes it cinematic
- Bloom effect visible on bright data points against dark background
- At least one scene uses depth-of-field blur
- Colour grading preset visibly changes the aesthetic
- **Verification:** Before/after screenshots with effects on vs off
