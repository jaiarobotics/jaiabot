import { useEffect, useContext, useState } from "react";
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
import { exclusionZoneLayer } from "../../openlayers/layers/vector/exclusion-zone-layer";
import { styleControlButtons } from "../../openlayers/controls/controls";
import { generateSurveyEndpoint } from "../../openlayers/features/survey/survey-endpoints";

import { NodeTypes, TaskParameterKeys } from "../../types/jaia-system-types";
import { ButtonNames, ButtonTypes } from "../../types/context-types";
import { MapFeatureTypes, MapModes, SurveyEndpoints } from "../../types/openlayers-types";
import { MAP_FEATURE_HIT_TOLERANCE, UNASSIGNED_ID } from "../../utils/constants";
import { locationToConstantHeadingParams } from "../../utils/conversions";
import { GeographicCoordinate } from "../../types/protobuf-types";

import { missionsManager } from "../../data/missions_manager/missions-manager";
import { missionSet } from "../../data/mission_set/mission-set";
import { gridPlan, GridPlanningStates } from "../../data/survey_planner/grid-plan";
import { routeAroundExclusionZones } from "../../utils/exclusion-zone-router";

import "./Map.less";

interface ZoneCrossingDialogState {
    /** Locations to add: bypass waypoints (if any) followed by the destination */
    locations: GeographicCoordinate[];
    bypassCount: number;
}

export default function Map() {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [zoneCrossing, setZoneCrossing] = useState<ZoneCrossingDialogState | null>(null);

    useEffect(() => {
        map.setTarget("map");
        map.on("click", (event: MapBrowserEvent<PointerEvent>) => {
            handleMapClick(event);
        });
        exclusionZoneLayer.setDispatch(jaiaDispatch);
        styleControlButtons();
    }, []);

    /**
     * Distributes map clicks to appropriate handlers
     */
    const handleMapClick = (event: MapBrowserEvent<PointerEvent>) => {
        const mapMode = jaiaGlobal.getMapMode();
        switch (mapMode) {
            case MapModes.RALLY:
                handleAddRallyPoint(event.coordinate);
                return;
            case MapModes.MEASURE:
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
                return;
        }

        if (jaiaGlobal.getSelectedWaypoint().isMoveable) {
            handleMoveWaypointClick(event.coordinate);
            return;
        }

        const feature = map.forEachFeatureAtPixel(event.pixel, (feature: Feature) => feature, {
            hitTolerance: MAP_FEATURE_HIT_TOLERANCE,
        });
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
                    handleDepthContourClick(event);
                    return;
                default:
                    return;
            }
        }

        if (missionSet.getMissionIDInEditMode() !== UNASSIGNED_ID) {
            handleAddWaypointClick(event.coordinate);
        }
    };

    const handleAddRallyPoint = (coordinate: Coordinate) => {
        const lonLat = toLonLat(coordinate, view.getProjection());
        jaiaDispatch({
            type: JaiaActions.ADD_RALLY_POINT,
            location: { lon: lonLat[0], lat: lonLat[1] },
        });
    };

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

    const handleHubLocationSelectClick = (coordinate: Coordinate) => {
        const lonLat = toLonLat(coordinate, view.getProjection());
        jaiaDispatch({ type: JaiaActions.MOVE_HUB, location: { lon: lonLat[0], lat: lonLat[1] } });
    };

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

    const handleRallyPointClick = (feature: Feature<Geometry>) => {
        jaiaDispatch({
            type: JaiaActions.CLICKED_RALLY_POINT,
            rallyID: feature.get("id"),
        });
    };

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

    const handleMoveWaypointClick = (coordinate: Coordinate) => {
        const lonLat = toLonLat(coordinate, view.getProjection());
        jaiaDispatch({
            type: JaiaActions.MOVE_WAYPOINT,
            location: { lon: lonLat[0], lat: lonLat[1] },
        });
    };

    /**
     * Adds a waypoint to the current mission, routing around any exclusion zones
     * that the new segment would cross. If a crossing is detected, shows a dialog
     * so the operator can confirm (with bypass waypoints) or cancel.
     */
    const handleAddWaypointClick = (coordinate: Coordinate) => {
        const lonLat = toLonLat(coordinate, view.getProjection());
        const newLocation: GeographicCoordinate = { lon: lonLat[0], lat: lonLat[1] };

        const missionID = missionSet.getMissionIDInEditMode();
        const mission = missionSet.getMission(missionID);
        const waypoints = mission?.getWaypoints() ?? [];
        const botID = missionsManager.getBotID(missionID);

        // Need at least one existing waypoint to form a segment to check.
        if (waypoints.length >= 1) {
            const fromLocation = waypoints[waypoints.length - 1].getLocation();
            const miniPlan = {
                goal: [{ location: fromLocation }, { location: newLocation }],
            };
            const result = routeAroundExclusionZones(miniPlan, botID);

            if (result.bypassCount > 0) {
                // result.plan.goal = [from, bypass..., newLocation]
                // We add everything after 'from': the bypasses + the new destination.
                const locations = result.plan.goal.slice(1).map((g) => g.location!);
                setZoneCrossing({ locations, bypassCount: result.bypassCount });
                return;
            }
        }

        jaiaDispatch({ type: JaiaActions.ADD_WAYPOINT, location: newLocation });
    };

    const onZoneCrossingConfirm = () => {
        if (!zoneCrossing) return;
        jaiaDispatch({
            type: JaiaActions.ADD_WAYPOINTS_BULK,
            locations: zoneCrossing.locations,
        });
        setZoneCrossing(null);
    };

    const onZoneCrossingCancel = () => setZoneCrossing(null);

    return (
        <div>
            <div id="map" data-testid="map"></div>

            {zoneCrossing && (
                <div className="jaia-dialog-container">
                    <div className="blocking-overlay" />
                    <div className="jaia-dialog">
                        <h1>Exclusion Zone Crossed</h1>
                        <p>
                            This waypoint crosses an exclusion zone.{" "}
                            <strong>{zoneCrossing.bypassCount}</strong> bypass waypoint
                            {zoneCrossing.bypassCount !== 1 ? "s" : ""} will be added to route
                            around it.
                        </p>
                        <div className="dialog-button-row">
                            <button className="dialog-button" onClick={onZoneCrossingCancel}>
                                Cancel
                            </button>
                            <button className="dialog-button" onClick={onZoneCrossingConfirm}>
                                Add Waypoint
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
