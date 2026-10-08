# FarmConnect GIS / Satellite / Cadastral Feasibility Audit

**Date:** 2026-10-04  
**Audit Scope:** Strict Read-Only Technical Feasibility & Architectural Design  
**Author:** Google DeepMind / Antigravity AI Engineering  
**Application:** FarmConnect B2B Direct Agricultural Marketplace  
**Operating Environment:** React 19 + Leaflet 1.9 + Node.js 24 + MySQL 8.0 + Python 3.12 AI Service  

---

## 1. Executive Summary

This feasibility audit evaluates how FarmConnect can evolve from its current point-based map system into a professional agricultural Geographic Information System (GIS). The audit investigates OpenStreetMap (OSM), Copernicus Sentinel-2 satellite imagery, ISRO Bhuvan geospatial layers, National Informatics Centre (NIC) Bhu-Naksha cadastral infrastructure, Tamil Nadu land-record data (Tamil Nilam / Patta Chitta / FMB), and Digital Elevation Models (DEM).

### Key Takeaways:
1. **Current System State:** FarmConnect currently operates a functional Leaflet + OpenStreetMap stack for point marker visualization (`MapBoxView.jsx`), coordinate reverse geocoding (`backend/services/locationService.js` via Nominatim), and highway routing (`backend/services/mapService.js` via OSRM). However, the agricultural farm boundary and cadastral survey section in `src/pages/farmer/MyFarm.jsx` is an **unconnected UI prototype / design mock** rendering static CSS gradient boxes and hardcoded strings.
2. **Best Satellite Source:** **Copernicus Sentinel-2 via Copernicus Data Space Ecosystem (CDSE)**. It provides global 10m multispectral imagery (RGB + NIR), 5-day revisit cadence, and native OGC WMS/WMTS endpoints (`sh.dataspace.copernicus.eu/ogc/wms/<INSTANCE_ID>`) embeddable in Leaflet with a free educational/research tier.
3. **Best India-Specific Source:** **ISRO / NRSC Bhuvan**. Useful as a high-resolution contextual overlay (Cartosat 2.5m panchromatic & LISS-IV 5.8m WMS via `bhuvan-vec2.nrsc.gov.in`), but unsuitable for automated agricultural multi-temporal NDVI monitoring due to lack of dynamic cloudless compositing APIs and static mosaic refresh cycles.
4. **Cadastral Feasibility:** **Not publicly accessible via open APIs**. Bhu-Naksha (developed by NIC) is an internal government platform for state land administration without public developer APIs. Tamil Nadu land records (`eservices.tn.gov.in` / Tamil Nilam) are strictly citizen-facing portals protected by CAPTCHAs, OTPs, and access restrictions. Third-party scraping is legally prohibited. **Official parcel data requires state MoU/authorized integration**. In the interim, user-drawn GPS boundaries must be strictly isolated and labeled as *"User-Demarcated / Remote-Sensing Estimated Boundary"*, never as legal cadastral ownership.
5. **Best DEM Source:** **Copernicus DEM (GLO-90) via Open-Meteo Elevation API** for point/transect queries (zero API key, free for non-commercial use, 10,000 req/day), supplemented by Copernicus GLO-30 GeoTIFFs for backend hydrological slope modeling.
6. **Architectural Recommendation:** Retain Leaflet 1.9 as the browser engine; introduce `leaflet-geoman` or `leaflet-draw` for farmer polygon demarcation; proxy satellite WMS requests through the Node backend or CDSE Public Instance; store parcel polygons in MySQL using standard GeoJSON text fields or `POLYGON` geometry columns.

---

## 2. Current GIS Implementation

An inspection of the active codebase reveals the following components and dependencies:

### 2.1 Dependencies (`package.json`)
- `leaflet`: `^1.9.4`
- `react-leaflet`: `^5.0.0`
- `@types/react`: `^19.2.17`
- `@types/react-dom`: `^19.2.3`

