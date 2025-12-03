import L from 'leaflet';
import type { DrivenVehicle, GeoPosition } from '../models';

/**
 * Rendered vehicle tracking
 */
interface RenderedVehicle {
  marker: L.Marker;
  previousPosition: GeoPosition;
  targetPosition: GeoPosition;
  interpolationStart: number;
}

/**
 * Vehicle rendering on Leaflet map
 */
export class VehicleView {
  private map: L.Map;
  private vehicleGroup: L.LayerGroup;
  private renderedVehicles: Map<string, RenderedVehicle> = new Map();
  private interpolationDuration: number = 16; // ms between physics ticks

  constructor(map: L.Map) {
    this.map = map;
    this.vehicleGroup = L.layerGroup().addTo(this.map);

    // Update vehicle icons on zoom
    this.map.on('zoomend', () => this.updateAllIcons());
  }

  /**
   * Update all vehicle positions
   */
  updateVehicles(vehicles: DrivenVehicle[]): void {
    const now = performance.now();
    const activeIds = new Set<string>();

    for (const drivenVehicle of vehicles) {
      const { vehicle } = drivenVehicle;
      activeIds.add(vehicle.id);

      const existing = this.renderedVehicles.get(vehicle.id);

      if (existing) {
        this.updateVehiclePosition(existing, vehicle.state.geoPosition, now);
      } else {
        this.createVehicleMarker(drivenVehicle);
      }
    }

    // Remove vehicles no longer in simulation
    for (const [id, rendered] of this.renderedVehicles) {
      if (!activeIds.has(id)) {
        this.vehicleGroup.removeLayer(rendered.marker);
        this.renderedVehicles.delete(id);
      }
    }

    // Interpolate positions for smooth animation
    this.interpolatePositions(now);
  }

  /**
   * Create marker for new vehicle
   */
  private createVehicleMarker(drivenVehicle: DrivenVehicle): void {
    const { vehicle } = drivenVehicle;
    const pos = vehicle.state.geoPosition;

    const icon = this.createVehicleIcon(pos.bearing);

    const marker = L.marker([pos.lat, pos.lon], {
      icon,
      interactive: false // Don't capture clicks
    });

    marker.addTo(this.vehicleGroup);

    this.renderedVehicles.set(vehicle.id, {
      marker,
      previousPosition: { ...pos },
      targetPosition: { ...pos },
      interpolationStart: performance.now()
    });
  }

  /**
   * Create vehicle icon (rotated rectangle)
   */
  private createVehicleIcon(bearing: number): L.DivIcon {
    const zoom = this.map.getZoom();
    // Scale vehicle size based on zoom (similar to roads)
    const scale = Math.pow(2, zoom - 14) * 0.4;
    const length = Math.max(10, 4.5 * scale); // 4.5m car length
    const width = Math.max(6, 1.8 * scale);   // 1.8m car width

    return L.divIcon({
      className: 'vehicle-marker',
      html: `<div class="vehicle-body" style="
        width: ${length}px;
        height: ${width}px;
        transform: rotate(${bearing - 90}deg);
      "></div>`,
      iconSize: [length, width],
      iconAnchor: [length / 2, width / 2]
    });
  }

  /**
   * Update vehicle position with interpolation setup
   */
  private updateVehiclePosition(
    rendered: RenderedVehicle,
    newPosition: GeoPosition,
    timestamp: number
  ): void {
    // Store current interpolated position as previous
    rendered.previousPosition = { ...rendered.targetPosition };
    rendered.targetPosition = { ...newPosition };
    rendered.interpolationStart = timestamp;
  }

  /**
   * Interpolate all vehicle positions for smooth animation
   */
  private interpolatePositions(now: number): void {
    for (const rendered of this.renderedVehicles.values()) {
      const elapsed = now - rendered.interpolationStart;
      const t = Math.min(1, elapsed / this.interpolationDuration);
      const eased = this.easeOutQuad(t);

      // Interpolate lat/lon
      const lat = rendered.previousPosition.lat +
        (rendered.targetPosition.lat - rendered.previousPosition.lat) * eased;
      const lon = rendered.previousPosition.lon +
        (rendered.targetPosition.lon - rendered.previousPosition.lon) * eased;

      // Interpolate bearing with wrap-around
      const bearing = this.interpolateBearing(
        rendered.previousPosition.bearing,
        rendered.targetPosition.bearing,
        eased
      );

      // Update marker position
      rendered.marker.setLatLng([lat, lon]);

      // Update icon rotation
      const icon = this.createVehicleIcon(bearing);
      rendered.marker.setIcon(icon);
    }
  }

  /**
   * Update all vehicle icons (called on zoom change)
   */
  private updateAllIcons(): void {
    for (const rendered of this.renderedVehicles.values()) {
      const icon = this.createVehicleIcon(rendered.targetPosition.bearing);
      rendered.marker.setIcon(icon);
    }
  }

  /**
   * Ease out quadratic
   */
  private easeOutQuad(t: number): number {
    return t * (2 - t);
  }

  /**
   * Interpolate bearing handling 360/0 wrap-around
   */
  private interpolateBearing(from: number, to: number, t: number): number {
    let diff = to - from;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return (from + diff * t + 360) % 360;
  }

  /**
   * Clear all vehicles
   */
  clear(): void {
    this.vehicleGroup.clearLayers();
    this.renderedVehicles.clear();
  }

  /**
   * Get vehicle count
   */
  getVehicleCount(): number {
    return this.renderedVehicles.size;
  }

  /**
   * Focus camera on a vehicle
   */
  focusOnVehicle(vehicleId: string): void {
    const rendered = this.renderedVehicles.get(vehicleId);
    if (rendered) {
      this.map.panTo(rendered.marker.getLatLng());
    }
  }
}
