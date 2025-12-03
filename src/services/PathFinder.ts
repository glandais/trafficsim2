import type { RoadGraph, Segment } from "../models";
import { calculateDistance } from "../utils/geometry";

/**
 * Path step with segment and direction
 */
export interface PathStep {
  segmentId: string;
  direction: "forward" | "backward";
}

/**
 * Result of path finding
 */
export interface PathResult {
  found: boolean;
  path: PathStep[];
  totalDistance: number;
  error?: string;
}

/**
 * A* node for priority queue
 */
interface AStarNode {
  segmentId: string;
  direction: "forward" | "backward";
  gCost: number; // Cost from start
  hCost: number; // Heuristic to goal
  fCost: number; // gCost + hCost
  parent: AStarNode | null;
}

/**
 * Min-heap priority queue for A*
 */
class PriorityQueue {
  private heap: AStarNode[] = [];

  push(node: AStarNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): AStarNode | undefined {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return min;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[parentIndex].fCost <= this.heap[index].fCost) break;
      [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < this.heap.length && this.heap[leftChild].fCost < this.heap[smallest].fCost) {
        smallest = leftChild;
      }
      if (
        rightChild < this.heap.length &&
        this.heap[rightChild].fCost < this.heap[smallest].fCost
      ) {
        smallest = rightChild;
      }
      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

/**
 * A* pathfinding using segment connectivity
 */
export class PathFinder {
  private graph: RoadGraph;
  private segmentIds: string[];

  constructor(graph: RoadGraph) {
    this.graph = graph;
    this.segmentIds = Array.from(graph.segments.keys());
  }

  /**
   * Find shortest path from start segment to end segment
   */
  findPath(startSegmentId: string, endSegmentId: string): PathResult {
    const startSegment = this.graph.segments.get(startSegmentId);
    const endSegment = this.graph.segments.get(endSegmentId);

    if (!startSegment || !endSegment) {
      return {
        found: false,
        path: [],
        totalDistance: 0,
        error: "Invalid segment ID",
      };
    }

    if (startSegmentId === endSegmentId) {
      return {
        found: true,
        path: [{ segmentId: startSegmentId, direction: "forward" }],
        totalDistance: startSegment.length,
      };
    }

    const openSet = new PriorityQueue();
    const closedSet = new Set<string>(); // "segmentId:direction"
    const gCosts = new Map<string, number>();

    // Determine starting direction based on segment properties
    // Start in forward direction by default
    const startDirection: "forward" | "backward" = "forward";
    const startKey = `${startSegmentId}:${startDirection}`;

    const startNode: AStarNode = {
      segmentId: startSegmentId,
      direction: startDirection,
      gCost: 0,
      hCost: this.heuristic(startSegment, endSegment),
      fCost: this.heuristic(startSegment, endSegment),
      parent: null,
    };

    openSet.push(startNode);
    gCosts.set(startKey, 0);

    while (!openSet.isEmpty()) {
      const current = openSet.pop()!;
      const currentKey = `${current.segmentId}:${current.direction}`;

      // Check if we've reached the destination
      if (current.segmentId === endSegmentId) {
        return this.reconstructPath(current);
      }

      if (closedSet.has(currentKey)) continue;
      closedSet.add(currentKey);

      const currentSegment = this.graph.segments.get(current.segmentId);
      if (!currentSegment) continue;

      // Get neighbors based on direction
      const neighbors = this.getNeighbors(currentSegment, current.direction);

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.segmentId}:${neighbor.direction}`;
        if (closedSet.has(neighborKey)) continue;

        const neighborSegment = this.graph.segments.get(neighbor.segmentId);
        if (!neighborSegment) continue;

        const tentativeG = current.gCost + neighborSegment.length;
        const existingG = gCosts.get(neighborKey) ?? Infinity;

        if (tentativeG < existingG) {
          const hCost = this.heuristic(neighborSegment, endSegment);
          const neighborNode: AStarNode = {
            segmentId: neighbor.segmentId,
            direction: neighbor.direction,
            gCost: tentativeG,
            hCost,
            fCost: tentativeG + hCost,
            parent: current,
          };

          gCosts.set(neighborKey, tentativeG);
          openSet.push(neighborNode);
        }
      }
    }

    return { found: false, path: [], totalDistance: 0, error: "No path found" };
  }

  /**
   * Get neighboring segments based on current direction
   */
  private getNeighbors(
    segment: Segment,
    direction: "forward" | "backward"
  ): Array<{ segmentId: string; direction: "forward" | "backward" }> {
    const neighbors: Array<{
      segmentId: string;
      direction: "forward" | "backward";
    }> = [];

    // Get connected segments based on direction
    const connectedIds =
      direction === "forward"
        ? segment.connectedSegments.forward
        : segment.connectedSegments.backward;

    for (const neighborId of connectedIds) {
      const neighborSegment = this.graph.segments.get(neighborId);
      if (!neighborSegment) continue;

      // Determine which direction we enter the neighbor segment
      // Based on which node connects them
      const exitNode = direction === "forward" ? segment.endNodeId : segment.startNodeId;

      if (neighborSegment.startNodeId === exitNode) {
        // We enter from the start node, so we travel forward
        neighbors.push({ segmentId: neighborId, direction: "forward" });
      } else if (neighborSegment.endNodeId === exitNode) {
        // We enter from the end node, so we travel backward
        // But only if the segment is bidirectional (not oneway)
        if (!neighborSegment.metadata.oneway) {
          neighbors.push({ segmentId: neighborId, direction: "backward" });
        }
      }
    }

    return neighbors;
  }

  /**
   * Calculate heuristic (straight-line distance to destination)
   */
  private heuristic(from: Segment, to: Segment): number {
    // Use midpoint of from segment to midpoint of to segment
    const fromMid: [number, number] = [
      (from.startCoord[0] + from.endCoord[0]) / 2,
      (from.startCoord[1] + from.endCoord[1]) / 2,
    ];
    const toMid: [number, number] = [
      (to.startCoord[0] + to.endCoord[0]) / 2,
      (to.startCoord[1] + to.endCoord[1]) / 2,
    ];

    return calculateDistance(fromMid[0], fromMid[1], toMid[0], toMid[1]);
  }

  /**
   * Reconstruct path from A* result
   */
  private reconstructPath(endNode: AStarNode): PathResult {
    const path: PathStep[] = [];
    let current: AStarNode | null = endNode;
    let totalDistance = 0;

    while (current !== null) {
      path.unshift({
        segmentId: current.segmentId,
        direction: current.direction,
      });

      const segment = this.graph.segments.get(current.segmentId);
      if (segment) {
        totalDistance += segment.length;
      }

      current = current.parent;
    }

    return { found: true, path, totalDistance };
  }

  /**
   * Get a random segment ID
   */
  getRandomSegment(): string {
    const index = Math.floor(Math.random() * this.segmentIds.length);
    return this.segmentIds[index];
  }

  /**
   * Get a random segment that can be traveled forward (has exits)
   */
  getRandomNavigableSegment(): string {
    // Try up to 100 times to find a segment with forward connections
    for (let i = 0; i < 100; i++) {
      const segmentId = this.getRandomSegment();
      const segment = this.graph.segments.get(segmentId);
      if (segment && segment.connectedSegments.forward.length > 0) {
        return segmentId;
      }
    }
    // Fallback to any segment
    return this.getRandomSegment();
  }
}
