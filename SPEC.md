# GeoDash — Geospatial Visualisation That Makes People Stop and Stare

## Vision

This is not another map tool. This is what happens when you treat geospatial data the way a film director treats footage — with drama, timing, and an obsession with the moment someone leans forward in their chair.

GeoDash should make someone watching over your shoulder say "wait, what is that?" It should make a demo audience forget they're looking at a browser. Every transition should feel cinematic. Every interaction should reveal something unexpected. The data should feel alive.

**The bar:** If someone can't tell whether they're watching a pre-rendered video or a live interactive app, we've succeeded.

## Architectural Philosophy

### GPU-First, Not Map-First

Most geo tools start with a map library and bolt visualisation on top. GeoDash starts with a GPU rendering pipeline and uses the map as one input. The core is a WebGPU compute + render pipeline that can push millions of particles, run fluid simulations, and composite multiple visual layers at 60fps. The map is just the canvas.

### Data as Material

Data isn't plotted — it's treated as a physical material with properties. Points have mass and attract each other. Lines have tension and flow. Polygons have density and weight. This means:
- Drop 1M points and watch them settle into density clusters like sand in water
- Flow lines have particle physics — they accelerate downhill, pool in valleys, spread at deltas
- Time-series data breathes — expansions and contractions are visible, not just colour-coded

### Zero-Config Intelligence

Drop any geo data and the system doesn't just detect the format — it understands the *story*. CSV with timestamps? It builds a temporal animation. Points clustered in cities? It auto-generates a population density heatmap. Polygons with numeric attributes? It finds the outliers and highlights them. The first view should always be interesting, not blank.

## Tech Stack

- **Runtime:** React 18 + TypeScript + Vite
- **GPU Engine:** Raw WebGPU (with WebGL2 fallback) via custom compute + render pipeline
- **Map Layer:** MapLibre GL JS (open-source, no tokens needed)
- **Particle System:** Custom WGSL compute shaders for physics simulation
- **Data:** Apache Arrow for columnar data, Web Workers for parsing
- **Spatial:** H3 for hexagonal aggregation, Turf.js for spatial ops
- **Animation:** Custom easing library for cinematic camera movements
- **Audio:** Web Audio API for data sonification
- **State:** Zustand
- **Styling:** Tailwind CSS 4

## Core Systems

### 1. The Particle Engine

The heart of GeoDash. A WebGPU compute shader pipeline that manages millions of particles simultaneously.

**Capabilities:**
- 5M+ particles at 60fps via GPU compute
- Each particle has: position, velocity, colour, size, lifetime, mass
- Physics: gravity wells (cities pull nearby data points), flow fields (wind/current data drives particle movement), collision (particles pile up against polygon boundaries)
- Particle trails with configurable fade (1 frame to infinite)
- Particle morphing: smoothly transition between visualisation modes (scatter → hex → flow → cluster) by animating particle positions through GPU lerp

**Visual modes the particle engine enables:**
- **Gravity mode:** Points fall toward data-dense areas and accumulate like sand, revealing density without any statistical overlay
- **Flow mode:** Particles follow vector fields (wind, ocean currents, traffic) with realistic fluid dynamics — eddies, turbulence, laminar flow
- **Pulse mode:** Data events emit expanding rings of particles (earthquakes, tweets, sensor alerts) that interfere with each other like ripples in water
- **Swarm mode:** Particles self-organise into clusters using flocking algorithms (separation, alignment, cohesion weighted by data attributes)

### 2. Cinematic Camera System

Not zoom-in/zoom-out. Cinematic.

- **Dolly shots:** Smooth approach to a location with depth-of-field blur on background
- **Crane shots:** Sweep up from ground level to orbital view with continuous motion
- **Tracking shots:** Follow a moving entity (ISS, vehicle, storm) with lead-space
- **Rack focus:** Shift visual emphasis between foreground data layer and background context
- **Transitions:** Morph between globe → flat map → 3D terrain as continuous deformation, not a mode switch. The globe unwraps like origami.
- **Bezier flight paths:** Camera moves along spline curves, not linear interpolation. Every flight feels like a nature documentary aerial shot.
- Easing: custom cubic bezier curves per transition type. Approach = ease-out (decelerate into detail). Departure = ease-in (accelerate away). Overview = ease-in-out.

