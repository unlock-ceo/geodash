# GeoDash — Geospatial Visualisation Tool

## Vision

A stunning, performant geospatial visualisation tool that makes working with geo data feel like magic. Think Kepler.gl meets deck.gl meets Google Earth — but as a single self-contained app with zero config. Drop data in, get jaw-dropping visuals out.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **3D Engine:** deck.gl (WebGL2/WebGPU) on top of Mapbox GL JS or MapLibre GL JS (open-source preferred)
- **2D Fallback:** Leaflet or MapLibre for lightweight 2D views
- **Data Processing:** Turf.js for client-side spatial analysis, Apache Arrow for columnar data
- **Styling:** Tailwind CSS 4
- **State:** Zustand (lightweight, no boilerplate)
- **Testing:** Vitest + Playwright for visual regression

## Core Features

### 1. Multi-Format Data Ingestion

Support these formats out of the box with auto-detection:

- **Vector:** GeoJSON, TopoJSON, Shapefile (.shp/.dbf/.prj zip), KML/KMZ, GPX, CSV with lat/lon columns, WKT
- **Raster:** GeoTIFF (via geotiff.js), Cloud-Optimised GeoTIFF (COG)
- **3D:** CityGML, 3D Tiles (Cesium format), glTF with geo-anchoring
- **Live:** GeoJSON polling endpoints, WebSocket streams, MQTT geo topics

Auto-detect format on drag-and-drop or URL paste. Parse headers, sniff coordinate columns, detect CRS and reproject to WGS84 on the fly.

### 2. Visualisation Modes

#### 2D Map View
- Choropleth (fill colour by attribute)
- Graduated symbols (size by attribute)
- Heatmap (kernel density)
- Cluster (auto-aggregate points at zoom levels)
- Flow lines (origin-destination with animated particles)

#### 3D View
- Extruded polygons (buildings, regions by value)
- Point clouds with elevation
- 3D terrain with draped data layers
- Hex bins with height (H3 aggregation)
- Arc layers (3D flow lines between points)
- Volumetric rendering for environmental data

#### Globe View
- Full 3D globe with atmosphere effect
- Satellite imagery base layer
- Data layers projected onto sphere
- Smooth transition between flat map and globe

### 3. Live Data

- **Polling:** Configurable interval (1s-60s) for GeoJSON/API endpoints
- **WebSocket:** Connect to ws:// endpoints streaming GeoJSON features
- **MQTT:** Subscribe to geo topics (IoT sensors, vehicle tracking)
- **Replay:** Record live sessions, scrub through time with a timeline slider
- **Trail mode:** Show movement history with fading trails

### 4. Interaction & Analysis

- Click-to-inspect with rich popup (all attributes, formatted)
- Spatial filter: draw polygon/circle to filter visible features
- Attribute filter: sidebar with sliders/checkboxes per data column
- Distance/area measurement tool
- Buffer generation (draw buffer around selection)
- Spatial join: overlay two layers and combine attributes
- Export filtered data as GeoJSON/CSV

### 5. Styling & Theming

- Light/dark/satellite base maps
- Custom colour ramps (viridis, magma, plasma, turbo, sequential, diverging)
- Per-layer opacity, blend mode, line width, fill pattern
- Label placement with collision avoidance
- Legend auto-generation
- Style presets: "Satellite Intel", "Urban Planning", "Environmental", "Dark Ops"

### 6. Performance

- WebGL2 rendering for 1M+ points without lag
- Level-of-detail: simplify geometries at low zoom, full detail at high zoom
- Web Workers for parsing large files off the main thread
- Streaming parse for files >100MB (progressive loading with progress bar)
- Tile-based loading for large raster datasets (COG support)
- GPU-accelerated aggregation via deck.gl

## Demo Mode

The app ships with a spectacular built-in demo that showcases every capability:

### Demo Datasets (bundled or fetched on first load)

1. **Global Flight Paths** — 67k routes as animated arc layers between airports (3D globe view)
2. **NYC Taxi Pickups** — 1M points with hex aggregation, time-of-day animation, 3D extruded hexes
3. **UK Building Heights** — 3D extruded buildings coloured by height (London, Manchester, Edinburgh)
4. **Live ISS Position** — Real-time tracking via open API, with orbit trail
5. **Earthquake Feed** — USGS live feed, last 7 days, magnitude-scaled pulses
6. **River Water Quality** — UK Environment Agency live sensors, colour-coded by parameter thresholds

### Demo Flow

On first launch, the app runs an auto-guided tour:
1. Globe spins slowly, flight arcs animate in
2. Zoom into NYC, transition to 3D hex bins pulsing with taxi data
3. Fly to London, extrude buildings by height
4. Switch to live view: ISS tracker + earthquake pulses
5. "Your turn" — drag-and-drop zone activates

## Non-Goals

- No server component — everything runs in the browser
- No user accounts or persistence beyond localStorage
- No editing/digitising tools (view-only)
- No custom projection support beyond WGS84/Web Mercator

## Quality Bar

- Lighthouse performance score >90 on demo page
- First meaningful paint <2s
- 60fps during pan/zoom with 100k features
- All demo datasets load and render without errors
- Works in Chrome, Firefox, Safari (latest)
- Responsive: works on tablet (1024px+), degrades gracefully on mobile
