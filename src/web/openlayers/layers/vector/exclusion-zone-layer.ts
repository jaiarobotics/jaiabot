import { Feature } from "ol";
import { Point, Polygon } from "ol/geom";
import { Draw } from "ol/interaction";
import { DrawEvent } from "ol/interaction/Draw";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import CircleStyle from "ol/style/Circle";
import Text from "ol/style/Text";
import { fromLonLat, toLonLat } from "ol/proj";

import JaiaVectorLayer from "./jaia-vector-layer";
import { layersZIndexes } from "../zindex";
import { LayerTitles, MapFeatureTypes } from "../../../types/openlayers-types";
import { JaiaActions } from "../../../context/jaia-actions";
import { toConvexHull, getZoneBufferVertices } from "../../../utils/exclusion-zone-router";
import { jaiaGlobal } from "../../../data/jaia_global/jaia-global";
import { exclusionZoneSet } from "../../../data/exclusion_zones/exclusion-zone-set";
import { OpenLayersColors } from "../../../style/openlayers/colors";

const ZONE_FILL = "rgba(220, 0, 0, 0.15)";
const ZONE_STROKE = "rgba(220, 0, 0, 0.85)";
const ZONE_EDIT_FILL = "rgba(255, 215, 0, 0.18)";
const ZONE_EDIT_STROKE = "rgba(255, 215, 0, 0.9)";
const DRAW_STROKE = "rgba(220, 0, 0, 0.6)";
const BUFFER_STROKE = "rgba(255, 140, 0, 0.7)";
const BUFFER_FILL = "rgba(255, 140, 0, 0.06)";

class ExclusionZoneLayer extends JaiaVectorLayer {
    private draw: Draw | null = null;
    private dispatch: ((action: { type: JaiaActions; [key: string]: unknown }) => void) | null =
        null;

    constructor() {
        super(
            LayerTitles.EXCLUSION_ZONE_LAYER,
            layersZIndexes.get(LayerTitles.EXCLUSION_ZONE_LAYER),
        );
        this.getVectorLayer().setStyle(this.getZoneStyle.bind(this));
    }

    /** Wires up the React dispatch so the draw interaction can fire actions. */
    setDispatch(dispatch: (action: { type: JaiaActions; [key: string]: unknown }) => void) {
        this.dispatch = dispatch;
    }

    getDraw() {
        return this.draw;
    }

    /**
     * Creates a polygon Draw interaction. When the operator finishes drawing,
     * dispatches ADD_EXCLUSION_ZONE with the polygon vertices in lat/lon.
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

            // OpenLayers closes the ring by repeating the first vertex — skip it.
            // Also deduplicate consecutive identical vertices (double-click to finish
            // registers the last vertex twice, causing false non-convex detection).
            const allVertices = coords3857.slice(0, -1).map((coord) => {
                const lonLat = toLonLat(coord);
                return { lat: lonLat[1], lon: lonLat[0] };
            });
            const vertices = allVertices.filter((v, i) => {
                if (i === 0) return true;
                const prev = allVertices[i - 1];
                return Math.abs(v.lat - prev.lat) > 1e-10 || Math.abs(v.lon - prev.lon) > 1e-10;
            });

            if (!this.dispatch || vertices.length < 3) return;

            const { vertices: hullVertices } = toConvexHull({ vertices });

            this.dispatch({
                type: JaiaActions.ADD_EXCLUSION_ZONE,
                exclusionZone: { vertices: hullVertices, drawnVertices: vertices },
            });
        });

        return this.draw;
    }

    /** Clears the stored Draw interaction reference. */
    clearDrawInteraction() {
        this.draw = null;
    }

