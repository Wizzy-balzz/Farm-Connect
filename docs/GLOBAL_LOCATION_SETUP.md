# FarmConnect Global Location & Maps System Setup Guide

## Overview

FarmConnect features an enterprise-grade **Global Location & Maps Architecture** supporting multi-country administrative hierarchies (Country → Region → District → Place), browser geolocation ("Near Me"), Mapbox live satellite maps with graceful offline fallbacks, and multi-currency order preservation.

---

## 1. Environment Configuration

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

### Environment Variables

| Variable Key | Description | Optional / Required | Default Fallback |
| :--- | :--- | :--- | :--- |
| `VITE_MAPBOX_ACCESS_TOKEN` | Mapbox GL JS Public Token | Optional | Offline interactive SVG map |
| `GEONAMES_USERNAME` | Registered GeoNames API username | Optional | Comprehensive local offline location dictionary |

---

## 2. Architecture & Normalization

### Provider Chain
1. **REST Countries API** (`https://restcountries.com/v3.1/all`) — ISO Alpha-2/3 country metadata, flags, currencies.
2. **GeoNames API** (`http://www.geonames.org/export/geonames-search.html`) — Multi-level administrative regions and districts.
3. **Mapbox Geocoding & Reverse Geocoding API** — Freeform location search and lat/lng reverse geocoding.

### Centralized Backend Service
All frontend requests flow through `backend/services/locationService.js` and Express endpoints (`/api/locations/*`). This ensures API tokens are never exposed on client scripts and responses are normalized.

### Offline & Resilience Guarantee
If external location APIs are slow or credentials are unconfigured, FarmConnect seamlessly falls back to an internal LRU-cached offline dictionary (`IN`, `US`, `CA`, `GB`, `AU`) with zero runtime errors or map crashes.
