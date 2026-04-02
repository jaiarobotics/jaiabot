import { Feature } from "ol";
import { Polygon } from "ol/geom";
import { Draw } from "ol/interaction";
import { DrawEvent } from "ol/interaction/Draw";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import Text from "ol/style/Text";
import { fromLonLat, toLonLat } from "ol/proj";

import JaiaVectorLayer from "./jaia-vector-layer";
import { layersZIndexes } from "../zindex";
import { LayerTitles } from "../../../types/openlayers-types";
import { JaiaActions } from "../../../context/jaia-actions";
import { ExclusionZone } from "../../../types/protobuf-types";

const ZONE_FILL = "rgba(220, 0, 0, 0.15)";
const ZONE_STROKE = "rgba(220, 0, 0, 0.85)";
const DRAW_STROKE = "rgba(220, 0, 0, 0.6)";

class ExclusionZoneLayer extends JaiaVectorLayer {
    private draw: Draw | null = null;
    private dispatch: ((action: { type: JaiaActions; [key: string]: unknown }) => void) | null =
        null;
    private zones: ExclusionZone[] = [];

    constructor() {
        super(
            LayerTitles.EXCLUSION_ZONE_LAYER,
            layersZIndexes.get(LayerTitles.EXCLUSION_ZONE_LAYER),
        );
        this.getVectorLayer().setStyle(this.getZoneStyle.bind(this));
    }

    /**
     * Registers the React dispatch function so the draw interaction can dispatch actions
     *
     * @param {Function} dispatch The jaiaDispatch function from context
     * @returns {void}
     */
    setDispatch(dispatch: (action: { type: JaiaActions; [key: string]: unknown }) => void) {
        this.dispatch = dispatch;
    }

    getDraw() {
        return this.draw;
    }

    /**
     * Updates the displayed zones and redraws the layer
     *
     * @param {Map<number, ExclusionZone>} zones Updated zone map from the data model
     * @returns {void}
     */
    setZones(zones: Map<number, ExclusionZone>) {
        this.zones = Array.from(zones.values());
        this.updateFeatures();
    }

    /**
     * Creates a polygon Draw interaction. When the operator finishes drawing,
     * dispatches ADD_EXCLUSION_ZONE with the polygon vertices in lat/lon.
     *
     * @returns {Draw} The Draw interaction to add to the map
     */
    createDrawInteraction() {
        this.draw = new Draw({
            source: this.getVectorLayer().getSource(),
            type: "Polygon",
            style: new Style({
                fill: new Fill({ color: "rgba(220, 0, 0, 0.08)" }),
                stroke: new Stroke({ color: DRAW_STROKE, width: 2, lineDash: [6, 4] }),
            }),
        });

        this.draw.on("drawend", (event: DrawEvent) => {
            const feature = event.feature as Feature<Polygon>;
            const coords3857 = feature.getGeometry().getCoordinates()[0];
            // OpenLayers closes the ring by repeating the first vertex — skip it
            const vertices = coords3857.slice(0, -1).map((coord) => {
                const lonLat = toLonLat(coord);
                return { lat: lonLat[1], lon: lonLat[0] };
            });

            if (this.dispatch && vertices.length >= 3) {
                this.dispatch({
                    type: JaiaActions.ADD_EXCLUSION_ZONE,
                    exclusionZone: { vertices },
                });
            }
        });

        return this.draw;
    }

    /**
     * Removes the Draw interaction reference (the map is responsible for removing it from the map)
     *
     * @returns {void}
     */
    clearDrawInteraction() {
        this.draw = null;
    }

    /**
     * Redraws all exclusion zone polygons from the stored zone list
     *
     * @returns {void}
     */
    override updateFeatures() {
        this.getVectorLayer().getSource().clear();

        this.zones.forEach((zone, i) => {
            if (!zone.vertices || zone.vertices.length < 3) return;

            const coords3857 = zone.vertices.map((v) => fromLonLat([v.lon, v.lat]));
            coords3857.push(coords3857[0]); // close ring

            const polygon = new Polygon([coords3857]);
            const feature = new Feature({ geometry: polygon });
            feature.set("zoneIndex", i);
            feature.set("label", zone.label ?? `Zone ${i + 1}`);
            this.getVectorLayer().getSource().addFeature(feature);
        });
    }

    private getZoneStyle(feature: Feature): Style {
        return new Style({
            fill: new Fill({ color: ZONE_FILL }),
            stroke: new Stroke({ color: ZONE_STROKE, width: 2 }),
            text: new Text({
                text: feature.get("label") as string,
                fill: new Fill({ color: ZONE_STROKE }),
                stroke: new Stroke({ color: "white", width: 3 }),
                font: "bold 13px sans-serif",
            }),
        });
    }
}

export const exclusionZoneLayer = new ExclusionZoneLayer();
