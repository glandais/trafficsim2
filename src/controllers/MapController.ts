import type { RoadGraph, RoadMetadata } from '../models';
import { MapView } from '../views/MapView';
import { InfoPanel } from '../views/InfoPanel';

/**
 * Controller for map interactions
 */
export class MapController {
  private mapView: MapView;
  private infoPanel: InfoPanel;
  private graph: RoadGraph | null = null;
  private selectedSegmentId: string | null = null;
  private justClickedRoad: boolean = false;

  constructor(mapView: MapView, infoPanel: InfoPanel) {
    this.mapView = mapView;
    this.infoPanel = infoPanel;

    this.setupEventHandlers();
  }

  /**
   * Set up event handlers for user interactions
   */
  private setupEventHandlers(): void {
    // Road click handler
    this.mapView.onRoadClick((segmentId, metadata) => {
      this.justClickedRoad = true;
      this.selectSegment(segmentId, metadata);
    });

    // Info panel close handler
    this.infoPanel.onClose(() => {
      this.clearSelection();
    });

    // Click on map background to clear selection
    this.mapView.getMap().on('click', () => {
      // Skip if we just clicked on a road (flag set by road click handler)
      if (this.justClickedRoad) {
        this.justClickedRoad = false;
        return;
      }
      if (this.selectedSegmentId) {
        this.clearSelection();
      }
    });

    // Keyboard handler for escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.selectedSegmentId) {
        this.clearSelection();
      }
    });
  }

  /**
   * Load and display the road graph
   */
  loadGraph(graph: RoadGraph): void {
    this.graph = graph;
    this.infoPanel.setGraph(graph);
    this.mapView.renderRoads(graph);
    this.mapView.fitToBounds(graph);
  }

  /**
   * Select a segment and show its info
   */
  selectSegment(segmentId: string, metadata: RoadMetadata): void {
    this.selectedSegmentId = segmentId;
    this.mapView.highlightSegment(segmentId);
    this.infoPanel.showSegment(segmentId, metadata);
  }

  /**
   * Clear the current selection
   */
  clearSelection(): void {
    this.selectedSegmentId = null;
    this.mapView.clearHighlight();
    this.infoPanel.hide();
  }

  /**
   * Get the currently selected segment ID
   */
  getSelectedSegmentId(): string | null {
    return this.selectedSegmentId;
  }

  /**
   * Get the loaded graph
   */
  getGraph(): RoadGraph | null {
    return this.graph;
  }
}
