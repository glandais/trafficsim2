import type { OSMNode, OSMWay, RoadMetadata } from '../models';
import { DRIVEABLE_HIGHWAYS } from '../models';
import { deriveRoadWidth } from '../utils';

/**
 * Parser result containing nodes and ways
 */
export interface ParseResult {
  nodes: Map<string, OSMNode>;
  ways: Map<string, OSMWay>;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

/**
 * Parses OSM XML data into typed structures
 */
export class OSMParser {
  private nodes: Map<string, OSMNode> = new Map();
  private ways: Map<string, OSMWay> = new Map();
  private bounds = {
    minLat: Infinity,
    maxLat: -Infinity,
    minLon: Infinity,
    maxLon: -Infinity
  };

  /**
   * Parse OSM XML string into structured data
   */
  parse(osmXml: string): ParseResult {
    const parser = new DOMParser();
    const doc = parser.parseFromString(osmXml, 'application/xml');

    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error(`XML parsing error: ${parseError.textContent}`);
    }

    // Parse bounds first
    this.parseBounds(doc);

    // Pass 1: Parse all nodes
    this.parseNodes(doc);

    // Pass 2: Parse ways (filter for driveable roads)
    this.parseWays(doc);

    return {
      nodes: this.nodes,
      ways: this.ways,
      bounds: this.bounds
    };
  }

  /**
   * Parse the bounds element if present
   */
  private parseBounds(doc: Document): void {
    const boundsEl = doc.querySelector('bounds');
    if (boundsEl) {
      this.bounds = {
        minLat: parseFloat(boundsEl.getAttribute('minlat') || '0'),
        maxLat: parseFloat(boundsEl.getAttribute('maxlat') || '0'),
        minLon: parseFloat(boundsEl.getAttribute('minlon') || '0'),
        maxLon: parseFloat(boundsEl.getAttribute('maxlon') || '0')
      };
    }
  }

  /**
   * Parse all node elements
   */
  private parseNodes(doc: Document): void {
    const nodeElements = doc.querySelectorAll('node');

    for (const nodeEl of nodeElements) {
      const id = nodeEl.getAttribute('id');
      const lat = nodeEl.getAttribute('lat');
      const lon = nodeEl.getAttribute('lon');

      if (!id || !lat || !lon) continue;

      const node: OSMNode = {
        id,
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        tags: this.parseTags(nodeEl)
      };

      this.nodes.set(node.id, node);

      // Update bounds if not set from bounds element
      if (this.bounds.minLat === Infinity) {
        this.bounds.minLat = Math.min(this.bounds.minLat, node.lat);
        this.bounds.maxLat = Math.max(this.bounds.maxLat, node.lat);
        this.bounds.minLon = Math.min(this.bounds.minLon, node.lon);
        this.bounds.maxLon = Math.max(this.bounds.maxLon, node.lon);
      }
    }
  }

  /**
   * Parse way elements, filtering for driveable roads
   */
  private parseWays(doc: Document): void {
    const wayElements = doc.querySelectorAll('way');

    for (const wayEl of wayElements) {
      const id = wayEl.getAttribute('id');
      if (!id) continue;

      const tags = this.parseTags(wayEl);
      const highway = tags.get('highway');

      // Filter: only include driveable roads
      if (!highway || !DRIVEABLE_HIGHWAYS.has(highway)) {
        continue;
      }

      // Get node references
      const nodeRefs = Array.from(wayEl.querySelectorAll('nd'))
        .map(nd => nd.getAttribute('ref'))
        .filter((ref): ref is string => ref !== null && this.nodes.has(ref));

      // Need at least 2 nodes to form a road segment
      if (nodeRefs.length < 2) continue;

      const way: OSMWay = {
        id,
        nodeRefs,
        tags,
        metadata: this.deriveMetadata(tags)
      };

      this.ways.set(way.id, way);
    }
  }

  /**
   * Parse tag elements from a node or way
   */
  private parseTags(element: Element): Map<string, string> {
    const tags = new Map<string, string>();

    for (const tag of element.querySelectorAll('tag')) {
      const k = tag.getAttribute('k');
      const v = tag.getAttribute('v');
      if (k && v) {
        tags.set(k, v);
      }
    }

    return tags;
  }

  /**
   * Derive road metadata from OSM tags
   */
  private deriveMetadata(tags: Map<string, string>): RoadMetadata {
    const highway = tags.get('highway') || 'road';
    const lanesStr = tags.get('lanes');
    const lanes = lanesStr ? parseInt(lanesStr, 10) : undefined;

    return {
      name: tags.get('name'),
      highway,
      lanes,
      maxspeed: this.parseMaxspeed(tags.get('maxspeed')),
      width: deriveRoadWidth(tags.get('width'), lanes, highway),
      oneway: this.isOneway(tags),
      surface: tags.get('surface'),
      junction: tags.get('junction') as 'roundabout' | 'circular' | undefined,
      bridge: tags.get('bridge') === 'yes',
      tunnel: tags.get('tunnel') === 'yes'
    };
  }

  /**
   * Parse maxspeed tag, handling various formats
   */
  private parseMaxspeed(value: string | undefined): number | undefined {
    if (!value) return undefined;

    // Handle numeric values: "70", "50"
    const match = value.match(/^(\d+)/);
    if (match) {
      let speed = parseInt(match[1], 10);

      // Convert mph to km/h if needed
      if (value.toLowerCase().includes('mph')) {
        speed = Math.round(speed * 1.60934);
      }

      return speed;
    }

    // Handle special values
    const specialSpeeds: Record<string, number> = {
      'walk': 5,
      'FR:walk': 5,
      'FR:urban': 50,
      'FR:rural': 80
    };

    return specialSpeeds[value];
  }

  /**
   * Determine if a way is oneway
   */
  private isOneway(tags: Map<string, string>): boolean {
    const oneway = tags.get('oneway');
    const junction = tags.get('junction');
    const highway = tags.get('highway');

    // Explicit oneway tag
    if (oneway === 'yes' || oneway === '1' || oneway === 'true') {
      return true;
    }

    // Roundabouts are always oneway
    if (junction === 'roundabout' || junction === 'circular') {
      return true;
    }

    // Motorway links are typically oneway
    if (highway === 'motorway' || highway === 'motorway_link') {
      return oneway !== 'no';
    }

    return false;
  }
}
