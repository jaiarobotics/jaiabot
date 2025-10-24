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
import { LayerTitles } from "../../../../types/openlayers-types";
import { layersZIndexes } from "../../zindex";
import { generateSurveyLane, generateSurveyPoint } from "../../../features/survey/survey-lanes";
import { generateSurveyEndpoint } from "../../../features/survey/survey-endpoints";
import { GeographicCoordinate } from "../../../../types/protobuf-types";
import { Coordinate } from "ol/coordinate";

const units: Units = "meters";
const options = { units: units };

class GridLayer extends JaiaVectorLayer {
    private draw: Draw;
    private dragPan: DragPan;
    private drawSource: VectorSource;
    private layerSource: VectorSource;
    private centerLine: TurfFeature<TurfLineString>;
    private startLocation4326: Coordinate;

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
            const feature = event.feature as Feature<LineString>;

            if (!touches.getFingers().includes(2)) {
                const startLocation3857 = feature.getGeometry().getFirstCoordinate();
                this.startLocation4326 = toLonLat([startLocation3857[0], startLocation3857[1]]);
            }

            event.feature.getGeometry().on("change", (event: BaseEvent) => {
                if (touches.getFingers().includes(2)) {
                    return;
                }

                // No start location results from drawstarts that included two fingers
                if (!this.startLocation4326) {
                    const startLocation3857 = feature.getGeometry().getLastCoordinate();
                    this.startLocation4326 = toLonLat([startLocation3857[0], startLocation3857[1]]);
                }

                const currentLocation3857 = feature.getGeometry().getLastCoordinate();
                const currentLocation4326 = toLonLat([
                    currentLocation3857[0],
                    currentLocation3857[1],
                ]);
                this.centerLine = turf.lineString([this.startLocation4326, currentLocation4326]);
                this.createGrid();
            });
        });

        this.draw.on("drawend", (event: DrawEvent) => {
            this.drawSource.clear();
            this.startLocation4326 = undefined;
        });

        return this.draw;
    }

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

    createGrid(saveLanes?: boolean) {
        if (!this.centerLine) {
            return;
        }

        const lanes = [];

        this.layerSource.clear();

        let distFromCenter = 0;
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

    createGridEndPoints() {
        this.layerSource.addFeature(generateSurveyEndpoint(gridPlan.getMissionStart(), true));
        this.layerSource.addFeature(generateSurveyEndpoint(gridPlan.getMissionEnd(), false));
    }

    finalizeGrid(modifyDataModel?: boolean) {
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

    reset() {
        this.getVectorLayer().getSource().clear();
        this.centerLine = undefined;
        this.startLocation4326 = undefined;
    }
}

export const gridLayer = new GridLayer();
