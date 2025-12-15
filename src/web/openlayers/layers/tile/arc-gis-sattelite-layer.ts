import TileLayer from "ol/layer/Tile";
import SourceXYZ from "ol/source/XYZ";
import { ARC_GIS_MAX_ZOOM } from "../../../utils/constants";

export const arcGISSatelliteLayer = new TileLayer({
    properties: {
        title: "arc-gis-satellite-layer",
    },
    source: new SourceXYZ({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attributions:
            "Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community, ESRI",
        attributionsCollapsible: false,
        wrapX: false,
        maxZoom: ARC_GIS_MAX_ZOOM,
    }),
    visible: false,
});
