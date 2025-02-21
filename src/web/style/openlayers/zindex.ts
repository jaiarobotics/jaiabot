import { MapFeatureTypes } from "../../types/openlayers-types";

export const openLayersZIndexes = new Map<MapFeatureTypes, number>();
openLayersZIndexes.set(MapFeatureTypes.WAYPOINT, 1); // Keeps waypoints above midpoint arrows when zoom changes
