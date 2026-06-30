import type { OSMNode } from "./OSMNode";
import type { OSMWay } from "./OSMWay";
import type { Segment } from "./Segment";

/**
 * Stop sign information
 */
export interface StopSignInfo {
  direction?: "forward" | "backward"; // which direction must stop (relative to way)
  allWay: boolean; // all approaches must stop
}

/**
 * The complete road network graph structure
 */
export interface RoadGraph {
  /** All nodes indexed by ID */
  nodes: Map<string, OSMNode>;

  /** All ways indexed by ID */
  ways: Map<string, OSMWay>;

  /** All segments indexed by ID */
  segments: Map<string, Segment>;

  /** Adjacency list: nodeId -> list of segment IDs connected to this node */
  nodeToSegments: Map<string, string[]>;

  /** Intersection nodes: nodeId -> segment IDs (only for nodes with 2+ connections) */
  intersections: Map<string, string[]>;

  /** Stop sign nodes: nodeId -> stop sign info */
  stopSigns: Map<string, StopSignInfo>;

  /** Geographic bounds of the graph */
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}
