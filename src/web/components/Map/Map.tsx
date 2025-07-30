import { useEffect, useContext } from "react";
import { JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionSet } from "../../data/mission_set/mission-set";

import { Feature, MapBrowserEvent } from "ol";
import { Coordinate } from "ol/coordinate";
import { Geometry } from "ol/geom";
import { toLonLat } from "ol/proj";

import { map } from "../../openlayers/maps/map";
import { view } from "../../openlayers/views/view";

import { NodeTypes } from "../../types/jaia-system-types";
import { MapFeatureTypes, MapModes } from "../../types/openlayers-types";
import { UNASSIGNED_ID } from "../../utils/constants";

import "./Map.less";

export default function Map() {
    const jaiaDispatch = useContext(JaiaDispatchContext);

    useEffect(() => {
        map.setTarget("map");
        map.on("click", (event: MapBrowserEvent<PointerEvent>) => {
            handleMapClick(event);
        });
    }, []);

    /**
     * Distributes map clicks to appropriate handlers
     *
     * @param {MapBrowserEvent<PointerEvent>} event Contains data assoicated with map click
     * @returns {void}
     */
    const handleMapClick = (event: MapBrowserEvent<PointerEvent>) => {
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
                default:
                    return;
            }
        }

        if (jaiaGlobal.getMapMode() === MapModes.RALLY) {
            handleAddRallyPoint(event.coordinate);
            return;
        }

        if (isWaypointMovable()) {
            handleMoveWaypointClick(event.coordinate);
            return;
        }

        handleAddWaypointClick(event.coordinate);
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
        jaiaDispatch({
            type: JaiaActions.CLICKED_WAYPOINT,
            clickedWaypoint: {
                waypointNum: feature.get("waypointNum"),
                missionID: feature.get("missionID"),
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

    /**
     * Checks to see if the selected waypoint is movable
     *
     * @returns {boolean} True if the waypoint is movable, false if not
     */
    const isWaypointMovable = () => {
        if (jaiaGlobal.getSelectedWaypoint().waypointNum !== UNASSIGNED_ID) {
            const mission = missionSet.getMission(jaiaGlobal.getSelectedWaypoint().missionID);
            const waypoint = mission.getWaypoint(jaiaGlobal.getSelectedWaypoint().waypointNum);

            if (waypoint.getIsMovable()) {
                return true;
            }
        }
        return false;
    };

    return <div id="map" data-testid="map"></div>;
}
