import { useEffect, useContext } from "react";
import { JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import { jaiaGlobal } from "../../data/jaia_global/jaia-global";

import { Feature, MapBrowserEvent } from "ol";
import { Coordinate } from "ol/coordinate";
import { Geometry } from "ol/geom";
import { toLonLat } from "ol/proj";

import { map } from "../../openlayers/maps/map";
import { view } from "../../openlayers/views/view";
import { gridLayer } from "../../openlayers/layers/vector/grid-layer";
import { styleControlButtons } from "../../openlayers/controls/controls";
import { generateSurveyEndpoint } from "../../openlayers/features/survey/survey-endpoints";

import { NodeTypes, TaskParameterKeys } from "../../types/jaia-system-types";
import { ButtonNames, ButtonTypes } from "../../types/context-types";
import { MapFeatureTypes, MapModes, SurveyEndpoints } from "../../types/openlayers-types";
import { UNASSIGNED_ID } from "../../utils/constants";
import { locationToConstantHeadingParams } from "../../utils/conversions";

import { missionsManager } from "../../data/missions_manager/missions-manager";
import { missionSet } from "../../data/mission_set/mission-set";
import { gridPlan, GridPlanningStates } from "../../data/survey_planner/grid-plan";

import "./Map.less";

export default function Map() {
    const jaiaDispatch = useContext(JaiaDispatchContext);

    useEffect(() => {
        map.setTarget("map");
        map.on("click", (event: MapBrowserEvent<PointerEvent>) => {
            handleMapClick(event);
        });
        styleControlButtons();
    }, []);

    /**
     * Distributes map clicks to appropriate handlers
     *
     * @param {MapBrowserEvent<PointerEvent>} event Contains data assoicated with map click
     * @returns {void}
     */
    const handleMapClick = (event: MapBrowserEvent<PointerEvent>) => {
        const mapMode = jaiaGlobal.getMapMode();
        switch (mapMode) {
            case MapModes.RALLY:
                handleAddRallyPoint(event.coordinate);
                return;
            case MapModes.MEASURE:
                // Measurement clicks handled by measure layer (src/web/openlayers/layers)
                return;
            case MapModes.SURVEY_PLANNING:
                handleSurveyPlanningClick(event.coordinate);
                return;
            case MapModes.SURVEY_CONSTANT_HEADING_SELECT:
                handleConstantHeadingSelectClick(event.coordinate, mapMode);
                return;
            case MapModes.CONSTANT_HEADING_SELECT:
                handleConstantHeadingSelectClick(event.coordinate, mapMode);
                return;
        }

        const feature = map.forEachFeatureAtPixel(event.pixel, (feature: Feature) => feature);
        if (feature && feature.get("type")) {
            switch (feature.get("type")) {
                case MapFeatureTypes.BOT:
                    handleNodeClick(feature);
                    return;
                case MapFeatureTypes.HUB:
                    handleNodeClick(feature);
                    return;
                case MapFeatureTypes.WAYPOINT:
                    handleWaypointClick(feature);
                    return;
                case MapFeatureTypes.RALLY_POINT:
                    handleRallyPointClick(feature);
                    return;
                case MapFeatureTypes.DIVE:
                    handleTaskPacketClick(feature, MapFeatureTypes.DIVE);
                    return;
                case MapFeatureTypes.DRIFT:
                    handleTaskPacketClick(feature, MapFeatureTypes.DRIFT);
                    return;
                case MapFeatureTypes.DEPTH_CONTOUR:
                    handleDepthContourClick();
                default:
                    return;
            }
        }

        if (jaiaGlobal.getSelectedWaypoint().isMoveable) {
            handleMoveWaypointClick(event.coordinate);
            return;
        }

        // Prevent generating false ADD_WAYPOINT actions
        if (
            (jaiaGlobal.getSelectedNode().type === NodeTypes.BOT &&
                missionsManager.getMissionID(jaiaGlobal.getSelectedNode().id) === UNASSIGNED_ID) ||
            missionSet.getMissionIDInEditMode() !== UNASSIGNED_ID
        ) {
            handleAddWaypointClick(event.coordinate);
        }
    };

    /**
     * Dispatches action to add a rally point to the map
     *
     * @param {Coordinate} coordinate Location of click on map
     * @returns {void}
     */
    const handleAddRallyPoint = (coordinate: Coordinate) => {
        const lonLat = toLonLat(coordinate, view.getProjection());
        jaiaDispatch({
            type: JaiaActions.ADD_RALLY_POINT,
            location: { lon: lonLat[0], lat: lonLat[1] },
        });
    };

    /**
     * Adds start and end survey locations to map
     *
     * @param {Coordinate} coordinate Location of click on map
     * @returns {void}
     */
    const handleSurveyPlanningClick = (coordinate: Coordinate) => {
        const lonLat = toLonLat(coordinate, view.getProjection());
        const location = { lon: lonLat[0], lat: lonLat[1] };
        let nextState = gridPlan.getState();

        switch (gridPlan.getState()) {
            case GridPlanningStates.ACCEPTING_MISSION_START_LOCATION:
                gridPlan.setMissionStart(location);
                gridLayer
                    .getVectorLayer()
                    .getSource()
                    .addFeature(generateSurveyEndpoint(location, SurveyEndpoints.START));
                nextState = GridPlanningStates.ACCEPTING_MISSION_END_LOCATION;
                break;
            case GridPlanningStates.ACCEPTING_MISSION_END_LOCATION:
                gridPlan.setMissionEnd(location);
                gridLayer
                    .getVectorLayer()
                    .getSource()
                    .addFeature(generateSurveyEndpoint(location, SurveyEndpoints.END));
                nextState = GridPlanningStates.ACCEPTING_GRID_DRAWING;
                break;
            case GridPlanningStates.ACCEPTING_GRID_DRAWING:
                return;
            case GridPlanningStates.ACCEPTING_TASK:
                return;
            case GridPlanningStates.ACCEPTING_START_TASK:
                return;
            case GridPlanningStates.ACCEPTING_END_TASK:
                return;
        }
        jaiaDispatch({
            type: JaiaActions.SURVEY_CHANGE_PLANNING_STATE,
            gridPlanningState: nextState,
        });
    };

    /**
     * Triggers the calls to update the constant heading projection
     * based on click location
     *
     * @param {Coordinate} coordinate Location of click on map
     * @param {MapModes} mapMode Impacts where to start constant heading line
     * @returns {void}
     */
    const handleConstantHeadingSelectClick = (coordinate: Coordinate, mapMode: MapModes) => {
        let startLocation;
        let task;

        if (mapMode === MapModes.SURVEY_CONSTANT_HEADING_SELECT) {
            if (gridPlan.getState() === GridPlanningStates.ACCEPTING_START_TASK) {
                startLocation = gridPlan.getMissionStart();
            } else {
                startLocation = gridLayer.getFinalPointCenterLine();
            }
            task = gridPlan.getPlanningTask();
        } else {
            const selectedWaypoint = jaiaGlobal.getSelectedWaypoint();
            const mission = missionSet.getMission(selectedWaypoint.missionID);
            const waypoint = mission.getWaypoint(selectedWaypoint.waypointNum);
            startLocation = waypoint.getLocation();
            task = waypoint.getTask();
        }

        const lonLat = toLonLat(coordinate, view.getProjection());
        const endLocation = { lon: lonLat[0], lat: lonLat[1] };

        const params = locationToConstantHeadingParams(startLocation, endLocation, task);

        const taskParameterPairs = [
            {
                key: TaskParameterKeys.HEADING,
                value: params.constant_heading,
            },
            {
                key: TaskParameterKeys.CONSTANT_HEADING_TIME,
                value: params.constant_heading_time,
            },
        ];

        jaiaDispatch({
            type: JaiaActions.CHANGE_TASK_PARAMETER,
            task: task,
            taskParameterPairs: taskParameterPairs,
        });
    };

    /**
     * Dispatches action to handle changes in node selection
     *
     * @param {Feature} feature Contains the node type and ID
     * @returns {void}
     */
    const handleNodeClick = (feature: Feature<Geometry>) => {
        const nodeType = feature.get("type");
        const nodeID = feature.get("id");

        if (nodeType === NodeTypes.BOT || nodeType == NodeTypes.HUB) {
            jaiaDispatch({
                type: JaiaActions.CLICKED_NODE,
                clickedNode: { type: nodeType, id: nodeID },
            });
        }
    };

    /**
     * Dispatches action to set the selected waypoint
     *
     * @param {Feature<Geometry>} feature Clicked waypoint
     * @returns {void}
     */
    const handleWaypointClick = (feature: Feature<Geometry>) => {
        const selectedWaypoint = jaiaGlobal.getSelectedWaypoint();
        if (
            feature.get("missionID") !== selectedWaypoint.missionID ||
            feature.get("waypointNum") !== selectedWaypoint.waypointNum
        ) {
            jaiaDispatch({
                type: JaiaActions.CLICKED_WAYPOINT,
                clickedWaypoint: {
                    waypointNum: feature.get("waypointNum"),
                    missionID: feature.get("missionID"),
                    isMoveable: false,
                },
            });
        }
    };

    /**
     * Dispatches action to open the rally panel
     *
     * @param {Feature<Geometry>} feature Clicked rally point
     * @returns {void}
     */
    const handleRallyPointClick = (feature: Feature<Geometry>) => {
        jaiaDispatch({
            type: JaiaActions.CLICKED_RALLY_POINT,
            rallyID: feature.get("id"),
        });
    };

    /** Dispatches action to set the selected task packet
     *
     * @param {Feature<Geometry>} feature
     * @param {MapFeatureTypes} type
     * @returns {void}
     */
    const handleTaskPacketClick = (feature: Feature<Geometry>, type: MapFeatureTypes) => {
        jaiaDispatch({
            type: JaiaActions.CLICKED_TASK_PACKET,
            clickedTaskPacket: {
                botID: feature.get("botID"),
                startTime: feature.get("startTime"),
                type: type,
            },
        });
    };

    /**
     * Dispatches action to display the 3D depth map
     *
     * @returns {void}
     */
    const handleDepthContourClick = () => {
        jaiaDispatch({
            type: JaiaActions.CLICKED_BUTTON,
            buttonType: ButtonTypes.PANEL,
            buttonName: ButtonNames.DEPTH_MAP_3D,
        });
    };

    /**
     * Dispatches action to move the selected waypoint on the map
     *
     * @param {Coordinate} coordinate Location of click on map
     * @returns {void}
     *
     * @notes
     * We convert click coordinate to lat/lon. The click
     * coordinate is based on the map's projection.
     */
    const handleMoveWaypointClick = (coordinate: Coordinate) => {
        const lonLat = toLonLat(coordinate, view.getProjection());
        jaiaDispatch({
            type: JaiaActions.MOVE_WAYPOINT,
            location: { lon: lonLat[0], lat: lonLat[1] },
        });
    };

    /**
     * Dispatches action to add a waypoint to the map
     *
     * @param {Coordinate} coordinate Location of click on map
     * @returns {void}
     *
     * @notes
     * We convert click coordinate to lat/lon. The click
     * coordinate is based on the map's projection.
     */
    const handleAddWaypointClick = (coordinate: Coordinate) => {
        const lonLat = toLonLat(coordinate, view.getProjection());
        jaiaDispatch({
            type: JaiaActions.ADD_WAYPOINT,
            location: { lon: lonLat[0], lat: lonLat[1] },
        });
    };

    return <div id="map" data-testid="map"></div>;
}
