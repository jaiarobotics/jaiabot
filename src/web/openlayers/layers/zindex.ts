import { LayerTitles } from "../../types/openlayers-types";

export const layersZIndexes = new Map<LayerTitles, number>();

layersZIndexes.set(LayerTitles.MEASURE_LAYER, 8);
layersZIndexes.set(LayerTitles.BOT_LAYER, 7);
layersZIndexes.set(LayerTitles.HUB_LAYER, 6);
layersZIndexes.set(LayerTitles.MISSION_LAYER, 5);
layersZIndexes.set(LayerTitles.RALLY_LAYER, 4);
layersZIndexes.set(LayerTitles.DIVE_LAYER, 3);
layersZIndexes.set(LayerTitles.DRIFT_LAYER, 3);
layersZIndexes.set(LayerTitles.CONTOUR_LAYER, 2);
layersZIndexes.set(LayerTitles.HUB_COMMS_LAYER, 1);
