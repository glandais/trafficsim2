import type { RoadGraph, Segment, DrivenVehicle, GeoPosition } from '../models';
import { calculateBearing } from '../utils/geometry';

/**
 * Simulation configuration
 */
export interface SimulationConfig {
  targetFPS: number;
  physicsTickRate: number;
  maxDeltaTime: number;
}

/**
 * Simulation state
 */
export interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
  simulationTime: number;
  timeScale: number;
  tickCount: number;
}

/**
 * Simulation events
 */
export type SimulationEvent =
  | { type: 'tick'; deltaTime: number; vehicles: DrivenVehicle[] }
  | { type: 'vehicleArrived'; vehicleId: string }
  | { type: 'started' }
  | { type: 'stopped' }
  | { type: 'paused' }
  | { type: 'resumed' };

export type SimulationEventCallback = (event: SimulationEvent) => void;

/**
 * Default lane width in meters
 */
const LANE_WIDTH = 3.5;

/**
 * Main simulation engine with game loop
 */
export class SimulationEngine {
  private graph: RoadGraph;
  private config: SimulationConfig;
  private state: SimulationState;
  private vehicles: Map<string, DrivenVehicle> = new Map();
  private eventCallbacks: SimulationEventCallback[] = [];

  private animationFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private accumulator: number = 0;

  constructor(graph: RoadGraph, config?: Partial<SimulationConfig>) {
    this.graph = graph;
    this.config = {
      targetFPS: 60,
      physicsTickRate: 60,
      maxDeltaTime: 0.1,
      ...config
    };

    this.state = {
      isRunning: false,
      isPaused: false,
      simulationTime: 0,
      timeScale: 1.0,
      tickCount: 0
    };
  }

  /**
   * Add a vehicle to the simulation
   */
  addVehicle(drivenVehicle: DrivenVehicle): void {
    this.vehicles.set(drivenVehicle.vehicle.id, drivenVehicle);
  }

  /**
   * Remove a vehicle from the simulation
   */
  removeVehicle(vehicleId: string): void {
    this.vehicles.delete(vehicleId);
  }

  /**
   * Get all vehicles
   */
  getVehicles(): DrivenVehicle[] {
    return Array.from(this.vehicles.values());
  }

  /**
   * Start the simulation
   */
  start(): void {
    if (this.state.isRunning) return;

    this.state.isRunning = true;
    this.state.isPaused = false;
    this.lastTimestamp = performance.now();
    this.accumulator = 0;

    this.emit({ type: 'started' });
    this.gameLoop(this.lastTimestamp);
  }

  /**
   * Stop the simulation
   */
  stop(): void {
    if (!this.state.isRunning) return;

    this.state.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.emit({ type: 'stopped' });
  }

  /**
   * Toggle pause
   */
  togglePause(): void {
    if (!this.state.isRunning) return;

    this.state.isPaused = !this.state.isPaused;
    if (this.state.isPaused) {
      this.emit({ type: 'paused' });
    } else {
      this.lastTimestamp = performance.now();
      this.emit({ type: 'resumed' });
    }
  }

  /**
   * Set time scale
   */
  setTimeScale(scale: number): void {
    this.state.timeScale = Math.max(0.1, Math.min(10, scale));
  }

