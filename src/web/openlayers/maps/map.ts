// OpenLayers
import { Map } from "ol";

// Jaia
import { layers } from "../layers/layers";
import { controls } from "../controls/controls";
import { view } from "../views/view";

export const map = new Map({
    layers: Array.from(layers.getLayers().values()),
    controls: controls,
    view: view,
    maxTilesLoading: 64,
    moveTolerance: 20,
});
