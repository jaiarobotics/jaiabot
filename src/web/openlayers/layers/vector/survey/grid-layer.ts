import * as turf from "@turf/turf";
import { Units } from "@turf/helpers";
import { Position, Feature as TurfFeature, LineString as TurfLineString } from "geojson";

import BaseEvent from "ol/events/Event";
import VectorSource from "ol/source/Vector";
import { DragPan, Draw } from "ol/interaction";
import { DrawEvent } from "ol/interaction/Draw";
import { Feature } from "ol";
import { LineString } from "ol/geom";
import { toLonLat } from "ol/proj";
import { Stroke, Style } from "ol/style";

import JaiaVectorLayer from "../jaia-vector-layer";
import Mission from "../../../../data/mission_set/mission";
import { touches } from "../../../controls/touches";
import { gridPlan } from "../../../../data/survey_planner/grid-plan";
import { LayerTitles, SurveyEndpoints } from "../../../../types/openlayers-types";
import { layersZIndexes } from "../../zindex";
import { generateSurveyLane, generateSurveyPoint } from "../../../features/survey/survey-lanes";
import { generateSurveyEndpoint } from "../../../features/survey/survey-endpoints";
import { GeographicCoordinate } from "../../../../types/protobuf-types";

const units: Units = "meters";
const options = { units: units };

class GridLayer extends JaiaVectorLayer {
    private draw: Draw;
    private dragPan: DragPan;
    private drawSource: VectorSource;
    private layerSource: VectorSource;
    private centerLine: TurfFeature<TurfLineString>;

    constructor() {
        super(LayerTitles.GRID_LAYER, layersZIndexes.get(LayerTitles.GRID_LAYER));
        this.drawSource = new VectorSource();
        this.layerSource = this.getVectorLayer().getSource();
    }

    override updateFeatures() {}

    getDraw() {
        return this.draw;
    }

    getDragPan() {
        return this.dragPan;
    }

    getCenterLine() {
        return this.centerLine;
    }

    /**
     * Configures the draw interaction for dragging a survey grid on the map
     *
     * @returns {Draw} The custom draw interaction
     */
    createDrawInteraction() {
        this.draw = new Draw({
            source: this.drawSource,
            type: "LineString",
            freehand: true,
            style: new Style({
                stroke: new Stroke({
                    color: "rgba(0,0,0,0)",
                    width: 0,
                }),
            }),
        });

        this.draw.on("drawstart", (event: DrawEvent) => {
            if (touches.getIsPanning()) {
                return;
            }

            const feature = event.feature as Feature<LineString>;
            const startLocation3857 = feature.getGeometry().getFirstCoordinate();
            const startLocation4326 = toLonLat([startLocation3857[0], startLocation3857[1]]);

            event.feature.getGeometry().on("change", (event: BaseEvent) => {
                if (touches.getIsPanning()) {
                    return;
                }

                const currentLocation3857 = feature.getGeometry().getLastCoordinate();
                const currentLocation4326 = toLonLat([
                    currentLocation3857[0],
                    currentLocation3857[1],
                ]);
                this.centerLine = turf.lineString([startLocation4326, currentLocation4326]);
                this.createGrid();
            });
        });

        this.draw.on("drawend", (event: DrawEvent) => {
            this.drawSource.clear();
        });

        return this.draw;
    }

    /**
     * We need a custom dragpan interaction to stop the drag event
     * from propagating to the draw interaction
     *
     * @returns {DragPan} The custom dragpan interaction
     */
    createDragPanInteraction() {
        this.dragPan = new DragPan({
            condition: (evt) => {
                if (evt.activePointers.length === 2 || evt.originalEvent.ctrlKey) {
                    evt.stopPropagation();
                    return true;
                }
                return false;
            },
        });
        return this.dragPan;
    }

