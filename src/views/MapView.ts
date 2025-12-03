import L from "leaflet";
import type { RoadGraph, Segment, RoadMetadata } from "../models";
import { ROAD_COLORS, DEFAULT_ROAD_COLOR } from "../utils";

/**
 * Manages the Leaflet map and road rendering
 */
export class MapView {
  private map: L.Map;
  private roadLayers: Map<string, L.Polyline> = new Map();
  private roadGroup: L.LayerGroup;
  private selectedSegment: L.Polyline | null = null;
  private clickCallback: ((segmentId: string, metadata: RoadMetadata) => void) | null = null;

  constructor(containerId: string) {
    // Initialize map with default view (will be adjusted after loading data)
    this.map = L.map(containerId, {
      zoomControl: true,
      attributionControl: true,
    }).setView([47.178, -1.606], 14);

    // Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(this.map);

    // Create layer group for roads
    this.roadGroup = L.layerGroup().addTo(this.map);

    // Update road widths on zoom change
    this.map.on("zoomend", () => this.updateRoadWidths());
  }

  /**
   * Render all road segments on the map
   */
  renderRoads(graph: RoadGraph): void {
    this.roadGroup.clearLayers();
    this.roadLayers.clear();

    // First pass: render outlines (dark borders)
    for (const [, segment] of graph.segments) {
      const outline = this.createRoadOutline(segment);
      this.roadGroup.addLayer(outline);
    }

    // Second pass: render roads on top of outlines
    for (const [segmentId, segment] of graph.segments) {
      const polyline = this.createRoadPolyline(segment);
      this.roadLayers.set(segmentId, polyline);
      this.roadGroup.addLayer(polyline);
    }
  }

  /**
   * Create an outline polyline for a road segment
   */
  private createRoadOutline(segment: Segment): L.Polyline {
    const coords: L.LatLngExpression[] = [
      [segment.startCoord[0], segment.startCoord[1]],
      [segment.endCoord[0], segment.endCoord[1]],
    ];

    const weight = this.getPixelWidth(segment.metadata.width) + 2;

    return L.polyline(coords, {
      color: "#333333",
      weight,
      opacity: 0.9,
      lineCap: "round",
      lineJoin: "round",
      interactive: false, // Outline doesn't receive clicks
    });
  }

  /**
   * Create a polyline for a road segment
   */
  private createRoadPolyline(segment: Segment): L.Polyline {
    const coords: L.LatLngExpression[] = [
      [segment.startCoord[0], segment.startCoord[1]],
      [segment.endCoord[0], segment.endCoord[1]],
    ];

    const color = this.getRoadColor(segment.metadata.highway);
    const weight = this.getPixelWidth(segment.metadata.width);

    const polyline = L.polyline(coords, {
      color,
      weight,
      opacity: 0.85,
      lineCap: "round",
      lineJoin: "round",
      interactive: true,
    });

    // Store segment data for interaction
    (polyline as L.Polyline & { segmentId: string; metadata: RoadMetadata }).segmentId = segment.id;
    (polyline as L.Polyline & { segmentId: string; metadata: RoadMetadata }).metadata =
      segment.metadata;
    (polyline as L.Polyline & { meterWidth: number }).meterWidth = segment.metadata.width;

    // Add direct click handler
    polyline.on("click", () => {
      console.log("Polyline clicked:", segment.id);
      if (this.clickCallback) {
        this.clickCallback(segment.id, segment.metadata);
      }
    });

    return polyline;
  }

  /**
   * Get color for a highway type
   */
  private getRoadColor(highway: string): string {
    return ROAD_COLORS[highway] ?? DEFAULT_ROAD_COLOR;
  }

  /**
   * Convert road width in meters to pixel width based on zoom level
   */
  private getPixelWidth(widthMeters: number): number {
    const zoom = this.map.getZoom();
    // At zoom 14, roughly 1 meter = 0.5 pixels
    // Scale factor doubles with each zoom level
    const scale = Math.pow(2, zoom - 14) * 0.5;
    const pixelWidth = widthMeters * scale;

    // Clamp to reasonable range
    return Math.max(2, Math.min(pixelWidth, 30));
  }

  /**
   * Update road widths when zoom level changes
   */
  private updateRoadWidths(): void {
    for (const polyline of this.roadLayers.values()) {
      const meterWidth = (polyline as L.Polyline & { meterWidth: number }).meterWidth;
      if (meterWidth) {
        polyline.setStyle({ weight: this.getPixelWidth(meterWidth) });
      }
    }
  }

  /**
   * Fit map bounds to show all roads
   */
  fitToBounds(graph: RoadGraph): void {
    const { bounds } = graph;

    if (bounds.minLat === Infinity) {
      // Calculate bounds from nodes
      let minLat = Infinity,
        maxLat = -Infinity;
      let minLon = Infinity,
        maxLon = -Infinity;

      for (const node of graph.nodes.values()) {
        minLat = Math.min(minLat, node.lat);
        maxLat = Math.max(maxLat, node.lat);
        minLon = Math.min(minLon, node.lon);
        maxLon = Math.max(maxLon, node.lon);
      }

      if (minLat !== Infinity) {
        this.map.fitBounds([
          [minLat, minLon],
          [maxLat, maxLon],
        ]);
      }
    } else {
      this.map.fitBounds([
        [bounds.minLat, bounds.minLon],
        [bounds.maxLat, bounds.maxLon],
      ]);
    }
  }

  /**
   * Set up click handler for roads
   */
  onRoadClick(callback: (segmentId: string, metadata: RoadMetadata) => void): void {
    this.clickCallback = callback;
  }

  /**
   * Highlight a segment on the map
   */
  highlightSegment(segmentId: string): void {
    // Clear previous selection
    if (this.selectedSegment) {
      const prevMetadata = (this.selectedSegment as L.Polyline & { metadata: RoadMetadata })
        .metadata;
      this.selectedSegment.setStyle({
        color: this.getRoadColor(prevMetadata.highway),
        opacity: 0.85,
      });
    }

    // Highlight new selection
    const polyline = this.roadLayers.get(segmentId);
    if (polyline) {
      polyline.setStyle({
        color: "#0066ff",
        opacity: 1,
      });
      polyline.bringToFront();
      this.selectedSegment = polyline;
    }
  }

  /**
   * Clear segment highlight
   */
  clearHighlight(): void {
    if (this.selectedSegment) {
      const metadata = (this.selectedSegment as L.Polyline & { metadata: RoadMetadata }).metadata;
      this.selectedSegment.setStyle({
        color: this.getRoadColor(metadata.highway),
        opacity: 0.85,
      });
      this.selectedSegment = null;
    }
  }

  /**
   * Get the Leaflet map instance
   */
  getMap(): L.Map {
    return this.map;
  }
}