### 2.2 Component Inventory
| File | Role | Actual Architecture | Status |
|---|---|---|---|
| `src/pages/farmer/MyFarm.jsx` | Farmer Farm Profile & Operations | Section 3 renders `MapBoxView.jsx` with a single farm point marker. Section 7 renders a static CSS gradient placeholder card. | **Prototype / Placeholder** (for boundary GIS) |
| `src/components/common/MapBoxView.jsx` | Generic Farm Location Map | Despite legacy naming, fully implemented in `react-leaflet` with OSM `TileLayer`, custom SVG DivIcons, and `MapBoundsController`. | **Production-Ready** (Point Markers) |
| `src/components/common/OsmLocationPicker.jsx` | Coordinate Picker | Interactive click-to-place marker with Nominatim search and reverse geocoding. | **Production-Ready** (Point Location) |
| `src/components/common/OsmRouteMap.jsx` | Order Transit Route Map | Interactive Leaflet map displaying source field, destination buyer hub, transit checkpoints, and route polyline. | **Production-Ready** (Routing Line) |
| `src/components/farmer/FarmDecisionMap.jsx` | Crop Opportunity Map | Renders farmer location and nearby wholesale buyer pins with regional coordinate jittering. | **Production-Ready** (Market Pins) |
| `src/services/mapProvider.js` | Map Abstraction | Utility for Haversine distance calculations and Mapbox token presence checks. | **Production-Ready** (Utility) |
| `backend/services/locationService.js` | Backend Location Broker | Queries Nominatim (`/search` and `/reverse`) with in-memory caching and comprehensive 16-country fallback dictionary. | **Production-Ready** (Geocoding Broker) |
| `backend/services/mapService.js` | Routing Broker | Queries OSRM public service with User-Agent header; falls back to Haversine * 1.28 circuity factor. | **Production-Ready** (Routing Broker) |
| `backend/services/weatherService.js` | Agrarian Weather Service | Queries Open-Meteo 7-day forecast API based on farm lat/lng. | **Production-Ready** (Weather Engine) |

### 2.3 Status Assessment: Prototype / Placeholder
While point markers and route tracking are **Production-Ready**, the farm boundary, cadastral, and satellite survey features in `MyFarm.jsx` are **Class C: Prototype / Placeholder**.
*Evidence:* In `src/pages/farmer/MyFarm.jsx` lines 553–613:
```jsx
{/* 7. Satellite Survey / Cadastral Map Placeholder Architecture */}
<Card style={{ padding: "22px" }}>
  ...
  <div style={{
    height: "260px",
    background: mapMode === "satellite" ? "linear-gradient(135deg, #1e3a1e 0%, #0d1e0d 100%)" : "...",
    boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)"
  }}>
    <h4>{mapMode === "satellite" ? "Satellite Boundary Survey View" : "Cadastral Land Survey View"}</h4>
    <p>Coordinates: 19.9975° N, 73.7898° E • Elevation: 600m ASL • Land Survey Parcel #402/1A</p>
  </div>
</Card>
```
No Leaflet map is mounted for farm parcels; coordinates and survey numbers are hardcoded strings.

---

## 3. Current OpenStreetMap Architecture

### 3.1 Tile Provider & Leaflet Configuration
- **Tile URL:** `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- **Subdomains:** `{s}` resolves across `a`, `b`, `c`.
- **Max Zoom:** 19
- **Attribution:** `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`
- **Container Styling:** Responsive percentage height/width wrapped in `position: relative` containers with `zIndex: 1`.

### 3.2 OSM Tile Usage Policy Compliance (Documented Fact)
The OpenStreetMap Foundation (OSMF) Tile Usage Policy strictly states:
- *Requirements:* Valid HTTP `User-Agent`, standard attribution, no bulk scraping, and no aggressive tile caching without rate limits.
- *Current FarmConnect Compliance:* FarmConnect loads tiles client-side directly in Leaflet. Browser requests automatically provide standard browser User-Agents. Tile requests are strictly user-driven by viewport pans/zooms. FarmConnect fully complies with standard OSM non-commercial usage guidelines.

### 3.3 Geocoding & Routing Services
- **Nominatim Usage:** Forward search and reverse geocoding are routed through `backend/services/locationService.js`.
  - Rate limiting is enforced with minimum 1000ms inter-request delay (`rateLimitedNominatimFetch`).
  - Cache precision is quantized to 4 decimal places (~11 meters), preventing repetitive queries for identical coordinates.
  - Custom HTTP User-Agent header (`FarmConnect-App/2026`) is transmitted.
- **OSRM Usage:** `backend/services/mapService.js` queries `https://router.project-osrm.org/route/v1/driving/` with fallback to Haversine road circuity calculations.

---