### 3. Data Intelligence Layer

When data lands in GeoDash, before any rendering:

1. **Schema inference:** Column types, coordinate detection (lat/lon, easting/northing, WKT, GeoJSON embedded), temporal fields, categorical vs continuous numeric
2. **Story detection:** What kind of data is this?
   - Temporal series → suggest animation timeline
   - Origin-destination pairs → suggest flow visualisation
   - Dense point clusters → suggest gravity/hex aggregation
   - Polygons with attributes → suggest choropleth with outlier highlights
   - Mixed geometry → suggest multi-layer composition
3. **Auto-style:** Generate a compelling first view. Don't show raw data — show the *interesting* version. Pick colour ramps that suit the data distribution (diverging for data with a meaningful centre, sequential for one-directional, qualitative for categories).
4. **Anomaly detection:** Highlight statistical outliers with subtle glow effects. The user's eye should be drawn to what's unusual without being told to look.

### 4. Temporal Engine

Time is not a slider. Time is a dimension you navigate.

- **Timeline ribbon:** Scrubable ribbon at the bottom showing data density over time. Thicker = more events. Coloured by dominant category.
- **Temporal brushing:** Select a time range and see only data from that window. The rest fades to ghost trails.
- **Playback:** Variable-speed playback with logarithmic time compression (slow during dense events, fast during quiet periods — like a time-lapse that breathes)
- **Temporal comparison:** Side-by-side or overlay of two time periods with a draggable curtain reveal
- **Accumulation mode:** Events leave permanent marks. Watch a year of earthquakes paint the Ring of Fire.

### 5. Multi-Format Ingestion

Auto-detect and parse in Web Workers. Progressive loading with visual feedback.

**Formats:** GeoJSON, TopoJSON, Shapefile (zipped), KML/KMZ, GPX, CSV (auto-detect lat/lon columns), WKT, GeoTIFF, Cloud-Optimised GeoTIFF, GeoParquet, FlatGeobuf

**Input methods:**
- Drag and drop (files or folders)
- Paste URL (fetches and detects format)
- Paste raw data (GeoJSON, WKT, CSV)
- Live endpoint (polling URL with configurable interval)
- WebSocket stream

### 6. Sonification

Data you can hear. Not a gimmick — a genuine analytical tool.

- **Spatial audio:** Pan position maps to geographic position. Move your mouse and hear where the data is dense.
- **Pitch mapping:** Map a numeric attribute to pitch. Sweep across a choropleth and hear the gradient.
- **Event sounds:** Real-time data events produce tones. Earthquake magnitude maps to volume + bass. Sensor alerts produce distinct timbres.
- **Ambient soundscape:** A subtle generative soundtrack that responds to what's on screen. Dense urban data = complex layered sounds. Ocean data = flowing, sparse tones. Adjustable or mutable.

### 7. Visual Effects Pipeline

Post-processing that makes the output look like a film, not a web app.

- **Bloom:** Bright data points glow and bleed light, especially against dark backgrounds
- **Depth of field:** Foreground data sharp, background soft when zoomed in
- **Motion blur:** During camera transitions, data streaks naturally
- **Atmospheric scattering:** Globe view has realistic atmosphere glow at the limb
- **Volumetric light:** Data-dense areas emit soft light cones in 3D view
- **Film grain:** Optional subtle grain for that cinematic feel (off by default)
- **Colour grading:** LUT-based colour grading. Presets: "Documentary", "Satellite Intel", "Neon City", "Nature", "Infrared"

## The Demo

The demo is the product. If the demo doesn't make someone's jaw drop, nothing else matters.

### Act 1: "The World is Alive" (Globe, 30s)

