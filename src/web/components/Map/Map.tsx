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

export default function Map() {
    const globalDispatch = useContext(GlobalDispatchContext);
    const jaiaSystemDispatch = useContext(JaiaSystemDispatchContext);

    useEffect(() => {
        map.setTarget("map");
        map.on("click", (event: MapBrowserEvent<UIEvent>) => {
            handleMapClick(event);
        });
    });

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

    const handleAddWaypointClick = (coordinate: Coordinate) => {
        const lonLat = toLonLat(coordinate, view.getProjection());
        jaiaSystemDispatch({
            type: JaiaSystemActions.ADD_WAYPOINT,
            location: { lon: lonLat[0], lat: lonLat[1] },
        });
    };

    return <div id="map" data-testid="map"></div>;
}