## 4. Satellite Source Comparison

To determine the most viable imagery provider for Tamil Nadu and India-wide agriculture, candidate sources were evaluated across technical, operational, and legal dimensions:

| Dimension | Copernicus Sentinel-2 | ISRO Bhuvan (NRSC) | Google Earth Engine | Mapbox Satellite | ESRI World Imagery |
|---|---|---|---|---|---|
| **Data Provider** | European Space Agency (ESA) | ISRO / DOS (India) | Google Cloud | Mapbox Inc. | Environmental Systems Research Institute |
| **Open / Free Status** | **Free Data & Free API** (Research tier) | **Free Data & Free WMS** | Free for research (approval req.) | Freemium (50k loads/mo) | Free for non-commercial |
| **Authentication** | OAuth2 / Client Secret or CDSE Public Instance | No auth for basic WMS; Token for portal APIs | Service Account JSON | API Public Key | Token / Referrer URL |
| **API Architecture** | OGC WMS / WMTS / STAC / Process API | OGC WMS / WMTS | REST / Python SDK / Tiler | XYZ Tiles (`mapbox.satellite`) | OGC WMTS / XYZ |
| **Spatial Resolution** | 10m (RGB, NIR), 20m (RedEdge, SWIR) | 2.5m (Cartosat), 5.8m (LISS-IV), 23.5m (LISS-III) | 10m (Sentinel) to 0.5m (High-Res) | ~0.5m to 15m (Composite) | ~0.3m to 15m (Maxar composite) |
| **Temporal Revisit** | **5 days** (Sentinel-2A + 2B constellation) | Irregular public mosaic updates (yearly) | Dependent on underlying mission | Multi-year composite | Multi-year composite |
| **Tamil Nadu Coverage** | 100% cloud-masked coverage every 5 days | 100% territory coverage | 100% coverage | 100% coverage | 100% coverage |
| **NDVI Computation** | **Directly Supported** (B8 NIR - B4 Red) | Supported on raw data, static on WMS | Supported via compute pipeline | Not Supported (RGB only) | Not Supported (RGB only) |
| **Leaflet Integration** | **Native** (`L.tileLayer.wms`) | **Native** (`L.tileLayer.wms`) | Complex (requires tile proxy) | Native (`L.tileLayer`) | Native (`L.tileLayer`) |
| **Recommendation** | **PRIMARY SATELLITE ENGINE** | **SECONDARY REGIONAL BASEMAP** | BACKEND BATCH AI ONLY | NOT RECOMMENDED (Paid limits) | BASEMAP COMPOSITE ONLY |

### Concept Clarification:
- **Free Data vs. Free API:** Sentinel-2 data is fundamentally free and public domain. Accessing it via raw AWS S3 requester-pays buckets incurs compute/transfer fees, whereas accessing it via Copernicus Data Space Ecosystem (CDSE) APIs provides a generous **free monthly quota** of processing units for registered developer accounts.

---

## 5. Bhuvan / ISRO / NRSC Assessment

### 5.1 Technical Architecture (Documented Fact)
ISRO's National Remote Sensing Centre (NRSC) hosts the **Bhuvan Geoportal** (`bhuvan.nrsc.gov.in`). Bhuvan provides Open Geospatial Consortium (OGC) standard Web Map Services (WMS):
- **Base Endpoint:** `https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms` or `https://bhuvan-app1.nrsc.gov.in/bhuvan2d/bhuvan/wms`
- **Supported Standards:** WMS 1.1.1, WMS 1.3.0, WMTS 1.0.0
- **Coordinate Reference Systems:** EPSG:4326 (WGS 84), EPSG:3857 (Web Mercator)

### 5.2 Available Layers Relevant to Agriculture
1. **LISS-IV Multispectral Mosaic (5.8m resolution):** Captures broad field shapes and rural terrain features.
2. **LISS-III Seasonal Composites (23.5m resolution):** National Land Use / Land Cover (LULC) maps.
3. **Thematic Layers:** Agro-ecological zones, wasteland inventory, groundwater prospects, and soil erosion risk.

### 5.3 Leaflet Integration Feasibility
Bhuvan WMS can be mounted directly into Leaflet:
```javascript
const bhuvanSatellite = L.tileLayer.wms("https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms", {
  layers: "bhuvan_imagery", // Or layer identified via GetCapabilities
  format: "image/png",
  transparent: true,
  version: "1.1.1",
  attribution: "Map data © ISRO / NRSC Bhuvan"
});
```

