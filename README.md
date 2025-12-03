# Traffic Simulator

A real-time traffic simulation built with TypeScript and Leaflet, using OpenStreetMap data for road networks.

## Features

- **OSM Data Parsing**: Loads and parses OpenStreetMap XML files
- **Road Network Visualization**: Displays roads with appropriate styling based on road type
- **Vehicle Simulation**: Vehicles with physics-based movement navigate from random point A to B
- **Driver Behavior**: Configurable driver characteristics (reflex time, aggressiveness, speed preference)
- **A* Pathfinding**: Efficient route calculation using road segment connectivity
- **Real-time Animation**: Smooth 60fps rendering with position interpolation
- **Time Control**: Adjustable simulation speed (0.25x to 10x)

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Running

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### Building

```bash
npm run build
```

## Usage

1. **Start Simulation**: Click "Start" to begin the simulation loop
2. **Add Vehicles**: Click "Add Vehicle" to spawn a vehicle with a random route
3. **Control Speed**: Use the speed dropdown to adjust simulation time (0.25x - 10x)
4. **Pause/Resume**: Click "Pause" to pause, click again to resume
5. **Stop**: Click "Stop" to end simulation and clear all vehicles

## Architecture

```
src/
├── controllers/          # Application logic coordination
│   ├── MapController     # Map interaction handling
│   └── SimulationController  # Simulation orchestration
├── models/               # Data structures
│   ├── OSMNode/Way       # OpenStreetMap entities
│   ├── RoadGraph         # Road network graph
│   ├── Segment           # Road segment with connectivity
│   └── Vehicle           # Vehicle, Driver, physics models
├── services/             # Business logic
│   ├── OSMParser         # XML parsing for OSM data
│   ├── GraphBuilder      # Builds road graph from OSM
│   ├── PathFinder        # A* pathfinding algorithm
│   └── SimulationEngine  # Physics simulation loop
├── views/                # UI components
│   ├── MapView           # Leaflet map wrapper
│   ├── VehicleView       # Vehicle marker rendering
│   ├── InfoPanel         # Road information display
│   └── SimulationPanel   # Simulation controls
└── utils/                # Helper functions
    ├── geometry          # Distance, bearing calculations
    └── constants         # Road type definitions
```

## Data Models

### Vehicle Physics
- `maxSpeed`: Maximum velocity (m/s)
- `maxAcceleration`: Maximum acceleration (m/s²)
- `maxDeceleration`: Maximum braking (m/s²)
- `length/width`: Physical dimensions (meters)

### Driver Behavior
- `reflexTime`: Reaction delay (0.5-2.0 seconds)
- `aggressiveness`: Driving intensity (0-1)
- `preferredSpeedFactor`: Speed limit multiplier (0.8-1.2)
- `laneChangeTendency`: Willingness to change lanes (0-1)

### Road Position
- `segmentId`: Current road segment
- `distanceAlongSegment`: Progress along segment (meters)
- `direction`: Forward or backward along segment
- `lane`: Lane index (0 = rightmost)

## OSM Data

Place your OSM data file as `public/map.osm`. You can export OSM data from:
- https://www.openstreetmap.org/export
- https://overpass-turbo.eu/

## Technology Stack

- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **Leaflet**: Interactive map library
- **OpenStreetMap**: Road network data

## License

MIT
