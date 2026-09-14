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
import { getZoneBufferVertices } from "../../../data/exclusion_zones/exclusion-zone-router";
import { jaiaGlobal } from "../../../data/jaia_global/jaia-global";
import { exclusionZoneSet } from "../../../data/exclusion_zones/exclusion-zone-set";
import { OpenLayersColors } from "../../../style/openlayers/colors";
import { GeographicCoordinate } from "../../../shared/JAIAProtobuf";

const ZONE_FILL = "rgba(220, 0, 0, 0.15)";
const ZONE_STROKE = "rgba(220, 0, 0, 0.85)";
const ZONE_EDIT_FILL = "rgba(255, 215, 0, 0.18)";
const ZONE_EDIT_STROKE = "rgba(255, 215, 0, 0.9)";
const DRAW_STROKE = "rgba(220, 0, 0, 0.6)";
const BUFFER_STROKE = "rgba(255, 140, 0, 0.7)";
const BUFFER_FILL = "rgba(255, 140, 0, 0.06)";

class ExclusionZoneLayer extends JaiaVectorLayer {
    private draw: Draw | null = null;
    private isDrawing: boolean = false;

    isDrawActive() {
        return this.isDrawing;
    }

    setDrawActive(active: boolean) {
        this.isDrawing = active;
    }

    constructor() {
        super(
            LayerTitles.EXCLUSION_ZONE_LAYER,
            layersZIndexes.get(LayerTitles.EXCLUSION_ZONE_LAYER),
        );
        this.getVectorLayer().setStyle(this.getZoneStyle.bind(this));
    }

    /**
     * Returns the current Draw interaction instance, if one exists
     *
     * @returns {Draw | null} The active Draw interaction, or null if none is set
     */
    getDraw() {
        return this.draw;
    }

    /**
     * Creates and stores a polygon Draw interaction configured with the zone drawing style.
     * The drawend event must be wired by the caller (Map.tsx) so dispatch stays inside
     * the React boundary and is never stored on this singleton.
     *
     * @returns {Draw} The configured Draw interaction
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
        return this.draw;
    }

    /**
     * Captures the vertices of a drawn polygon
     *
     * @param {DrawEvent} event Holds the coordinates of the drawn polygon
     * @returns {GeographicCoordinate[]} The vertices of the drawn polygon
     */
    configureDrawEnd(event: DrawEvent) {
        const feature = event.feature as Feature<Polygon>;
        const geometry = feature.getGeometry();
        if (!geometry) return;
        const coords3857 = geometry.getCoordinates()[0];
        if (!coords3857) return;

        // OpenLayers closes the ring by repeating the first vertex — skip it.
        // Also deduplicate consecutive identical vertices (double-click to finish
        // registers the last vertex twice, causing false non-convex detection).
        const allVertices: GeographicCoordinate[] = coords3857.slice(0, -1).map((coord) => {
            const lonLat = toLonLat(coord);
            return { lat: lonLat[1], lon: lonLat[0] };
        });
        const vertices = allVertices.filter((v, i) => {
            if (i === 0) return true;
            const prev = allVertices[i - 1];
            return Math.abs(v.lat - prev.lat) > 1e-10 || Math.abs(v.lon - prev.lon) > 1e-10;
        });
        return vertices;
    }

    /**
     * Redraws all exclusion zone polygons and their editable vertex handles
     *
     * @returns {void}
     */
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

            // Draw the zone polygon.
            const coords3857 = zone.vertices.map((v) => fromLonLat([v.lon, v.lat]));
            coords3857.push(coords3857[0]); // close ring

            const polygon = new Polygon([coords3857]);
            const feature = new Feature({ geometry: polygon });
            feature.set("zoneID", zoneID);
            feature.set("label", zone.label ?? `Zone ${zoneNum}`);
            this.getVectorLayer().getSource().addFeature(feature);

            // Draw vertex handles for editing.
            const editVertices = zone.vertices;
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

    /**
     * Returns the style for a zone vertex handle based on its selection and moveable state
     *
     * @param {boolean} selected Whether this vertex is currently selected
     * @param {boolean} moveable Whether this vertex is in tap-to-move mode
     * @returns {Style} The OpenLayers style for the vertex
     */
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

    /**
     * Returns the OpenLayers style for a zone feature based on its state
     *
     * @param {Feature} feature The zone feature to style
     * @returns {Style} The computed style for the feature
     */
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