    /**
     * Utilizes the data from the drag to produce a grid of lanes and points based
     * on the size parameters set by the operator
     *
     * @param {boolean} saveLanes Whether or not to store the lanes in an array
     * @returns {TurfFeature<TurfLineString>[]} The lanes of the grid
     */
    createGrid(saveLanes: boolean = false) {
        if (!this.centerLine) {
            return;
        }

        const lanes = [];

        this.layerSource.clear();

        let distFromCenter = 0;
        // For grids with even number of lanes, the first two lanes will
        // be one half of the lane spacing distance from the center line
        if (gridPlan.getNumOfLanes() % 2 === 0) {
            distFromCenter = gridPlan.getLaneSpacing() / 2;
        }

        for (let i = 0; i < gridPlan.getNumOfLanes(); i++) {
            const offsetLine = turf.lineOffset(this.centerLine, distFromCenter, options);
            const coordinates = offsetLine.geometry.coordinates;
            const startLocation = { lat: coordinates[0][1], lon: coordinates[0][0] };
            const endLocation = { lat: coordinates[1][1], lon: coordinates[1][0] };
            const laneFeature = generateSurveyLane(startLocation, endLocation);
            this.layerSource.addFeature(laneFeature);
            this.createGridPoints(offsetLine, i + 1);

            // For grids with even number of lanes, increase distance every two lanes
            // from the start
            if (gridPlan.getNumOfLanes() % 2 === 0 && i % 2 === 1) {
                distFromCenter = Math.abs(distFromCenter) + gridPlan.getLaneSpacing();
            }

            // For grids with odd number of lanes, increase distance every two lanes
            // after creation of the middle lane
            if (gridPlan.getNumOfLanes() % 2 !== 0 && i % 2 === 0) {
                distFromCenter = Math.abs(distFromCenter) + gridPlan.getLaneSpacing();
            }

            distFromCenter *= -1;

            if (saveLanes) {
                lanes.push(offsetLine);
            }
        }

        this.createGridEndPoints();
        return lanes;
    }

    /**
     * Generates the waypoints along the survey lanes
     *
     * @param {TurfFeature<LineString>} lane Which lane to add the points along
     * @param {number} laneNum Used to assign a z-index to the points
     * @returns {Position[][]} Array of points
     */
    createGridPoints(lane: TurfFeature<TurfLineString>, laneNum: number) {
        const points: Position[] = [];
        const lineDist = turf.length(lane, options);
        let pointNum = 1;
        for (let dist = 0; dist < lineDist; dist += gridPlan.getPointSpacing()) {
            const coordinates = turf.along(lane, dist, options).geometry.coordinates;
            const waypointFeature = generateSurveyPoint(
                {
                    lat: coordinates[1],
                    lon: coordinates[0],
                },
                pointNum,
                laneNum,
            );
            this.layerSource.addFeature(waypointFeature);
            points.push(coordinates);
            pointNum++;
        }
        return points;
    }

    /**
     * Adds the start and end survey points to the map
     *
     * @returns {void}
     */
    createGridEndPoints() {
        this.layerSource.addFeature(
            generateSurveyEndpoint(gridPlan.getMissionStart(), SurveyEndpoints.START),
        );
        this.layerSource.addFeature(
            generateSurveyEndpoint(gridPlan.getMissionEnd(), SurveyEndpoints.END),
        );
    }

    /**
     * Trims the lanes to the final waypoint and (optionally) saves the lanes into
     * missions to be processed by the rest of the app
     *
     * @param {boolean} modifyDataModel Stores the missions in the data model
     * @returns {void}
     *
     * @notes
     * finalizeGrid(true) only needs to be called once. Multiple calls will
     * result in duplicate missions.
     */
    finalizeGrid(modifyDataModel: boolean = false) {
        const lanes = this.createGrid(true);
        this.layerSource.clear();
        this.createGridEndPoints();

        for (let i = 0; i < lanes.length; i++) {
            const points = this.createGridPoints(lanes[i], i + 1);
            const startPoint = points[0];
            const endPoint = points[points.length - 1];
            const laneStart: GeographicCoordinate = { lat: startPoint[1], lon: startPoint[0] };
            const laneEnd: GeographicCoordinate = { lat: endPoint[1], lon: endPoint[0] };
            const surveyLane = generateSurveyLane(laneStart, laneEnd);
            this.layerSource.addFeature(surveyLane);

            if (modifyDataModel) {
                const mission = new Mission();
                mission.setMissionID(i + 1);
                mission.addWaypoint(gridPlan.getMissionStart());
                for (const point of points) {
                    mission.addWaypoint({ lat: point[1], lon: point[0] });
                }
                mission.addWaypoint(gridPlan.getMissionEnd());
                gridPlan.getMissions().set(mission.getMissionID(), mission);
            }
        }
    }

    /**
     * Clears the layer and the drag line to prepare for a new drag
     *
     * @returns {void}
     */
    reset() {
        this.getVectorLayer().getSource().clear();
        this.centerLine = undefined;
    }
}

export const gridLayer = new GridLayer();
