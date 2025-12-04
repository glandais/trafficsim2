import type { RoadGraph } from "../models";

/**
 * Builds a connectivity graph from parsed OSM data
 */
export class GraphBuilder {
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