### 5.4 Limitations for FarmConnect
1. **Temporal Revisit & Freshest Data:** Bhuvan public WMS layers are static, multi-year mosaics. Unlike Sentinel-2, which updates every 5 days, Bhuvan does not offer an open real-time WMS API for detecting current weekly crop growth.
2. **Band Access & Custom Shaders:** Bhuvan WMS serves pre-rendered PNG tiles; it does not expose an open, programmable evalscript API to calculate live dynamic NDVI in the browser.
3. **Terms of Use Restrictions:** ISRO terms explicitly prohibit bulk downloading, automated scraping, or turn-by-turn commercial navigation. Visualization in non-commercial / educational apps is permitted provided attribution is preserved.

---

## 6. Cadastral / Bhu-Naksha Assessment

### 6.1 The Bhu-Naksha Ecosystem (Documented Fact)
**Bhu-Naksha** is cadastral mapping software developed by the National Informatics Centre (NIC) for the Government of India. It digitizes cadastral maps (village maps, survey numbers, parcel subdivision lines) and integrates them with Records of Rights (RoR).

### 6.2 Critical Findings on Cadastral Data Openness:
1. **Open-Source Software vs. Open Public Data:** While NIC developed Bhu-Naksha using open-source GIS libraries, **the underlying cadastral parcel data belongs to individual State Revenue Departments and is NOT open public domain data**.
2. **Absence of Public APIs:** There is **no nationwide or state-wide open public REST/WMS API** for third-party applications to query parcel polygons by survey number without administrative authorization.
3. **Access Controls & Anti-Scraping:** State instances of Bhu-Naksha are either hosted on internal government State Wide Area Networks (SWAN) or protected behind CAPTCHAs, citizen mobile OTPs, and strict session limits.
4. **Legal Admissibility:** Cadastral boundaries are legal instruments of land ownership. Inaccurate digital rendering can lead to property disputes. State revenue portals explicitly disclaim that online views are for informational reference and only signed certified physical/digital FMB extracts are legally binding.

---

## 7. Tamil Nadu Cadastral Data Feasibility

### 7.1 State Administrative Systems (Documented Fact)
In Tamil Nadu, land administration is governed by the Directorate of Survey and Settlement and the Revenue Department:
- **Core Database:** **Tamil Nilam** (Rural and Urban land record database).
- **Public Portal:** **e-Services Portal** (`eservices.tn.gov.in`).
- **Core Documents:**
  - **Patta / Chitta:** Record of land ownership, classification (Nanjai/Punjai), and extent.
  - **FMB (Field Measurement Book) Sketch:** Detailed survey-number map showing boundary dimensions, G-line, F-line, and subdivision tie-lines.
  - **A-Register:** Village-level parcel register documenting land tenure, assessment rates, and soil classification.
- **Consolidated System (2026):** Tamil Nadu has rolled out the *Integrated Land Record*, consolidating Patta, Chitta, A-Register, and FMB sketches into a unified verified document.

### 7.2 Feasibility for FarmConnect
| Pathway | Feasibility | Legal / Technical Status | Verdict |
|---|---|---|---|
| **Direct Public REST API** | **0%** | Non-existent; state provides no open API for third-party apps. | **Infeasible** |
| **Automated Web Scraping** | **0%** | Prohibited under IT Act and state portal Terms of Service; blocked by CAPTCHA/rate limits. | **Strictly Forbidden** |
| **Official Government Integration (TNeGA MoU)** | **Technically 100% / Bureaucratically Complex** | Requires official partnership with Tamil Nadu e-Governance Agency (TNeGA). | **Long-Term Enterprise Goal** |
| **Citizen-Assisted PDF Upload & Verification** | **100% Feasible** | Farmer downloads certified Patta/FMB PDF from `eservices.tn.gov.in` and uploads it to FarmConnect for manual/AI verification. | **Recommended Immediate Approach** |

---

## 8. DEM / Terrain Assessment

Elevation and slope are vital for agricultural planning (water runoff, erosion risk, flood plains, cold air drainage).

### 8.1 Evaluated DEM Sources

