import type { RoadMetadata } from './RoadTypes';

/**
 * A segment is a single edge in the road graph,
 * representing the road between two consecutive nodes in a way.
 */
export interface Segment {
  id: string;                   // Unique ID: wayId-segmentIndex
  wayId: string;                // Parent way ID
  startNodeId: string;          // Start node of this segment
  endNodeId: string;            // End node of this segment
  startCoord: [number, number]; // [lat, lon]
  endCoord: [number, number];   // [lat, lon]
  length: number;               // Length in meters
  metadata: RoadMetadata;       // Inherited from parent way

  /**
   * Connected segments for graph traversal
   * - forward: segments reachable when exiting from endNodeId
   * - backward: segments reachable when exiting from startNodeId (only if bidirectional)
   */
  connectedSegments: {
    forward: string[];
    backward: string[];
  };
}
