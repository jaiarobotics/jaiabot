import { MapFeatureTypes } from "../../types/openlayers-types";

export const openLayersZIndexes = new Map<MapFeatureTypes, number>();

// Keeps waypoints above midpoint arrows when zoom changes
openLayersZIndexes.set(MapFeatureTypes.WAYPOINT, 1);

// Bot icon z-indexes follow the formula 10 + Bot ID
// Selected Bot z-index follows the formula 10 + number of Bots + 1
openLayersZIndexes.set(MapFeatureTypes.BOT, 10);
