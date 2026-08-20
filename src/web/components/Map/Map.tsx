import { useEffect, useContext, useState } from "react";
import { JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import { jaiaGlobal } from "../../data/jaia_global/jaia-global";

import { Feature, MapBrowserEvent } from "ol";
import { Coordinate } from "ol/coordinate";
import { Geometry, Polygon } from "ol/geom";
import { DrawEvent } from "ol/interaction/Draw";
import { toLonLat } from "ol/proj";

import { map } from "../../openlayers/maps/map";
import { view } from "../../openlayers/views/view";
import { gridLayer } from "../../openlayers/layers/vector/grid-layer";
import { exclusionZoneLayer } from "../../openlayers/layers/vector/exclusion-zone-layer";
import { styleControlButtons } from "../../openlayers/controls/controls";
import { generateSurveyEndpoint } from "../../openlayers/features/survey/survey-endpoints";

import { NodeTypes, TaskParameterKeys } from "../../types/jaia-system-types";
import { ButtonNames, ButtonTypes, JaiaAction } from "../../types/context-types";
import { MapFeatureTypes, MapModes, SurveyEndpoints } from "../../types/openlayers-types";
import { MAP_FEATURE_HIT_TOLERANCE, UNASSIGNED_ID } from "../../utils/constants";
import { locationToConstantHeadingParams } from "../../utils/conversions";

import { missionSet } from "../../data/mission_set/mission-set";
import { gridPlan, GridPlanningStates } from "../../data/survey_planner/grid-plan";
import { isLocationBlockedByZone } from "../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-router";

import PlacementErrorDialog from "../ObstacleAvoidanceDialogs/PlacementErrorDialog/PlacementErrorDialog";

import "./Map.less";

const PLACEMENT_ERROR_MESSAGE =
    "Cannot place a point inside an exclusion zone or its safety buffer.";

/**
 * Renders the OpenLayers map and routes map click events to the appropriate handlers
 *
 * @returns {JSX.Element} The map container, including any active dialogs
 */
export default function Map() {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [placementError, setPlacementError] = useState<string | null>(null);

    useEffect(() => {
        map.setTarget("map");
        map.on("click", (event: MapBrowserEvent<PointerEvent>) => {
            handleMapClick(event);
        });
        styleControlButtons();
        initExclusionZoneDraw();
    }, []);

    /**
     * Distributes map clicks to appropriate handlers
     *
     * @param {MapBrowserEvent<PointerEvent>} event Contains data associated with map click
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
            case MapModes.HUB_LOCATION_SELECT:
                handleHubLocationSelectClick(event.coordinate);
                return;
            case MapModes.EXCLUSION_ZONE_DRAWING:
                // When drawing is active, the OL Draw interaction handles pointer events directly
                return;
        }

        if (jaiaGlobal.getSelectedWaypoint().isMoveable) {
            handleMoveWaypointClick(event.coordinate);
            return;
        }

        // A zone vertex is awaiting relocation — the click destination is all we need, so skip
        // the feature lookup below that identifies what was clicked (bot, waypoint, zone, etc.).
        if (jaiaGlobal.getSelectedZoneVertex().isMoveable) {
            handleMoveZoneVertexClick(event.coordinate);
            return;
        }

        const featureClicked = map.forEachFeatureAtPixel(
            event.pixel,
            (feature: Feature) => handleMapFeatureClick(feature, event),
            { hitTolerance: MAP_FEATURE_HIT_TOLERANCE },
        );

        if (featureClicked) {
            return;
        }

        // Zone edit mode takes priority: any empty-map click adds a vertex.
        if (jaiaGlobal.getZoneInEditMode() !== UNASSIGNED_ID) {
            handleAddZoneVertexClick(event.coordinate);
            return;
        }

        // Prevent generating false ADD_WAYPOINT actions
        if (missionSet.getMissionIDInEditMode() !== UNASSIGNED_ID) {
            handleAddWaypointClick(event.coordinate);
        }
    };

    /**
     * Calls the appropriate handler for a feature clicked on the map
     *
     * @param {Feature} feature The OpenLayers Feature clicked
     * @param {MapBrowserEvet} event  Contains location data
     * @returns {boolean} True prevents subsequent calls for Features that exist below the clicked Feature
     */
    const handleMapFeatureClick = (feature: Feature, event: MapBrowserEvent<PointerEvent>) => {
        if (feature && feature.get("type")) {
            switch (feature.get("type")) {
                case MapFeatureTypes.BOT:
                    handleNodeClick(feature);
                    return true;
                case MapFeatureTypes.HUB:
                    handleNodeClick(feature);
                    return true;
                case MapFeatureTypes.WAYPOINT:
                    handleWaypointClick(feature);
                    return true;
                case MapFeatureTypes.RALLY_POINT:
                    handleRallyPointClick(feature);
                    return true;
                case MapFeatureTypes.ZONE_VERTEX:
                    handleZoneVertexClick(feature);
                    return true;
                case MapFeatureTypes.DIVE:
                    handleTaskPacketClick(feature, MapFeatureTypes.DIVE);
                    return true;
                case MapFeatureTypes.DRIFT:
                    handleTaskPacketClick(feature, MapFeatureTypes.DRIFT);
                    return true;
                case MapFeatureTypes.DEPTH_CONTOUR:
                    handleDepthContourClick(event);
                    return true;
                default:
                    return false;
            }
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
        const location = { lon: lonLat[0], lat: lonLat[1] };
        if (isLocationBlockedByZone(location)) {
            setPlacementError(PLACEMENT_ERROR_MESSAGE);
            return;
        }
        jaiaDispatch({ type: JaiaActions.ADD_RALLY_POINT, location });
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
                if (isLocationBlockedByZone(location)) {
                    setPlacementError(PLACEMENT_ERROR_MESSAGE);
                    return;
                }
                gridPlan.setMissionStart(location);
                gridLayer
                    .getVectorLayer()
                    .getSource()
                    .addFeature(generateSurveyEndpoint(location, SurveyEndpoints.START));
                nextState = GridPlanningStates.ACCEPTING_MISSION_END_LOCATION;
                break;
            case GridPlanningStates.ACCEPTING_MISSION_END_LOCATION:
                if (isLocationBlockedByZone(location)) {
                    setPlacementError(PLACEMENT_ERROR_MESSAGE);
                    return;
                }
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

        if (
            mapMode === MapModes.SURVEY_PLANNING ||
            mapMode === MapModes.SURVEY_CONSTANT_HEADING_SELECT
        ) {
            jaiaDispatch({
                type: JaiaActions.SURVEY_CHANGE_TASK_PARAMETER,
                task: task,
                taskParameterPairs: taskParameterPairs,
            });
        } else {
            jaiaDispatch({
                type: JaiaActions.CHANGE_TASK_PARAMETER,
                task: task,
                taskParameterPairs: taskParameterPairs,
            });
        }
    };

    /**
     * Dispatches action to update the Hub's position to the click location
     *
     * @param {Coordinate} coordinate Location of click on map
     * @returns {void}
     */
    const handleHubLocationSelectClick = (coordinate: Coordinate) => {
        const lonLat = toLonLat(coordinate, view.getProjection());
        jaiaDispatch({ type: JaiaActions.MOVE_HUB, location: { lon: lonLat[0], lat: lonLat[1] } });
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
        if (feature.get("isBypass")) return;
        jaiaDispatch({
            type: JaiaActions.CLICKED_WAYPOINT,
            clickedWaypoint: {
                waypointNum: feature.get("waypointNum"),
                missionID: feature.get("missionID"),
                isMoveable: false,
            },
        });
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

    /**
     * Dispatches action to set the selected task packet
     *
     * @param {Feature<Geometry>} feature Clicked task packet
     * @param {MapFeatureTypes} type Distinguishes between dives and drifts
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
     * Dispatches action to display the 3D depth map. If a mission is
     * in edit mode, a waypoint will be added instead.
     *
     * @param {MapBrowserEvent<PointerEvent>} event Contains click coordinate
     * @returns {void}
     */
    const handleDepthContourClick = (event: MapBrowserEvent<PointerEvent>) => {
        if (missionSet.getMissionIDInEditMode() !== UNASSIGNED_ID) {
            handleAddWaypointClick(event.coordinate);
        } else {
            jaiaDispatch({
                type: JaiaActions.CLICKED_BUTTON,
                buttonType: ButtonTypes.PANEL,
                buttonName: ButtonNames.DEPTH_MAP_3D,
            });
        }
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
     * Dispatches action to select a zone vertex for editing
     *
     * @param {Feature} feature Clicked zone vertex feature containing zoneID and vertexIndex
     * @returns {void}
     */
    const handleZoneVertexClick = (feature: Feature) => {
        jaiaDispatch({
            type: JaiaActions.SELECT_ZONE_VERTEX,
            zoneID: feature.get("zoneID") as number,
            vertexIndex: feature.get("vertexIndex") as number,
        });
    };

    /**
     * Dispatches action to move the selected zone vertex to the click location
     *
     * @param {Coordinate} coordinate Location of click on map
     * @returns {void}
     */
    const handleMoveZoneVertexClick = (coordinate: Coordinate) => {
        const lonLat = toLonLat(coordinate, view.getProjection());
        jaiaDispatch({
            type: JaiaActions.MOVE_ZONE_VERTEX,
            location: { lon: lonLat[0], lat: lonLat[1] },
        });
    };

    /**
     * Dispatches action to add a vertex to the zone currently in edit mode
     *
     * @param {Coordinate} coordinate Location of click on map
     * @returns {void}
     */
    const handleAddZoneVertexClick = (coordinate: Coordinate) => {
        const lonLat = toLonLat(coordinate, view.getProjection());
        jaiaDispatch({
            type: JaiaActions.ADD_ZONE_VERTEX,
            zoneID: jaiaGlobal.getZoneInEditMode()!,
            location: { lon: lonLat[0], lat: lonLat[1] },
        });
    };

    /**
     * Dispatches action to add a waypoint to the current mission. Any zone-crossing
     * detection and confirm/revert dialog is handled by the reducer, the same way
     * moving a waypoint is.
     *
     * @param {Coordinate} coordinate Location of click on map
     * @returns {void}
     */
    const handleAddWaypointClick = (coordinate: Coordinate) => {
        const lonLat = toLonLat(coordinate, view.getProjection());
        jaiaDispatch({
            type: JaiaActions.ADD_WAYPOINT,
            location: { lon: lonLat[0], lat: lonLat[1] },
        });
    };

    /**
     * Creates the exclusion zone Draw interaction and wires its drawend handler.
     * Defined outside the component so dispatch is passed explicitly rather than
     * captured implicitly — keeping the OL singleton free of React references.
     *
     * @returns {void}
     */
    const initExclusionZoneDraw = () => {
        const draw = exclusionZoneLayer.createDrawInteraction();
        draw.on("drawend", (event: DrawEvent) => {
            const vertices = exclusionZoneLayer.configureDrawEnd(event);
            if (vertices.length >= 3) {
                jaiaDispatch({ type: JaiaActions.ADD_EXCLUSION_ZONE, exclusionZone: { vertices } });
            }
        });
    };

    return (
        <div>
            <div id="map" data-testid="map"></div>

            {placementError && (
                <PlacementErrorDialog
                    message={placementError}
                    onDismiss={() => setPlacementError(null)}
                />
            )}
        </div>
    );
}
