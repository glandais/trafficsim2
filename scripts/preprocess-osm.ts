/**
 * Preprocessor script to convert OSM XML to CBOR RoadGraph
 * Uses SAX streaming parser for memory efficiency with large files
 * Uses CBOR for native Map serialization
 *
 * Usage: npx tsx scripts/preprocess-osm.ts [input.osm] [output.cbor]
 * Default: osm/map.osm -> public/graph.cbor
 */

import { createReadStream, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import sax from "sax";
import { encode } from "cbor-x";
import type { RoadGraph, OSMNode, OSMWay, Segment, RoadMetadata } from "../src/models";
import { DRIVEABLE_HIGHWAYS } from "../src/models";

// Constants
const DEFAULT_WIDTHS: Record<string, number> = {
  motorway: 14.0,
  motorway_link: 7.0,
  trunk: 10.5,
  trunk_link: 5.0,
  primary: 7.0,
  primary_link: 4.0,
  secondary: 7.0,
  secondary_link: 4.0,
  tertiary: 6.0,
  tertiary_link: 3.5,
  residential: 5.5,
  unclassified: 5.0,
  service: 4.0,
  living_street: 4.5,
  road: 5.0,
};

const LANE_WIDTH = 3.5;
const EARTH_RADIUS = 6371000;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS * c;
}

function deriveRoadWidth(
  explicitWidth: string | undefined,
  lanes: number | undefined,
  highwayType: string
): number {
  if (explicitWidth) {
    const match = explicitWidth.match(/^([\d.]+)/);
    if (match) return parseFloat(match[1]);
  }
  if (lanes && lanes > 0) {
    return lanes * LANE_WIDTH;
  }
  return DEFAULT_WIDTHS[highwayType] ?? 5.0;
}

function parseMaxspeed(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/^(\d+)/);
  if (match) {
    let speed = parseInt(match[1], 10);
    if (value.toLowerCase().includes("mph")) {
      speed = Math.round(speed * 1.60934);
    }
    return speed;
  }
  const specialSpeeds: Record<string, number> = {
    walk: 5,
    "FR:walk": 5,
    "FR:urban": 50,
    "FR:rural": 80,
  };
  return specialSpeeds[value];
}

function isOneway(tags: Map<string, string>): boolean {
  const oneway = tags.get("oneway");
  const junction = tags.get("junction");
  const highway = tags.get("highway");

  if (oneway === "yes" || oneway === "1" || oneway === "true") {
    return true;
  }
  if (junction === "roundabout" || junction === "circular") {
    return true;
  }
  if (highway === "motorway" || highway === "motorway_link") {
    return oneway !== "no";
  }
  return false;
}

function deriveMetadata(tags: Map<string, string>): RoadMetadata {
  const highway = tags.get("highway") || "road";
  const lanesStr = tags.get("lanes");
  const lanes = lanesStr ? parseInt(lanesStr, 10) : undefined;

  return {
    name: tags.get("name"),
    highway,
    lanes,
    maxspeed: parseMaxspeed(tags.get("maxspeed")),
    width: deriveRoadWidth(tags.get("width"), lanes, highway),
    oneway: isOneway(tags),
    surface: tags.get("surface"),
    junction: tags.get("junction") as "roundabout" | "circular" | undefined,
    bridge: tags.get("bridge") === "yes",
    tunnel: tags.get("tunnel") === "yes",
  };
}

function canEnterSegment(fromNodeId: string, segment: Segment): boolean {
  if (segment.metadata.oneway) {
    return segment.startNodeId === fromNodeId;
  }
  return segment.startNodeId === fromNodeId || segment.endNodeId === fromNodeId;
}

interface ParseState {
  nodes: Map<string, OSMNode>;
  ways: Map<string, OSMWay>;
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  currentElement: "node" | "way" | null;
  currentId: string | null;
  currentLat: number;
  currentLon: number;
  currentTags: Map<string, string>;
  currentNodeRefs: string[];
}