    /** Redraws all exclusion zone polygons and their editable vertex handles. */
    override updateFeatures() {
        this.getVectorLayer().getSource().clear();

        let zoneNum = 0;
        const selected = jaiaGlobal.getSelectedZoneVertex();

        exclusionZoneSet.getZones().forEach((zone, zoneID) => {
            if (!zone.vertices || zone.vertices.length < 3) return;
            zoneNum++;

            // Draw the safety buffer ring first (underneath the zone).
            const bufferVerts = getZoneBufferVertices(zone);
            if (bufferVerts.length >= 3) {
                const bufferCoords = bufferVerts.map((v) => fromLonLat([v.lon, v.lat]));
                bufferCoords.push(bufferCoords[0]);
                const bufferFeature = new Feature({ geometry: new Polygon([bufferCoords]) });
                bufferFeature.set("isBuffer", true);
                this.getVectorLayer().getSource().addFeature(bufferFeature);
            }

            // Draw the convex hull polygon (solid — used for routing and avoidance).
            const coords3857 = zone.vertices.map((v) => fromLonLat([v.lon, v.lat]));
            coords3857.push(coords3857[0]); // close ring

            const polygon = new Polygon([coords3857]);
            const feature = new Feature({ geometry: polygon });
            feature.set("zoneID", zoneID);
            feature.set("label", zone.label ?? `Zone ${zoneNum}`);
            this.getVectorLayer().getSource().addFeature(feature);

            // Draw the original user-drawn polygon (dashed — for reference and editing).
            if (zone.drawnVertices && zone.drawnVertices.length >= 3) {
                const drawnCoords = zone.drawnVertices.map((v) => fromLonLat([v.lon, v.lat]));
                drawnCoords.push(drawnCoords[0]);
                const drawnFeature = new Feature({ geometry: new Polygon([drawnCoords]) });
                drawnFeature.set("isDrawnPolygon", true);
                drawnFeature.set("zoneID", zoneID);
                this.getVectorLayer().getSource().addFeature(drawnFeature);
            }

            // Draw vertex handles on drawnVertices so the operator edits the drawn shape.
            const editVertices = zone.drawnVertices ?? zone.vertices;
            editVertices.forEach((v, i) => {
                const coord = fromLonLat([v.lon, v.lat]);
                const vertexFeature = new Feature({ geometry: new Point(coord) });
                vertexFeature.set("type", MapFeatureTypes.ZONE_VERTEX);
                vertexFeature.set("zoneID", zoneID);
                vertexFeature.set("vertexIndex", i);
                const isSelected = selected?.zoneID === zoneID && selected?.vertexIndex === i;
                const isMoveable = isSelected && selected?.isMoveable;
                vertexFeature.setStyle(this.getVertexStyle(isSelected, isMoveable));
                this.getVectorLayer().getSource().addFeature(vertexFeature);
            });
        });
    }

    private getVertexStyle(selected: boolean, moveable = false): Style {
        const fillColor = moveable
            ? OpenLayersColors.SELECT
            : selected
              ? OpenLayersColors.EDIT
              : OpenLayersColors.DEFAULT;
        return new Style({
            image: new CircleStyle({
                radius: selected ? 7 : 5,
                fill: new Fill({ color: fillColor }),
                stroke: new Stroke({ color: ZONE_STROKE, width: 2 }),
            }),
            zIndex: selected ? 10 : 5,
        });
    }

    private getZoneStyle(feature: Feature): Style {
        if (feature.get("isBuffer")) {
            return new Style({
                fill: new Fill({ color: BUFFER_FILL }),
                stroke: new Stroke({ color: BUFFER_STROKE, width: 1.5, lineDash: [5, 5] }),
            });
        }

        if (feature.get("isDrawnPolygon")) {
            const zoneID = feature.get("zoneID") as number;
            const isEditing = zoneID === jaiaGlobal.getZoneInEditMode();
            const strokeColor = isEditing ? ZONE_EDIT_STROKE : ZONE_STROKE;
            return new Style({
                fill: new Fill({ color: "transparent" }),
                stroke: new Stroke({ color: strokeColor, width: 1.5, lineDash: [4, 4] }),
            });
        }

        const zoneID = feature.get("zoneID") as number;
        const isEditing = zoneID === jaiaGlobal.getZoneInEditMode();
        const fillColor = isEditing ? ZONE_EDIT_FILL : ZONE_FILL;
        const strokeColor = isEditing ? ZONE_EDIT_STROKE : ZONE_STROKE;

        return new Style({
            fill: new Fill({ color: fillColor }),
            stroke: new Stroke({ color: strokeColor, width: 2 }),
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
