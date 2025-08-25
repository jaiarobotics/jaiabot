export enum LayerTitles {
    OSM_LAYER = "open-street-maps-layer",
    ARC_GIS_SATELLITE_LAYER = "arg-gis-satellite-layer",
    NOAA_ENC_LAYER = "noaa-enc-layer",
    BOT_LAYER = "bot-layer",
    HUB_LAYER = "hub-layer",
    HUB_COMMS_LAYER = "hub-comms-layer",
    MISSION_LAYER = "mission-layer",
    DIVE_LAYER = "dive-layer",
    DRIFT_LAYER = "drift-layer",
    RALLY_LAYER = "rally-layer",
    MEASURE_LAYER = "measure-layer",
    SENTINEL_LAYER = "sentinel-layer",
}

export enum MapFeatureTypes {
    NONE = "NONE",
    BOT = "BOT",
    HUB = "HUB",
    WAYPOINT = "WAYPOINT",
    WAYPOINT_LINE = "WAYPOINT_LINE",
    RALLY_POINT = "RALLY_POINT",
    DIVE = "DIVE",
    DRIFT = "DRIFT",
    SENTINAL_TRACK = "SENTINAL_TRACK",
    SENTINAL_INTERCEPT = "SENTINAL_INTERCEPT",
}

export enum MapModes {
    DEFAULT = "DEFAULT",
    RALLY = "RALLY",
    MEASURE = "MEASURE",
}