async function parseOSM(inputPath: string): Promise<{
  nodes: Map<string, OSMNode>;
  ways: Map<string, OSMWay>;
  bounds: ParseState["bounds"];
}> {
  return new Promise((resolve, reject) => {
    const state: ParseState = {
      nodes: new Map(),
      ways: new Map(),
      bounds: { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 },
      currentElement: null,
      currentId: null,
      currentLat: 0,
      currentLon: 0,
      currentTags: new Map(),
      currentNodeRefs: [],
    };

    const parser = sax.createStream(true, { trim: true });

    parser.on("opentag", (node) => {
      const name = node.name.toLowerCase();
      const attrs = node.attributes as Record<string, string>;

      if (name === "bounds") {
        state.bounds = {
          minLat: parseFloat(attrs.minlat || "0"),
          maxLat: parseFloat(attrs.maxlat || "0"),
          minLon: parseFloat(attrs.minlon || "0"),
          maxLon: parseFloat(attrs.maxlon || "0"),
        };
      } else if (name === "node") {
        state.currentElement = "node";
        state.currentId = attrs.id;
        state.currentLat = parseFloat(attrs.lat || "0");
        state.currentLon = parseFloat(attrs.lon || "0");
        state.currentTags = new Map();
      } else if (name === "way") {
        state.currentElement = "way";
        state.currentId = attrs.id;
        state.currentTags = new Map();
        state.currentNodeRefs = [];
      } else if (name === "tag" && state.currentElement) {
        const k = attrs.k;
        const v = attrs.v;
        if (k && v) {
          state.currentTags.set(k, v);
        }
      } else if (name === "nd" && state.currentElement === "way") {
        const ref = attrs.ref;
        if (ref) {
          state.currentNodeRefs.push(ref);
        }
      }
    });

    parser.on("closetag", (name) => {
      const tagName = name.toLowerCase();

      if (tagName === "node" && state.currentId) {
        state.nodes.set(state.currentId, {
          id: state.currentId,
          lat: state.currentLat,
          lon: state.currentLon,
          tags: state.currentTags,
        });
        state.currentElement = null;
        state.currentId = null;
      } else if (tagName === "way" && state.currentId) {
        const highway = state.currentTags.get("highway");
        if (highway && DRIVEABLE_HIGHWAYS.has(highway)) {
          // Filter nodeRefs to only include existing nodes
          const validNodeRefs = state.currentNodeRefs.filter((ref) => state.nodes.has(ref));
          if (validNodeRefs.length >= 2) {
            state.ways.set(state.currentId, {
              id: state.currentId,
              nodeRefs: validNodeRefs,
              tags: state.currentTags,
              metadata: deriveMetadata(state.currentTags),
            });
          }
        }
        state.currentElement = null;
        state.currentId = null;
      }
    });

    parser.on("error", (err) => {
      reject(err);
    });

    parser.on("end", () => {
      console.log(`Parsed ${state.nodes.size} nodes, ${state.ways.size} driveable ways`);
      resolve({ nodes: state.nodes, ways: state.ways, bounds: state.bounds });
    });

    createReadStream(inputPath).pipe(parser);
  });
}

function buildGraph(
  nodes: Map<string, OSMNode>,
  ways: Map<string, OSMWay>,
  bounds: ParseState["bounds"]
): RoadGraph {
  const segments = new Map<string, Segment>();
  const nodeToSegments = new Map<string, string[]>();

  // Build segments
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
        length: calculateDistance(startNode.lat, startNode.lon, endNode.lat, endNode.lon),
        metadata: way.metadata,
        connectedSegments: { forward: [], backward: [] },
      };

      segments.set(segmentId, segment);

      // Build adjacency
      const startAdj = nodeToSegments.get(startNodeId) || [];
      startAdj.push(segmentId);
      nodeToSegments.set(startNodeId, startAdj);

      const endAdj = nodeToSegments.get(endNodeId) || [];
      endAdj.push(segmentId);
      nodeToSegments.set(endNodeId, endAdj);
    }
  }

  console.log(`Built ${segments.size} segments`);

  // Build connectivity
  for (const segment of segments.values()) {
    // Forward connections
    const forwardCandidates = nodeToSegments.get(segment.endNodeId) || [];
    for (const candidateId of forwardCandidates) {
      if (candidateId === segment.id) continue;
      const candidate = segments.get(candidateId);
      if (!candidate) continue;
      if (canEnterSegment(segment.endNodeId, candidate)) {
        segment.connectedSegments.forward.push(candidateId);
      }
    }

    // Backward connections (only if not oneway)
    if (!segment.metadata.oneway) {
      const backwardCandidates = nodeToSegments.get(segment.startNodeId) || [];
      for (const candidateId of backwardCandidates) {
        if (candidateId === segment.id) continue;
        const candidate = segments.get(candidateId);
        if (!candidate) continue;
        if (canEnterSegment(segment.startNodeId, candidate)) {
          segment.connectedSegments.backward.push(candidateId);
        }
      }
    }
  }

  // Build intersections
  const intersections = new Map<string, string[]>();
  for (const [nodeId, segmentIds] of nodeToSegments) {
    if (segmentIds.length >= 2) {
      intersections.set(nodeId, segmentIds);
    }
  }

  console.log(`Found ${intersections.size} intersections`);

  return {
    nodes,
    ways,
    segments,
    nodeToSegments,
    intersections,
    bounds,
  };
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const inputPath = args[0] || "osm/map.osm";
  const outputPath = args[1] || "public/graph.cbor";

  console.log(`Processing: ${inputPath} -> ${outputPath}`);

  const { nodes, ways, bounds } = await parseOSM(inputPath);
  const graph = buildGraph(nodes, ways, bounds);

  // CBOR natively supports Maps!
  const cborData = encode(graph);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, cborData);

  const sizeMB = (cborData.length / (1024 * 1024)).toFixed(2);
  console.log(`Output size: ${sizeMB} MB`);
  console.log("Done!");
}

main().catch(console.error);
