import React, { useEffect, useContext } from "react";
import { GlobalDispatchContext } from "../../context/Global/GlobalContext";
import { GlobalActions } from "../../context/Global/GlobalActions";

import { Feature, MapBrowserEvent } from "ol";
import { Geometry } from "ol/geom";

import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { map } from "../../openlayers/maps/map";
import { hubLayer } from "../../openlayers/layers/vector/hub-layer";
import { botLayer } from "../../openlayers/layers/vector/bot-layer";
import { NodeTypes } from "../../types/jaia-system-types";
import { MapFeatureTypes } from "../../types/openlayers-types";

import "./Map.less";

export default function Map() {
    const globalDispatch = useContext(GlobalDispatchContext);

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
    };

    const handleNodeClick = (feature: Feature<Geometry>) => {
        const nodeType = feature.get("type");
        const nodeID = feature.get("id");

        if (nodeType === NodeTypes.BOT || nodeType == NodeTypes.HUB) {
            // Update data model
            jaiaGlobal.setSelectedNode({ type: nodeType, id: nodeID });

            // Update OpenLayers
            botLayer.updateFeatures();
            hubLayer.updateFeatures();

            // Update React Context
            globalDispatch({ type: GlobalActions.CLICKED_NODE });
        }
    };

    return <div id="map" data-testid="map"></div>;
}
