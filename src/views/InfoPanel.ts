import type { RoadMetadata, RoadGraph } from '../models';

/**
 * Displays information about selected road segments
 */
export class InfoPanel {
  private container: HTMLElement;
  private graph: RoadGraph | null = null;

  constructor(containerId: string) {
    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`Element with id "${containerId}" not found`);
    }
    this.container = element;
  }

  /**
   * Set the road graph for looking up connectivity info
   */
  setGraph(graph: RoadGraph): void {
    this.graph = graph;
  }

  /**
   * Show segment information
   */
  showSegment(segmentId: string, metadata: RoadMetadata): void {
    const segment = this.graph?.segments.get(segmentId);

    const html = `
      <button class="close-btn" aria-label="Close">&times;</button>
      <h3>${metadata.name || 'Unnamed Road'}</h3>

      <div class="info-row">
        <span class="label">Type</span>
        <span class="value">${this.formatHighwayType(metadata.highway)}</span>
      </div>

      <div class="info-row">
        <span class="label">Width</span>
        <span class="value">${metadata.width.toFixed(1)} m</span>
      </div>

      ${metadata.lanes ? `
      <div class="info-row">
        <span class="label">Lanes</span>
        <span class="value">${metadata.lanes}</span>
      </div>
      ` : ''}

      ${metadata.maxspeed ? `
      <div class="info-row">
        <span class="label">Speed Limit</span>
        <span class="value">${metadata.maxspeed} km/h</span>
      </div>
      ` : ''}

      <div class="info-row">
        <span class="label">Direction</span>
        <span class="value">${metadata.oneway ? 'One-way' : 'Both ways'}</span>
      </div>

      ${metadata.surface ? `
      <div class="info-row">
        <span class="label">Surface</span>
        <span class="value">${this.formatSurface(metadata.surface)}</span>
      </div>
      ` : ''}

      ${metadata.bridge ? `
      <div class="info-row">
        <span class="label">Structure</span>
        <span class="value">Bridge</span>
      </div>
      ` : ''}

      ${metadata.tunnel ? `
      <div class="info-row">
        <span class="label">Structure</span>
        <span class="value">Tunnel</span>
      </div>
      ` : ''}

      ${segment ? `
      <div class="info-row">
        <span class="label">Length</span>
        <span class="value">${this.formatLength(segment.length)}</span>
      </div>

      <div class="info-row">
        <span class="label">Connections</span>
        <span class="value">${segment.connectedSegments.forward.length + segment.connectedSegments.backward.length}</span>
      </div>
      ` : ''}
    `;

    this.container.innerHTML = html;
    this.container.classList.add('visible');

    // Add close button handler
    const closeBtn = this.container.querySelector('.close-btn');
    closeBtn?.addEventListener('click', () => this.hide());
  }

  /**
   * Hide the info panel
   */
  hide(): void {
    this.container.classList.remove('visible');
  }

  /**
   * Check if panel is visible
   */
  isVisible(): boolean {
    return this.container.classList.contains('visible');
  }

  /**
   * Set close callback
   */
  onClose(callback: () => void): void {
    this.container.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('close-btn')) {
        callback();
      }
    });
  }

  /**
   * Format highway type for display
   */
  private formatHighwayType(highway: string): string {
    const formats: Record<string, string> = {
      motorway: 'Motorway',
      motorway_link: 'Motorway Link',
      trunk: 'Trunk Road',
      trunk_link: 'Trunk Link',
      primary: 'Primary Road',
      primary_link: 'Primary Link',
      secondary: 'Secondary Road',
      secondary_link: 'Secondary Link',
      tertiary: 'Tertiary Road',
      tertiary_link: 'Tertiary Link',
      residential: 'Residential',
      unclassified: 'Unclassified',
      service: 'Service Road',
      living_street: 'Living Street',
      road: 'Road'
    };

    return formats[highway] || highway;
  }

  /**
   * Format surface type for display
   */
  private formatSurface(surface: string): string {
    const formats: Record<string, string> = {
      asphalt: 'Asphalt',
      concrete: 'Concrete',
      paved: 'Paved',
      unpaved: 'Unpaved',
      gravel: 'Gravel',
      cobblestone: 'Cobblestone',
      paving_stones: 'Paving Stones'
    };

    return formats[surface] || surface;
  }

  /**
   * Format length for display
   */
  private formatLength(meters: number): string {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
  }
}