1. **Copernicus DEM (GLO-30 / GLO-90)**
   - *Provider:* European Space Agency / Airbus Defence and Space.
   - *Resolution:* GLO-30 (30-meter resolution globally), GLO-90 (90-meter resolution).
   - *Vertical Accuracy:* < 4 meters standard error.
   - *Licensing:* Open and free under the Copernicus program terms.
   - *Access Method:* Available via Copernicus Data Space Ecosystem (CDSE) as Cloud Optimized GeoTIFFs (COG) and through OpenTopography / AWS S3 public registry.

2. **Open-Meteo Elevation API**
   - *Data Source:* Built upon Copernicus DEM GLO-90.
   - *Endpoint:* `https://api.open-meteo.com/v1/elevation?latitude=11.0168&longitude=76.9558`
   - *Features:* Returns instantaneous point elevation in meters ASL. Supports batch queries of up to 100 coordinate pairs in a single HTTP GET request.
   - *Cost & Quota:* Free for non-commercial use, 10,000 calls/day, zero API key required.
   - *Agricultural Suitability:* Ideal for populating farm elevation, well-head elevation, and regional watershed context in FarmConnect.

3. **SRTM (Shuttle Radar Topography Mission) 30m**
   - *Provider:* NASA / USGS.
   - *Status:* Legacy benchmark (captured 2000). Superseded in accuracy and coastal void-filling by Copernicus DEM.

---

## 9. Proposed FarmConnect GIS Architecture

The recommended architecture establishes a clean separation between base imagery, operational boundaries, dynamic vegetation indices, and administrative records:

```
                            +--------------------------------------------------+
                            |                 FARMCONNECT GIS                  |
                            +--------------------------------------------------+
                                                      |
            +-----------------------------------------+-----------------------------------------+
            |                                         |                                         |
+-----------------------+                 +-----------------------+                 +-----------------------+
|  Layer 1: Base Map    |                 | Layer 2: Satellite    |                 | Layer 5: Cadastral    |
|  OpenStreetMap        |                 | Copernicus Sentinel-2 |                 | Authoritative Records |
|  - Roads, Places,     |                 | - 10m Multi-spectral  |                 | - Official Govt Patta |
|    Districts, Hubs    |                 | - 5-day Revisit Cycle |                 | - State Land Registry |
|  - Standard OSM Tiles |                 | - CDSE WMS/WMTS       |                 | - Verified PDF Upload |
+-----------------------+                 +-----------------------+                 +-----------------------+
            |                                         |                                         |
            +-----------------------------------------+-----------------------------------------+
                                                      |
                                           +---------------------+
                                           | Leaflet Map Engine  |
                                           | (React-Leaflet v5)  |
                                           +---------------------+
                                                      |
            +-----------------------------------------+-----------------------------------------+
            |                                         |                                         |
+-----------------------+                 +-----------------------+                 +-----------------------+
| Layer 4: Farm Area    |                 | Layer 3: NDVI Engine  |                 | Layer 6: Terrain      |
| Farmer Demarcation    |                 | Vegetation Health     |                 | Open-Meteo & DEM      |
| - GPS Walk / Manual   |                 | - Sentinel-2 NIR/Red  |                 | - Elevation Profile   |
|   Polygon Draw        |                 | - Dynamic Evalscript  |                 | - Drainage & Slope    |
| - Stored as GeoJSON   |                 | - Weekly Crop Indices |                 | - Micro-watershed     |
+-----------------------+                 +-----------------------+                 +-----------------------+
                                                      |
                                           +---------------------+
                                           | FarmConnect AI Core |
                                           | Crop & Field Intel  |
                                           +---------------------+
```

---

## 10. Proposed Map Layers

The map interface should provide a multi-layer toggle control allowing farmers and enterprise vendors to switch perspectives:

### Layer 1: 🗺️ Base Street Map (OpenStreetMap)
- **Role:** General navigation, village roads, logistics routes, proximity to APMC mandis.
- **Provider:** OpenStreetMap standard tile servers.
- **Cost:** Free / Zero configuration.

### Layer 2: 🛰️ Natural Satellite Imagery (Copernicus Sentinel-2)
- **Role:** Visual ground truth, field boundary verification, regional crop color differentiation.
- **Provider:** Copernicus Data Space Ecosystem (CDSE) WMS / WMTS (`TRUE_COLOR` layer).
- **Resolution:** 10m per pixel.
- **Cost:** Free tier (registered CDSE account).

