# GeoDash — Outcomes

## O1: App loads and renders a map
- The app starts with `npm run dev` or `pnpm dev`
- A map is visible in the browser within 3 seconds
- The map is interactive (pan, zoom, rotate)
- **Verification:** Screenshot shows a rendered map with controls

## O2: Drag-and-drop data loading works
- Dropping a GeoJSON file onto the map renders the features
- Dropping a CSV with lat/lon columns renders points
- An error message appears for unsupported file types
- **Verification:** Screenshot shows rendered GeoJSON features on the map

## O3: 3D visualisation works
- Extruded polygons render with height based on a data attribute
- 3D hex bins render with height aggregation
- Arc layers render between two points
- Camera can orbit in 3D (pitch/bearing controls)
- **Verification:** Screenshot shows 3D extruded features with perspective

## O4: Demo mode showcases capabilities
- A demo/tour launches automatically or via a button
- At least 3 distinct demo datasets are shown
- Transitions between datasets are smooth
- Live data (e.g. earthquake feed or ISS tracker) updates in real-time
- **Verification:** Screenshots of at least 3 different demo scenes

## O5: Multiple visualisation modes exist
- At least 3 of: choropleth, heatmap, cluster, hex bin, arc, point cloud
- Switching between modes works without page reload
- Each mode renders data correctly
- **Verification:** Screenshots showing different visualisation modes

## O6: The app is performant
- 10,000+ points render without visible lag
- Pan and zoom maintain 30fps+
- Large files show a loading indicator
- **Verification:** Console performance metrics or smooth interaction in recording
