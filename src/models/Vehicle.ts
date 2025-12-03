/**
 * Position on the road network
 */
export interface RoadPosition {
  segmentId: string;
  distanceAlongSegment: number; // meters from segment start
  direction: "forward" | "backward";
  lane: number; // 0-indexed lane (0 = rightmost)
}

/**
 * Geographic position for rendering
 */
export interface GeoPosition {
  lat: number;
  lon: number;
  bearing: number; // 0-360 degrees, clockwise from north
}

/**
 * Physical properties of a vehicle
 */
export interface VehiclePhysics {
  maxSpeed: number; // m/s
  maxAcceleration: number; // m/s²
  maxDeceleration: number; // m/s² (positive value)
  length: number; // meters
  width: number; // meters
}

/**
 * Lane change state
 */
export interface LaneChangeState {
  isChanging: boolean;
  targetLane: number;
  progress: number; // 0-1 through lane change maneuver
}

/**
 * Dynamic state of a vehicle
 */
export interface VehicleState {
  speed: number; // m/s
  acceleration: number; // m/s²
  roadPosition: RoadPosition;
  geoPosition: GeoPosition;
  laneChange: LaneChangeState;
}

/**
 * Complete vehicle model
 */
export interface Vehicle {
  id: string;
  physics: VehiclePhysics;
  state: VehicleState;
}

/**
 * Driver behavior profile
 */
export interface DriverBehavior {
  reflexTime: number; // 0.5-2.0 seconds
  aggressiveness: number; // 0-1 (affects accel/decel rates)
  preferredSpeedFactor: number; // 0.8-1.2 (multiplier for speed limits)
  laneChangeTendency: number; // 0-1 (willingness to change lanes)
}

/**
 * Driver navigation state
 */
export interface NavigationState {
  route: string[]; // Ordered segment IDs
  currentRouteIndex: number;
  hasArrived: boolean;
}

/**
 * Complete driver model
 */
export interface Driver {
  id: string;
  behavior: DriverBehavior;
  navigation: NavigationState;
}

/**
 * Combined driver + vehicle entity (main simulation entity)
 */
export interface DrivenVehicle {
  vehicle: Vehicle;
  driver: Driver;
}

/**
 * Create default vehicle physics for a car
 */
export function createDefaultCarPhysics(): VehiclePhysics {
  return {
    maxSpeed: 50 / 3.6, // 50 km/h in m/s
    maxAcceleration: 3.0, // m/s²
    maxDeceleration: 6.0, // m/s²
    length: 4.5, // meters
    width: 1.8, // meters
  };
}

/**
 * Create random driver behavior
 */
export function createRandomDriverBehavior(): DriverBehavior {
  return {
    reflexTime: 0.5 + Math.random() * 1.5, // 0.5-2.0 seconds
    aggressiveness: Math.random(), // 0-1
    preferredSpeedFactor: 0.8 + Math.random() * 0.4, // 0.8-1.2
    laneChangeTendency: 0.3 + Math.random() * 0.5, // 0.3-0.8
  };
}

/**
 * Create initial lane change state (not changing)
 */
export function createInitialLaneChangeState(): LaneChangeState {
  return {
    isChanging: false,
    targetLane: 0,
    progress: 0,
  };
}