### Layer 3: 🌱 Dynamic Vegetation Index (NDVI)
- **Role:** Relative vigor assessment, nitrogen absorption variation, irrigation deficiency detection across plots.
- **Formula:** $(B08 - B04) / (B08 + B04)$ (Near-Infrared minus Red over NIR plus Red).
- **Visualization:** Color ramp: Red (< 0.2: bare soil/water), Yellow (0.2–0.4: sparse crop), Green (> 0.5: dense, vigorous canopy).
- **Cost:** Computed natively via Sentinel Hub custom evalscript on CDSE.

### Layer 4: 📐 Farm Boundary (Farmer Demarcation)
- **Role:** Explicit plot demarcation (Plot A, Plot B, boundary fences).
- **Mechanism:** Polygon drawing tool (`leaflet-geoman-free`) or mobile GPS walk-around recording.
- **Labeling Standard:** Strictly marked as: *"User-Demarcated Agrarian Boundary (Informational / Non-Cadastral)"*.

### Layer 5: 🧱 Cadastral & Land Records (Authoritative)
- **Role:** Linking official survey numbers, subdivision letters, and Patta certificates.
- **Implementation:** User-assisted document attachment (Farmer uploads Patta/FMB extract; metadata parsed and displayed alongside farm coordinates).
- **Notice:** Explicit disclaimer: *"Official land parcel boundaries are governed solely by the Tamil Nadu Directorate of Survey and Settlement."*

### Layer 6: ⛰️ Terrain & Drainage (Copernicus DEM)
- **Role:** Elevation display in meters ASL, slope orientation, irrigation runoff estimation.
- **Provider:** Open-Meteo Elevation API.
- **Cost:** Free / Zero API key.

### Layer 7: 🌧️ Hyper-Local Weather (Existing Open-Meteo Integration)
- **Role:** Overlaying real-time precipitation, wind vectors, and 7-day agrarian forecast alerts.
- **Status:** Already implemented in `backend/services/weatherService.js`.

---

## 11. Database Compatibility

### 11.1 Current Schema Limitations (Documented Fact)
Inspection of `backend/schema.sql` and the active MySQL instance confirms:
- **`users` Table:** Stores only point coordinates:
  - `lat DECIMAL(10, 7)`
  - `lng DECIMAL(10, 7)`
- **`products` Table:** Stores only point coordinates:
  - `lat DECIMAL(10, 7)`
  - `lng DECIMAL(10, 7)`
- **`orders` Table:** Stores point coordinates:
  - `deliveryLat DECIMAL(10, 7)`
  - `deliveryLng DECIMAL(10, 7)`
- **Missing Elements:**
  - Zero polygon tables.
  - Zero GeoJSON storage columns.
  - No MySQL Spatial types (`GEOMETRY`, `POINT`, `POLYGON`, `MULTIPOLYGON`).
  - `DEFAULT_PLOTS` in `MyFarm.jsx` is hardcoded in the frontend.

### 11.2 Recommended Future Schema Evolution (Non-Destructive)
When implementation begins in a subsequent task, create dedicated spatial tables without altering existing tables:
```sql
-- Proposed Future Table: Farm Parcels & Polygons
CREATE TABLE IF NOT EXISTS `farm_parcels` (
  `id` VARCHAR(100) PRIMARY KEY,
  `farmer_id` VARCHAR(100) NOT NULL,
  `parcel_name` VARCHAR(255) NOT NULL,
  `crop_name` VARCHAR(100),
  `area_acres` DECIMAL(8, 2),
  `survey_number` VARCHAR(100),
  `subdivision_number` VARCHAR(100),
  `district` VARCHAR(100),
  `taluk` VARCHAR(100),
  `village` VARCHAR(100),
  `patta_number` VARCHAR(100),
  `boundary_geojson` LONGTEXT NOT NULL,
  `boundary_polygon` GEOMETRY,
  `elevation_m` DECIMAL(6, 1),
  `created_at` VARCHAR(100) NOT NULL,
  `updated_at` VARCHAR(100) NOT NULL,
  FOREIGN KEY (`farmer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
*Advantage:* Using `LONGTEXT` for `boundary_geojson` guarantees instant compatibility with standard MySQL/MariaDB drivers and JSON parsers, while the optional `GEOMETRY` column allows future Spatial SQL queries (`ST_Contains`, `ST_Area`).

