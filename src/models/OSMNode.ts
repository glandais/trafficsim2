/**
 * Represents an OSM node (point with coordinates)
 */
export interface OSMNode {
  id: string;
  lat: number;
  lon: number;
  tags: Map<string, string>;
}
