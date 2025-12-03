# Traffic Simulator - Development Guide

## Project Overview

Traffic simulation using OSM data with real-time vehicle navigation. MVC architecture with TypeScript.

## Quick Reference

### Run Development
```bash
npm run dev      # Start dev server at localhost:5173
npm run build    # Production build
npm run preview  # Preview production build
```

### Key Entry Points
- `src/main.ts` - Application bootstrap
- `index.html` - Single page entry
- `public/map.osm` - OSM data file

## Architecture

### Layer Responsibilities

**Models** (`src/models/`)
- Pure data structures, no logic
- `Vehicle.ts` - Vehicle, Driver, DrivenVehicle, physics/behavior interfaces
- `RoadGraph.ts` - Graph structure with nodes and segments
- `Segment.ts` - Road segment with connectivity info

**Services** (`src/services/`)
- Business logic, no UI dependencies
- `OSMParser.ts` - XML → OSMNode/OSMWay maps
- `GraphBuilder.ts` - OSMNode/Way → RoadGraph with segments
- `PathFinder.ts` - A* algorithm using segment connectivity
- `SimulationEngine.ts` - Game loop, physics updates

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
- A* with (segmentId, direction) state pairs
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
├── services/OSMParser → models/OSMNode, OSMWay
├── services/GraphBuilder → models/RoadGraph, Segment
├── views/MapView, InfoPanel, VehicleView, SimulationPanel
└── controllers/MapController, SimulationController
    └── services/PathFinder, SimulationEngine
        └── models/Vehicle, RoadGraph
```

## Testing Considerations

- `PathFinder`: Test route finding, handle disconnected segments
- `SimulationEngine`: Test physics updates, segment transitions
- `VehicleView`: Test marker creation/removal, interpolation

## Debug Access

In browser console:
```javascript
trafficSimGraph      // Road graph data
simController        // Simulation controller
simController.getEngine().getVehicles()  // Current vehicles
```