---

## 12. Security Considerations

1. **Frontend Secret Leakage:**
   - The current `src/services/mapProvider.js` references `VITE_MAPBOX_ACCESS_TOKEN`.
   - Sentinel Hub / CDSE instance IDs configured for public WMS should only have access to read-only visualization layers; sensitive client secrets must remain in `backend/.env`.
2. **Reverse Geocoding / SSRF Prevention:**
   - Nominatim and OSRM proxy calls in `backend/services/locationService.js` and `backend/services/mapService.js` validate coordinates using strict numeric boundary checks (`-90 <= lat <= 90`, `-180 <= lng <= 180`), preventing SSRF injection.
3. **Location Privacy & Crop Poaching:**
   - Exact high-resolution polygon coordinates of high-value crops (e.g., organic vanilla, saffron) must not be broadcast to unauthenticated public visitors. Public vendor marketplace listings should continue displaying city/district centroids (`farmerProfile.district`), keeping parcel-level boundary polygons restricted to authorized buyers under confirmed trade orders.

---

## 13. Performance Considerations

1. **Browser Memory & Leaflet Tile Volume:**
   - Adding multi-spectral Sentinel WMS layers alongside OSM tiles can saturate client network threads if zoom levels exceed capability. Sentinel-2 native resolution is 10m; setting `maxZoom: 16` prevents over-zooming on empty blurred pixels and reduces tile fetches.
2. **Server-Side Proxy vs. Direct Browser WMS:**
   - CDSE WMS requests can be made directly from the browser using a configured Public Instance ID, bypassing the Node.js backend. This eliminates backend bandwidth bottlenecks.
3. **NDVI Computation Offload:**
   - Rather than downloading raw GeoTIFF bands to the client browser or Node backend, compute NDVI server-side in the cloud using Sentinel Hub's evalscripts. The browser receives a lightweight, pre-rendered 256x256 PNG tile.

---

## 14. Cost / Availability Matrix

| Service | Category | Cost Structure | Student / Project Viability | Recommended Action |
|---|---|---|---|---|
| **OpenStreetMap Standard** | Free Tile Provider | 100% Free (Under OSM Fair Use Policy) | **Highest** | **Retain as default street basemap** |
| **OpenStreetMap Nominatim** | Free Geocoder | 100% Free (Rate limit: 1 req/sec) | **Highest** | **Retain backend cache broker** |
| **OSRM Public Routing** | Free Router | 100% Free (Fair use) | **Highest** | **Retain with circuity fallback** |
| **Copernicus CDSE Sentinel-2** | Public Earth Observation | Free registered tier (Educational/Trial quotas) | **Highest** | **Adopt as primary satellite engine** |
| **Open-Meteo Elevation API** | Free Elevation API | 100% Free for non-commercial (10,000/day) | **Highest** | **Adopt for farm terrain queries** |
| **ISRO / NRSC Bhuvan** | Indian Public Geoportal | Free WMS visualization | **Medium** (Static mosaics, variable uptime) | **Use as optional national basemap** |
| **NIC Bhu-Naksha** | Government Intranet System | N/A (Closed government software) | **Zero** (No public API) | **Do not attempt direct connection** |
| **Tamil Nadu e-Services (Patta)** | Government Citizen Portal | Citizen portal only; no 3rd-party API | **Zero for API** / High for manual upload | **Use farmer PDF upload verification** |
| **Google Maps / Earth Engine** | Commercial SaaS | Paid / Requires credit card registration | **Low** | **Avoid to maintain 100% free stack** |
| **Mapbox Satellite** | Commercial SaaS | Freemium (50,000 requests/mo limit) | **Low** (Risk of billing cutoff) | **Avoid** |

---

## 15. Recommended Technology Stack

- **Mapping Engine:** Leaflet `1.9.4` + `react-leaflet` `5.0.0` (Existing stack, 0 bundle bloat).
- **Drawing & Demarcation:** `leaflet-geoman-free` (Modern, touch-friendly polygon drawing library).
- **Basemap:** OpenStreetMap Carto tiles.
- **Satellite & Crop Health:** Copernicus Data Space Ecosystem (CDSE) Sentinel-2 WMS (`TRUE_COLOR` and `NDVI` layers).
- **Elevation / Terrain:** Open-Meteo Elevation API (JSON format, 0 keys).
- **Weather Engine:** Open-Meteo Weather Forecast (Already integrated).
- **Backend Storage:** MySQL 8.0 `farm_parcels` table with `boundary_geojson LONGTEXT`.

