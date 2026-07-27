# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Traffic simulation using OSM data with real-time vehicle navigation. MVC architecture with TypeScript.

## Commands

```bash
npm run dev          # Start dev server at localhost:5173
npm run build        # TypeScript check + production build
npm run preview      # Preview production build
npm run preprocess   # Convert OSM XML to CBOR (osm/map.osm -> public/graph.cbor)
npm run lint         # Run oxlint on src/
npm run lint:fix     # Run oxlint with auto-fix
npm run format       # Format with oxfmt
npm run format-check # Check formatting
```

## Key Entry Points

- `src/main.ts` - Application bootstrap
- `index.html` - Single page entry
- `osm/map.osm` - OSM source data (preprocessed to CBOR)
- `public/graph.cbor` - Preprocessed road graph (CBOR format with native Map support)

## Architecture

### Layer Responsibilities

**Models** (`src/models/`)

- Pure data structures, no logic
- `Vehicle.ts` - Vehicle, Driver, DrivenVehicle, physics/behavior interfaces
- `RoadGraph.ts` - Graph structure with nodes and segments
- `Segment.ts` - Road segment with connectivity info

**Services** (`src/services/`)

- Business logic, no UI dependencies
- `PathFinder.ts` - A\* algorithm using segment connectivity
- `SimulationEngine.ts` - Game loop, physics updates
- `OSMParser.ts` - XML → OSMNode/OSMWay maps (build-time only)
- `GraphBuilder.ts` - OSMNode/Way → RoadGraph with segments (build-time only)

**Scripts** (`scripts/`)

- `preprocess-osm.ts` - Converts OSM XML to CBOR using SAX streaming parser

**Views** (`src/views/`)

- UI rendering, no business logic
- `MapView.ts` - Leaflet map wrapper
- `VehicleView.ts` - Vehicle markers with interpolation
- `SimulationPanel.ts` - Control buttons, status display

**Controllers** (`src/controllers/`)

- Coordinates models, services, views
- `MapController.ts` - Map interaction, road info display
- `SimulationController.ts` - Simulation lifecycle, vehicle spawning

## Key Algorithms

### Pathfinding (PathFinder.ts)

- A\* with (segmentId, direction) state pairs
- Neighbors from `segment.connectedSegments.forward/backward`
- Heuristic: Haversine distance to destination endpoint
- Handles one-way roads via direction tracking

### Physics Loop (SimulationEngine.ts)

- Fixed timestep: 16.67ms (60fps)
- Accumulator pattern for consistent physics
- Position update: `distance += speed * deltaTime`
- Segment transitions via route navigation

### Rendering (VehicleView.ts)

- Position interpolation between physics ticks
- Bearing interpolation with 360/0 wrap handling
- Zoom-scaled vehicle markers

## Road Graph Structure

```
RoadGraph
├── nodes: Map<nodeId, OSMNode>     # All OSM nodes
├── ways: Map<wayId, OSMWay>        # All OSM ways
├── segments: Map<segmentId, Segment>  # Road segments
└── bounds: { minLat, maxLat, minLon, maxLon }

Segment
├── id, wayId, startNodeId, endNodeId
├── startCoord, endCoord: [lat, lon]
├── length: number (meters)
├── connectedSegments: { forward: [], backward: [] }
└── metadata: { name, roadType, maxSpeed, lanes, oneway }
```

## Vehicle State Flow

```
1. SpawnVehicle → PathFinder.findPath(start, end)
2. Create DrivenVehicle with route, physics, behavior
3. SimulationEngine.physicsTick():
   - Calculate target speed from segment maxSpeed × driver factor
   - Apply acceleration based on aggressiveness
   - Update distanceAlongSegment
   - Handle segment transitions via route
   - Convert RoadPosition → GeoPosition
4. VehicleView.updateVehicles() - interpolate and render
5. On arrival → remove vehicle
```

## Adding Features

### New Road Attribute

1. Add to `SegmentMetadata` in `Segment.ts`
2. Parse in `GraphBuilder.buildSegmentMetadata()`
3. Use in `SimulationEngine` or display in `InfoPanel`

### New Driver Behavior

1. Add to `DriverBehavior` in `Vehicle.ts`
2. Update `createRandomDriverBehavior()` factory
3. Use in `SimulationEngine.calculateAcceleration()`

### New Vehicle Type

1. Create factory in `Vehicle.ts` (like `createDefaultCarPhysics`)
2. Use in `SimulationController.createDrivenVehicle()`

## File Dependencies

```
main.ts
├── cbor-x (decode CBOR → RoadGraph with Maps)
├── views/MapView, InfoPanel, VehicleView, SimulationPanel
└── controllers/MapController, SimulationController
    └── services/PathFinder, SimulationEngine
        └── models/Vehicle, RoadGraph

scripts/preprocess-osm.ts (build-time)
├── sax (streaming XML parser)
├── cbor-x (encode RoadGraph → CBOR)
└── models/RoadGraph, Segment, OSMNode, OSMWay
```

## Testing Considerations

- `PathFinder`: Test route finding, handle disconnected segments
- `SimulationEngine`: Test physics updates, segment transitions
- `VehicleView`: Test marker creation/removal, interpolation

## Debug Access

In browser console:

```javascript
trafficSimGraph; // Road graph data
simController; // Simulation controller
simController.getEngine().getVehicles(); // Current vehicles
```
