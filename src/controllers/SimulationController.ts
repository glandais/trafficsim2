import type {
  RoadGraph,
  DrivenVehicle,
  Vehicle,
  Driver,
  RoadPosition,
  GeoPosition
} from '../models';
import {
  createDefaultCarPhysics,
  createRandomDriverBehavior,
  createInitialLaneChangeState
} from '../models';
import { PathFinder, SimulationEngine } from '../services';
import { VehicleView, SimulationPanel } from '../views';
import { calculateBearing } from '../utils/geometry';

/**
 * Controller for simulation
 */
export class SimulationController {
  private graph: RoadGraph;
  private engine: SimulationEngine;
  private pathFinder: PathFinder;
  private vehicleView: VehicleView;
  private simulationPanel: SimulationPanel;

  private vehicleIdCounter: number = 0;

  constructor(
    graph: RoadGraph,
    vehicleView: VehicleView,
    simulationPanel: SimulationPanel
  ) {
    this.graph = graph;
    this.vehicleView = vehicleView;
    this.simulationPanel = simulationPanel;

    this.pathFinder = new PathFinder(graph);
    this.engine = new SimulationEngine(graph);

    this.setupEventHandlers();
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    // Panel controls
    this.simulationPanel.onStart(() => this.start());
    this.simulationPanel.onStop(() => this.stop());
    this.simulationPanel.onPause(() => this.togglePause());
    this.simulationPanel.onAddVehicle(() => this.addRandomVehicle());
    this.simulationPanel.onTimeScale((scale) => this.setTimeScale(scale));

    // Engine events
    this.engine.onEvent((event) => {
      switch (event.type) {
        case 'tick':
          this.vehicleView.updateVehicles(event.vehicles);
          this.updatePanel();
          break;
        case 'vehicleArrived':
          console.log(`Vehicle ${event.vehicleId} arrived at destination`);
          this.engine.removeVehicle(event.vehicleId);
          break;
      }
    });
  }

  /**
   * Start simulation
   */
  start(): void {
    this.engine.start();
  }

  /**
   * Stop simulation
   */
  stop(): void {
    this.engine.stop();
    this.vehicleView.clear();
  }

  /**
   * Toggle pause
   */
  togglePause(): void {
    this.engine.togglePause();
  }

  /**
   * Set time scale
   */
  setTimeScale(scale: number): void {
    this.engine.setTimeScale(scale);
  }

  /**
   * Add a vehicle with random start and end
   */
  addRandomVehicle(): void {
    // Try to find valid start and end segments
    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
      attempts++;

      const startSegmentId = this.pathFinder.getRandomNavigableSegment();
      const endSegmentId = this.pathFinder.getRandomNavigableSegment();

      if (startSegmentId === endSegmentId) continue;

      const pathResult = this.pathFinder.findPath(startSegmentId, endSegmentId);

      if (pathResult.found && pathResult.path.length > 1) {
        const drivenVehicle = this.createDrivenVehicle(
          startSegmentId,
          pathResult.path.map(p => p.segmentId),
          pathResult.path[0].direction
        );

        this.engine.addVehicle(drivenVehicle);
        console.log(`Added vehicle ${drivenVehicle.vehicle.id} with route of ${pathResult.path.length} segments (${(pathResult.totalDistance / 1000).toFixed(2)} km)`);
        return;
      }
    }

    console.warn('Could not find valid path after', maxAttempts, 'attempts');
  }

  /**
   * Create a driven vehicle
   */
  private createDrivenVehicle(
    startSegmentId: string,
    route: string[],
    direction: 'forward' | 'backward'
  ): DrivenVehicle {
    const segment = this.graph.segments.get(startSegmentId)!;
    const vehicleId = `vehicle-${++this.vehicleIdCounter}`;

    // Calculate initial geo position
    const [startLat, startLon] = direction === 'forward'
      ? segment.startCoord
      : segment.endCoord;
    const [endLat, endLon] = direction === 'forward'
      ? segment.endCoord
      : segment.startCoord;
    const bearing = calculateBearing(startLat, startLon, endLat, endLon);

    // Initial road position
    const roadPosition: RoadPosition = {
      segmentId: startSegmentId,
      distanceAlongSegment: 0,
      direction,
      lane: 0 // Start in rightmost lane
    };

    // Initial geo position
    const geoPosition: GeoPosition = {
      lat: startLat,
      lon: startLon,
      bearing
    };

    // Create vehicle
    const vehicle: Vehicle = {
      id: vehicleId,
      physics: createDefaultCarPhysics(),
      state: {
        speed: 0,
        acceleration: 0,
        roadPosition,
        geoPosition,
        laneChange: createInitialLaneChangeState()
      }
    };

    // Create driver
    const driver: Driver = {
      id: `driver-${vehicleId}`,
      behavior: createRandomDriverBehavior(),
      navigation: {
        route,
        currentRouteIndex: 0,
        hasArrived: false
      }
    };

    return { vehicle, driver };
  }

  /**
   * Update panel with current state
   */
  private updatePanel(): void {
    this.simulationPanel.updateState(
      this.engine.getState(),
      this.engine.getVehicles().length
    );
  }

  /**
   * Get the simulation engine
   */
  getEngine(): SimulationEngine {
    return this.engine;
  }
}