---

## 16. Implementation Roadmap (Future Work)

### Phase 1: Interactive GIS Container in MyFarm
- Replace the static CSS placeholder in `src/pages/farmer/MyFarm.jsx` with an interactive `<MapContainer>` using Leaflet.
- Bind the map center dynamically to the farmer's registered coordinates (`farmerProfile.lat`, `farmerProfile.lng`).

### Phase 2: Dual Basemap Toggle (OSM + Sentinel-2 Satellite)
- Register a free developer configuration on the Copernicus Data Space Ecosystem.
- Configure `L.tileLayer.wms` with True Color Sentinel-2 imagery.
- Add an intuitive Leaflet layer control toggling between Street Map and Satellite View.

### Phase 3: Field Demarcation & Boundary Drawing
- Integrate `leaflet-geoman-free` to allow the farmer to click and draw plot boundaries directly on top of satellite imagery.
- Automatically calculate parcel acreage using Spherical Geodesic formulas (`L.GeometryUtil.geodesicArea`).
- Persist the resulting GeoJSON to the backend database.

### Phase 4: Dynamic NDVI / Crop Health Visualization
- Add a Sentinel-2 WMS NDVI layer to visual canopy health.
- Allow farmers to inspect vigor variations across their drawn field boundaries over the past 30 days.

### Phase 5: Terrain & Elevation Profile
- Connect `Open-Meteo Elevation API` to fetch field elevation and display drainage slope context on the farm dashboard.

### Phase 6: Land Record Documentation & Patta Attachment
- Implement a structured form in My Farm where farmers enter official District, Taluk, Village, Survey Number, and Patta Number.
- Provide a secure upload zone for certified Patta/Chitta/FMB PDF extracts from `eservices.tn.gov.in`.
- Prominently display legal disclaimers separating user boundaries from authoritative government land records.

### Phase 7: AI Agricultural Interpretation
- Connect the farm's GeoJSON boundaries, crop type, elevation, and NDVI metrics to FarmConnect's existing Gemini AI Copilot to deliver hyper-local agronomic advice (e.g. fertilizer timing, water runoff warnings).

---

## 17. Risks & Limitations

1. **Resolution vs. Smallholdings:** Sentinel-2 has a 10-meter spatial resolution. A typical 1-acre plot in Tamil Nadu (~4,046 m²) covers approximately 40 pixels ($4 \times 10$). While sufficient for identifying field vigor and broad crop presence, it cannot resolve individual plant rows or precise fence posts.
2. **Cloud Cover During Monsoons:** Optical satellites (Sentinel-2, Bhuvan) cannot penetrate heavy cloud cover during the Southwest (June–Sept) and Northeast (Oct–Dec) monsoons. Synthetic Aperture Radar (Sentinel-1 SAR) would be required for all-weather soil moisture monitoring.
3. **Absence of Cadastral APIs:** Since Tamil Nadu and NIC do not provide open cadastral APIs, FarmConnect cannot automatically pull legal parcel boundaries. Any attempt to scrape government portals risks IP blacklisting and violates state terms. User-assisted document upload is the only viable legal approach.
4. **Legal Liability Disclaimer:** Farm boundaries drawn in FarmConnect must carry an explicit legal disclaimer stating they are for agronomic estimation and marketplace lot identification only, and do not constitute legal proof of land title or boundary demarcation.

---

## 18. Final Recommendation

### Assessment Classification:
**`GIS READY FOR IMPLEMENTATION (PHASED APPROACH)`**  
**`+ CADASTRAL DATA REQUIRES CITIZEN-ASSISTED DOCUMENTATION`**

The open-source stack (Leaflet + OpenStreetMap + Copernicus Sentinel-2 + Open-Meteo DEM) provides a 100% free, legally sound, and reliable foundation for agricultural GIS in FarmConnect. Real-time satellite imagery and vegetation health can be implemented without commercial API fees. Official cadastral parcels cannot be automated via open APIs, but can be seamlessly accommodated through citizen-provided land record verification.

---
*Report compiled strictly in READ-ONLY mode. Zero code or database modifications were executed during this audit.*
