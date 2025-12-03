/**
 * Default road widths by highway type (in meters)
 * Based on typical European/French road standards
 */
export const DEFAULT_WIDTHS: Record<string, number> = {
  // Major roads (typically 2+ lanes each direction)
  motorway: 14.0,        // 4 lanes @ 3.5m
  motorway_link: 7.0,    // 2 lanes
  trunk: 10.5,           // 3 lanes
  trunk_link: 5.0,       // 1-2 lanes
  primary: 7.0,          // 2 lanes
  primary_link: 4.0,     // 1 lane

  // Secondary roads
  secondary: 7.0,        // 2 lanes
  secondary_link: 4.0,
  tertiary: 6.0,         // 2 narrow lanes
  tertiary_link: 3.5,

  // Local roads
  residential: 5.5,      // Narrower urban streets
  unclassified: 5.0,
  service: 4.0,          // Driveways, parking lots
  living_street: 4.5,    // Shared space
  road: 5.0              // Unknown type fallback
};

/**
 * Standard lane width in meters
 */
export const LANE_WIDTH = 3.5;

/**
 * Colors for rendering roads by highway type
 */
export const ROAD_COLORS: Record<string, string> = {
  motorway: '#e892a2',
  motorway_link: '#e892a2',
  trunk: '#f9b29c',
  trunk_link: '#f9b29c',
  primary: '#fcd6a4',
  primary_link: '#fcd6a4',
  secondary: '#f7fabf',
  secondary_link: '#f7fabf',
  tertiary: '#ffffff',
  tertiary_link: '#ffffff',
  residential: '#ffffff',
  unclassified: '#ffffff',
  service: '#cccccc',
  living_street: '#ededed',
  road: '#dddddd'
};

/**
 * Default color for unknown road types
 */
export const DEFAULT_ROAD_COLOR = '#888888';

/**
 * Derive road width from available OSM tags
 * Priority: explicit width > lanes calculation > highway type default
 */
export function deriveRoadWidth(
  explicitWidth: string | undefined,
  lanes: number | undefined,
  highwayType: string
): number {
  // Priority 1: Explicit width tag
  if (explicitWidth) {
    const match = explicitWidth.match(/^([\d.]+)/);
    if (match) return parseFloat(match[1]);
  }

  // Priority 2: Calculate from lane count
  if (lanes && lanes > 0) {
    return lanes * LANE_WIDTH;
  }

  // Priority 3: Default by highway type
  return DEFAULT_WIDTHS[highwayType] ?? 5.0;
}
