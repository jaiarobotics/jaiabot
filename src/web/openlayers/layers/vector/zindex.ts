import { LayerTitles } from "../../../types/openlayers-types";

export const layersZIndexes = new Map<LayerTitles, number>();

layersZIndexes.set(LayerTitles.BOT_LAYER, 4);
layersZIndexes.set(LayerTitles.HUB_LAYER, 3);
layersZIndexes.set(LayerTitles.RALLY_LAYER, 2);
layersZIndexes.set(LayerTitles.MISSION_LAYER, 1);
