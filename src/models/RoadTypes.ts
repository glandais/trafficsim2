/**
 * Highway types supported for traffic simulation
 */
export enum HighwayType {
  MOTORWAY = 'motorway',
  MOTORWAY_LINK = 'motorway_link',
  TRUNK = 'trunk',
  TRUNK_LINK = 'trunk_link',
  PRIMARY = 'primary',
  PRIMARY_LINK = 'primary_link',
  SECONDARY = 'secondary',
  SECONDARY_LINK = 'secondary_link',
  TERTIARY = 'tertiary',
  TERTIARY_LINK = 'tertiary_link',
  RESIDENTIAL = 'residential',
  UNCLASSIFIED = 'unclassified',
  SERVICE = 'service',
  LIVING_STREET = 'living_street',
  ROAD = 'road'
}

/**
 * Set of highway types that vehicles can drive on
 */
export const DRIVEABLE_HIGHWAYS = new Set<string>([
  HighwayType.MOTORWAY,
  HighwayType.MOTORWAY_LINK,
  HighwayType.TRUNK,
  HighwayType.TRUNK_LINK,
  HighwayType.PRIMARY,
  HighwayType.PRIMARY_LINK,
  HighwayType.SECONDARY,
  HighwayType.SECONDARY_LINK,
  HighwayType.TERTIARY,
  HighwayType.TERTIARY_LINK,
  HighwayType.RESIDENTIAL,
  HighwayType.UNCLASSIFIED,
  HighwayType.SERVICE,
  HighwayType.LIVING_STREET,
  HighwayType.ROAD
]);

/**
 * Metadata extracted from OSM way tags
 */
export interface RoadMetadata {
  name?: string;
  highway: string;
  lanes?: number;
  maxspeed?: number;        // km/h
  width: number;            // meters (derived or explicit)
  oneway: boolean;
  surface?: string;
  junction?: 'roundabout' | 'circular';
  bridge?: boolean;
  tunnel?: boolean;
}
