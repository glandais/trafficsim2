import type { OSMNode, OSMWay, Segment, RoadGraph } from "../models";
import { calculateNodeDistance } from "../utils";

/**
 * Builds a connectivity graph from parsed OSM data
 */
export class GraphBuilder {
  /**
   * Build the road graph from nodes and ways
   */
  build(
    nodes: Map<string, OSMNode>,
    ways: Map<string, OSMWay>,
    bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }
  ): RoadGraph {
    const segments = new Map<string, Segment>();
    const nodeToSegments = new Map<string, string[]>();

    // Step 1: Create segments from ways
    for (const [wayId, way] of ways) {
      for (let i = 0; i < way.nodeRefs.length - 1; i++) {
        const startNodeId = way.nodeRefs[i];
        const endNodeId = way.nodeRefs[i + 1];
        const startNode = nodes.get(startNodeId);
        const endNode = nodes.get(endNodeId);

        if (!startNode || !endNode) continue;

        const segmentId = `${wayId}-${i}`;

        const segment: Segment = {
          id: segmentId,
          wayId,
          startNodeId,
          endNodeId,
          startCoord: [startNode.lat, startNode.lon],
          endCoord: [endNode.lat, endNode.lon],
          length: calculateNodeDistance(startNode, endNode),
          metadata: way.metadata,
          connectedSegments: {
            forward: [],
            backward: [],
          },
        };

        segments.set(segmentId, segment);

        // Build node-to-segments adjacency
        this.addToAdjacency(nodeToSegments, startNodeId, segmentId);
        this.addToAdjacency(nodeToSegments, endNodeId, segmentId);
      }
    }

    // Step 2: Build segment connectivity
    for (const segment of segments.values()) {
      // Forward connections: segments reachable from endNodeId
      const forwardCandidates = nodeToSegments.get(segment.endNodeId) || [];
      for (const candidateId of forwardCandidates) {
        if (candidateId === segment.id) continue;

        const candidate = segments.get(candidateId);
        if (!candidate) continue;

        if (this.canEnterSegment(segment.endNodeId, candidate)) {
          segment.connectedSegments.forward.push(candidateId);
        }
      }

      // Backward connections: only if NOT oneway
      if (!segment.metadata.oneway) {
        const backwardCandidates = nodeToSegments.get(segment.startNodeId) || [];
        for (const candidateId of backwardCandidates) {
          if (candidateId === segment.id) continue;

          const candidate = segments.get(candidateId);
          if (!candidate) continue;

          if (this.canEnterSegment(segment.startNodeId, candidate)) {
            segment.connectedSegments.backward.push(candidateId);
          }
        }
      }
    }

    // Step 3: Identify intersections (nodes with 2+ segment connections)
    const intersections = new Map<string, string[]>();
    for (const [nodeId, segmentIds] of nodeToSegments) {
      if (segmentIds.length >= 2) {
        intersections.set(nodeId, segmentIds);
      }
    }

    return {
      nodes,
      ways,
      segments,
      nodeToSegments,
      intersections,
      bounds,
    };
  }

  /**
   * Add a segment ID to the adjacency list for a node
   */
  private addToAdjacency(map: Map<string, string[]>, nodeId: string, segmentId: string): void {
    const existing = map.get(nodeId);
    if (existing) {
      existing.push(segmentId);
    } else {
      map.set(nodeId, [segmentId]);
    }
  }

  /**
   * Check if we can enter a segment from a given node
   * For oneway roads, we can only enter from the start node
   */
  private canEnterSegment(fromNodeId: string, segment: Segment): boolean {
    if (segment.metadata.oneway) {
      // Oneway: can only enter from start
      return segment.startNodeId === fromNodeId;
    }
    // Bidirectional: can enter from either end
    return segment.startNodeId === fromNodeId || segment.endNodeId === fromNodeId;
  }

  /**
   * Get statistics about the graph
   */
  static getStats(graph: RoadGraph): {
    nodeCount: number;
    wayCount: number;
    segmentCount: number;
    intersectionCount: number;
    totalRoadLength: number;
  } {
    let totalRoadLength = 0;
    for (const segment of graph.segments.values()) {
      totalRoadLength += segment.length;
    }

    return {
      nodeCount: graph.nodes.size,
      wayCount: graph.ways.size,
      segmentCount: graph.segments.size,
      intersectionCount: graph.intersections.size,
      totalRoadLength: Math.round(totalRoadLength),
    };
  }
}
