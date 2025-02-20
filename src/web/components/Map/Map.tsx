import { useEffect, useContext } from "react";
import { GlobalDispatchContext } from "../../context/Global/GlobalContext";
import { GlobalActions } from "../../context/Global/GlobalActions";
import { JaiaSystemDispatchContext } from "../../context/JaiaSystem/JaiaSystemContext";
import { JaiaSystemActions } from "../../context/JaiaSystem/jaia-system-actions";

import { Feature, MapBrowserEvent } from "ol";
import { Coordinate } from "ol/coordinate";
import { Geometry } from "ol/geom";
import { toLonLat } from "ol/proj";

import { map } from "../../openlayers/maps/map";
import { view } from "../../openlayers/views/view";
import { NodeTypes } from "../../types/jaia-system-types";
import { MapFeatureTypes } from "../../types/openlayers-types";

import "./Map.less";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { UNASSIGNED_ID } from "../../utils/constants";

export default function Map() {
    const globalDispatch = useContext(GlobalDispatchContext);
    const jaiaSystemDispatch = useContext(JaiaSystemDispatchContext);

    useEffect(() => {
        map.setTarget("map");
        map.on("click", (event: MapBrowserEvent<UIEvent>) => {
            handleMapClick(event);
        });
    });

    /**
     * Distributes map clicks to appropriate handlers
     *
     * @param {MapBrowserEvent<UIEvent>} event Contains data assoicated with map click
     * @returns {void}
     */
    const handleMapClick = (event: MapBrowserEvent<UIEvent>) => {
        const feature = map.forEachFeatureAtPixel(event.pixel, (feature: Feature) => feature);

        if (feature && feature.get("type")) {
            switch (feature.get("type")) {
                case MapFeatureTypes.BOT:
                    handleNodeClick(feature);
                    return;
                case MapFeatureTypes.HUB:
                    handleNodeClick(feature);
                    return;
                default:
                    return;
            }
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
            globalDispatch({
                type: GlobalActions.CLICKED_NODE,
                selectedNode: { type: nodeType, id: nodeID },
            });
        }
    };

    /**
     *  Checks to make sure a mission is in edit mode and then
     *  dispatches action to add a waypoint to the map
     *
     * @param {Coordinate} coordinate Location of click on map
     * @returns {void}
     *
     * @notes
     * We convert click coordinate to lat/lon. The click
     * coordinate is based on the map's projection.
     */
    const handleAddWaypointClick = (coordinate: Coordinate) => {
        const missionIDInEditMode = jaiaGlobal.getMissionIDInEditMode();
        if (missionIDInEditMode !== UNASSIGNED_ID) {
            const lonLat = toLonLat(coordinate, view.getProjection());
            jaiaSystemDispatch({
                type: JaiaSystemActions.ADD_WAYPOINT,
                missionID: missionIDInEditMode,
                location: { lon: lonLat[0], lat: lonLat[1] },
            });
        }
    };

    return <div id="map" data-testid="map"></div>;
}
