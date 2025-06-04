import { LayerTitles } from "../../../types/openlayers-types";

export const openLayersZIndexes = new Map<LayerTitles, number>();

openLayersZIndexes.set(LayerTitles.BOT_LAYER, 3);
openLayersZIndexes.set(LayerTitles.HUB_LAYER, 2);
openLayersZIndexes.set(LayerTitles.MISSION_LAYER, 1);