Open on a dark globe, slowly rotating. Silence. Then — particle trails begin streaking across oceans: global shipping routes materialising as flowing rivers of light. 50,000 vessel positions from AIS data, rendered as particles with velocity-based trails. The ocean surface comes alive with movement. Subtle ambient audio fades in — deep, oceanic.

Camera slowly pulls back to reveal the full globe. Flight paths arc overhead as luminous curves — 67,000 routes, each arc pulsing with a single travelling particle showing direction. The globe looks like a living organism with a nervous system.

### Act 2: "Pulse of the City" (NYC, 45s)

Camera executes a cinematic dolly dive from orbital to street level — continuous, no cuts — into Manhattan. The descent takes 4 seconds with motion blur.

NYC taxi pickups materialise as particles falling from the sky, settling into a hex grid that extrudes upward based on density. The hex grid breathes — heights pulse with time-of-day animation compressed into 10 seconds. Dawn: quiet, short hexes. Rush hour: explosive growth, hexes towering. Evening: redistribution toward entertainment districts. The colour shifts from cool blue (morning) through amber (afternoon) to hot pink (nightlife).

Sound: each hex emits a tone proportional to its height. The city literally hums louder during rush hour.

### Act 3: "Reading the Earth" (Environment, 45s)

Smooth crane shot from NYC across the Atlantic to the UK. During the crossing, ocean current particles appear — the Gulf Stream as a visible river of warm-coloured particles flowing northeast, with eddies and meanders.

Land on the UK. Rivers appear as flowing particle streams, coloured by water quality from live Environment Agency sensors. Clean stretches flow blue-white. Polluted sections turn amber-red with turbulent particle behaviour. Clicking a sensor shows real-time readings.

Camera rises to show the whole UK river network as a living circulatory system. Temperature gradient overlay fades in — terrain subtly coloured by elevation with real terrain mesh.

### Act 4: "Right Now" (Live Data, 30s)

Split into quadrants, each showing live data:
- **Top left:** USGS earthquake feed — last 7 days. Each quake emits expanding pulse rings sized by magnitude. The Ring of Fire is clearly visible from accumulated pulses.
- **Top right:** ISS position with orbit trail, updating every 3 seconds. Ground track prediction curve.
- **Bottom left:** OpenSky Network — live aircraft positions over Europe as flowing particles.
- **Bottom right:** UK flood warnings — river catchments coloured by alert level, pulsing where warnings are active.

All four updating in real time. The screen feels like a mission control display.

### Act 5: "Your Turn" (Interactive, open-ended)

All demo layers fade to ghost trails. A large drop zone appears: "Drop your data. Any format. Any size."

User drops a file. Particles materialize and settle into position. The system auto-detects the data type, selects a visualisation, and renders it — all within 2 seconds. A subtle "analysis complete" tone plays. A sidebar slides in showing detected columns, suggested visualisations, and anomalies found.

## Performance Targets

- 5M particles at 60fps (WebGPU) / 500K at 60fps (WebGL2 fallback)
- First meaningful paint <1.5s (map visible with loading indicators)
- Demo Act 1 renders within 3s of page load
- File parsing: 100MB GeoJSON in <2s via Web Worker + streaming parse
- Camera transitions: locked 60fps with motion blur
- Memory: <500MB for the full demo with all datasets loaded

## Non-Goals

- No server component — everything runs in the browser
- No user accounts or persistence beyond localStorage
- No editing/digitising tools (view-only)
- No mobile support (this is a power tool, 1024px+ minimum)
- No IE/legacy browser support — modern Chrome/Firefox/Safari only

## Quality Bar

The quality bar is visceral, not numerical:
- Would this make the front page of Hacker News? If not, it's not done.
- Would a cartographer show this to their colleagues? If not, it's not done.
- Would someone share a screen recording on Twitter? If not, it's not done.
- Does the demo give you goosebumps? If not, it's not done.

Technical minimums:
- 60fps during all demo transitions
- All demo datasets load and render without errors
- WebGPU path works in Chrome. WebGL2 fallback works in Firefox/Safari.
- No visible pop-in, flickering, or z-fighting in 3D views
- Sonification works with headphones (spatial audio)
