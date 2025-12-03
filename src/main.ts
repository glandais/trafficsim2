import "leaflet/dist/leaflet.css";
import { OSMParser, GraphBuilder } from "./services";
import { MapView, InfoPanel, VehicleView, SimulationPanel } from "./views";
import { MapController, SimulationController } from "./controllers";

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  const loadingEl = document.getElementById("loading");

  try {
    // Initialize views
    const mapView = new MapView("map");
    const infoPanel = new InfoPanel("info-panel");

    // Initialize controller
    const controller = new MapController(mapView, infoPanel);

    // Update loading message
    if (loadingEl) {
      loadingEl.textContent = "Loading OSM data...";
    }

    // Fetch OSM data
    const response = await fetch("/map.osm");
    if (!response.ok) {
      throw new Error(`Failed to load OSM file: ${response.statusText}`);
    }
    const osmXml = await response.text();

    // Update loading message
    if (loadingEl) {
      loadingEl.textContent = "Parsing OSM data...";
    }

    // Parse OSM data
    const parser = new OSMParser();
    const parseResult = parser.parse(osmXml);

    console.log(`Parsed ${parseResult.nodes.size} nodes and ${parseResult.ways.size} ways`);

    // Update loading message
    if (loadingEl) {
      loadingEl.textContent = "Building road graph...";
    }

    // Build road graph
    const graphBuilder = new GraphBuilder();
    const graph = graphBuilder.build(parseResult.nodes, parseResult.ways, parseResult.bounds);

    // Log statistics
    const stats = GraphBuilder.getStats(graph);
    console.log("Road Graph Statistics:");
    console.log(`  Nodes: ${stats.nodeCount}`);
    console.log(`  Ways: ${stats.wayCount}`);
    console.log(`  Segments: ${stats.segmentCount}`);
    console.log(`  Intersections: ${stats.intersectionCount}`);
    console.log(`  Total Road Length: ${(stats.totalRoadLength / 1000).toFixed(2)} km`);

    // Load graph into controller
    controller.loadGraph(graph);

    // Initialize simulation components
    const vehicleView = new VehicleView(mapView.getMap());
    const simulationPanel = new SimulationPanel("simulation-panel");
    const simController = new SimulationController(graph, vehicleView, simulationPanel);

    // Hide loading indicator
    if (loadingEl) {
      loadingEl.classList.add("hidden");
    }

    console.log("Traffic Simulator initialized successfully");

    // Expose to global scope for debugging
    (
      window as unknown as {
        trafficSimGraph: typeof graph;
        simController: typeof simController;
      }
    ).trafficSimGraph = graph;
    (
      window as unknown as {
        trafficSimGraph: typeof graph;
        simController: typeof simController;
      }
    ).simController = simController;
  } catch (error) {
    console.error("Failed to initialize Traffic Simulator:", error);

    if (loadingEl) {
      loadingEl.textContent = `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
      loadingEl.style.color = "#d32f2f";
    }
  }
}

// Start the application
main();