  /**
   * Subscribe to events
   */
  onEvent(callback: SimulationEventCallback): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      const index = this.eventCallbacks.indexOf(callback);
      if (index >= 0) this.eventCallbacks.splice(index, 1);
    };
  }

  /**
   * Get current state
   */
  getState(): Readonly<SimulationState> {
    return { ...this.state };
  }

  /**
   * Main game loop
   */
  private gameLoop(timestamp: number): void {
    if (!this.state.isRunning) return;

    this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));

    if (this.state.isPaused) return;

    // Calculate delta time
    const rawDeltaTime = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    // Cap delta time
    const deltaTime = Math.min(rawDeltaTime, this.config.maxDeltaTime) * this.state.timeScale;

    // Fixed timestep physics
    const fixedDeltaTime = 1 / this.config.physicsTickRate;
    this.accumulator += deltaTime;

    while (this.accumulator >= fixedDeltaTime) {
      this.physicsTick(fixedDeltaTime);
      this.accumulator -= fixedDeltaTime;
      this.state.tickCount++;
    }

    // Emit tick for rendering
    this.emit({
      type: 'tick',
      deltaTime,
      vehicles: this.getVehicles()
    });
  }

  /**
   * Physics update tick
   */
  private physicsTick(deltaTime: number): void {
    const arrivedVehicles: string[] = [];

    for (const drivenVehicle of this.vehicles.values()) {
      this.updateVehicle(drivenVehicle, deltaTime);

      if (drivenVehicle.driver.navigation.hasArrived) {
        arrivedVehicles.push(drivenVehicle.vehicle.id);
      }
    }

    // Emit arrival events
    for (const vehicleId of arrivedVehicles) {
      this.emit({ type: 'vehicleArrived', vehicleId });
    }

    this.state.simulationTime += deltaTime;
  }

  /**
   * Update a single vehicle
   */
  private updateVehicle(drivenVehicle: DrivenVehicle, deltaTime: number): void {
    const { vehicle, driver } = drivenVehicle;
    const segment = this.graph.segments.get(vehicle.state.roadPosition.segmentId);
    if (!segment) return;

    // 1. Calculate desired speed
    const desiredSpeed = this.calculateDesiredSpeed(drivenVehicle, segment);

    // 2. Apply acceleration
    const newSpeed = this.applyAcceleration(vehicle, desiredSpeed, driver.behavior.aggressiveness, deltaTime);

    // 3. Update position
    const distanceTraveled = newSpeed * deltaTime;
    this.updatePosition(drivenVehicle, distanceTraveled);

    // 4. Update lane change if in progress
    this.updateLaneChange(drivenVehicle, deltaTime);

    // 5. Update vehicle state
    vehicle.state.speed = newSpeed;

    // 6. Calculate geo position
    vehicle.state.geoPosition = this.calculateGeoPosition(drivenVehicle);
  }

  /**
   * Calculate desired speed based on road and driver
   */
  private calculateDesiredSpeed(drivenVehicle: DrivenVehicle, segment: Segment): number {
    const { vehicle, driver } = drivenVehicle;
    const speedLimit = (segment.metadata.maxspeed || 50) / 3.6; // km/h to m/s
    const driverPreferred = speedLimit * driver.behavior.preferredSpeedFactor;
    return Math.min(driverPreferred, vehicle.physics.maxSpeed);
  }

  /**
   * Apply acceleration to reach desired speed
   */
  private applyAcceleration(
    vehicle: DrivenVehicle['vehicle'],
    desiredSpeed: number,
    aggressiveness: number,
    deltaTime: number
  ): number {
    const speedDiff = desiredSpeed - vehicle.state.speed;
    const accelFactor = 0.5 + 0.5 * aggressiveness;

    let acceleration: number;
    if (speedDiff > 0) {
      acceleration = Math.min(speedDiff / deltaTime, vehicle.physics.maxAcceleration * accelFactor);
    } else {
      acceleration = Math.max(speedDiff / deltaTime, -vehicle.physics.maxDeceleration * accelFactor);
    }

    vehicle.state.acceleration = acceleration;
    return Math.max(0, vehicle.state.speed + acceleration * deltaTime);
  }

  /**
   * Update vehicle position along route
   */
  private updatePosition(drivenVehicle: DrivenVehicle, distance: number): void {
    const { vehicle, driver } = drivenVehicle;
    const { roadPosition } = vehicle.state;
    const { navigation } = driver;

    let remainingDistance = distance;
    let currentSegment = this.graph.segments.get(roadPosition.segmentId);

    while (remainingDistance > 0 && currentSegment && !navigation.hasArrived) {
      const distanceToEnd = currentSegment.length - roadPosition.distanceAlongSegment;

      if (remainingDistance < distanceToEnd) {
        // Stay on current segment
        roadPosition.distanceAlongSegment += remainingDistance;
        remainingDistance = 0;
      } else {
        // Move to next segment
        remainingDistance -= distanceToEnd;
        navigation.currentRouteIndex++;

        if (navigation.currentRouteIndex >= navigation.route.length) {
          // Arrived at destination
          navigation.hasArrived = true;
          roadPosition.distanceAlongSegment = currentSegment.length;
          remainingDistance = 0;
        } else {
          // Move to next segment in route
          const nextSegmentId = navigation.route[navigation.currentRouteIndex];
          const nextSegment = this.graph.segments.get(nextSegmentId);

          if (nextSegment) {
            roadPosition.segmentId = nextSegmentId;
            roadPosition.distanceAlongSegment = 0;

            // Determine direction based on how we enter the segment
            const exitNode = roadPosition.direction === 'forward'
              ? currentSegment.endNodeId
              : currentSegment.startNodeId;

            if (nextSegment.startNodeId === exitNode) {
              roadPosition.direction = 'forward';
            } else {
              roadPosition.direction = 'backward';
            }

            // Reset lane for new segment (stay in same relative lane)
            const currentLanes = currentSegment.metadata.lanes || 1;
            const nextLanes = nextSegment.metadata.lanes || 1;
            roadPosition.lane = Math.min(roadPosition.lane, nextLanes - 1);

            currentSegment = nextSegment;
          } else {
            navigation.hasArrived = true;
            remainingDistance = 0;
          }
        }
      }
    }
  }

  /**
   * Update lane change progress
   */
  private updateLaneChange(drivenVehicle: DrivenVehicle, deltaTime: number): void {
    const { laneChange, roadPosition } = drivenVehicle.vehicle.state;

    if (!laneChange.isChanging) return;

    // Lane change takes about 2 seconds
    const laneChangeSpeed = 0.5; // progress per second
    laneChange.progress += laneChangeSpeed * deltaTime;

    if (laneChange.progress >= 1) {
      // Complete lane change
      roadPosition.lane = laneChange.targetLane;
      laneChange.isChanging = false;
      laneChange.progress = 0;
    }
  }

  /**
   * Calculate geographic position from road position
   */
  private calculateGeoPosition(drivenVehicle: DrivenVehicle): GeoPosition {
    const { roadPosition, laneChange } = drivenVehicle.vehicle.state;
    const segment = this.graph.segments.get(roadPosition.segmentId);

    if (!segment) {
      return { lat: 0, lon: 0, bearing: 0 };
    }

    // Get segment start/end based on direction
    const [startLat, startLon] = roadPosition.direction === 'forward'
      ? segment.startCoord
      : segment.endCoord;
    const [endLat, endLon] = roadPosition.direction === 'forward'
      ? segment.endCoord
      : segment.startCoord;

    // Interpolate along segment
    const ratio = roadPosition.distanceAlongSegment / segment.length;
    const lat = startLat + (endLat - startLat) * ratio;
    const lon = startLon + (endLon - startLon) * ratio;

    // Calculate bearing
    const bearing = calculateBearing(startLat, startLon, endLat, endLon);

    // Calculate lateral offset for lane
    const totalLanes = segment.metadata.lanes || 1;
    let currentLane = roadPosition.lane;

    // If changing lanes, interpolate
    if (laneChange.isChanging) {
      const fromLane = roadPosition.lane;
      const toLane = laneChange.targetLane;
      currentLane = fromLane + (toLane - fromLane) * laneChange.progress;
    }

    // Lane offset: positive = right, negative = left
    // Lane 0 is rightmost
    const laneOffset = (currentLane - (totalLanes - 1) / 2) * LANE_WIDTH;

    // Apply perpendicular offset
    const perpBearing = (bearing + 90) % 360;
    const offsetLat = laneOffset * Math.cos(perpBearing * Math.PI / 180) / 111000; // ~111km per degree lat
    const offsetLon = laneOffset * Math.sin(perpBearing * Math.PI / 180) / (111000 * Math.cos(lat * Math.PI / 180));

    return {
      lat: lat + offsetLat,
      lon: lon + offsetLon,
      bearing
    };
  }

  /**
   * Emit event to all subscribers
   */
  private emit(event: SimulationEvent): void {
    for (const callback of this.eventCallbacks) {
      callback(event);
    }
  }
}
