import type { RoadMetadata } from "./RoadTypes";

/**
 * Represents an OSM way (road, path, etc.)
 */
export interface OSMWay {
  id: string;
  nodeRefs: string[]; // Ordered list of node IDs forming the way
  tags: Map<string, string>; // All OSM tags
  metadata: RoadMetadata; // Parsed/derived metadata
}
