import { useEffect, useContext } from "react";
import { JaiaDispatchContext } from "../../context/Jaia/JaiaContext";
import { JaiaActions } from "../../context/Jaia/jaia-actions";

import { Feature, MapBrowserEvent } from "ol";
import { Coordinate } from "ol/coordinate";
import { Geometry } from "ol/geom";
import { toLonLat } from "ol/proj";

import { map } from "../../openlayers/maps/map";
import { view } from "../../openlayers/views/view";
import { NodeTypes } from "../../types/jaia-system-types";
import { MapFeatureTypes } from "../../types/openlayers-types";

import "./Map.less";

export default function Map() {
    const jaiaDispatch = useContext(JaiaDispatchContext);

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
            jaiaDispatch({
                type: JaiaActions.CLICKED_NODE,
                selectedNode: { type: nodeType, id: nodeID },
            });
        }
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
