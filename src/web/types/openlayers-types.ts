export enum LayerTitles {
    // Empty string needed for MUI Select default
    NONE = "",
    OSM_LAYER = "open-street-maps-layer",
    ARC_GIS_SATELLITE_LAYER = "arg-gis-satellite-layer",
    NOAA_ENC_LAYER = "noaa-enc-layer",
    BOT_LAYER = "bot-layer",
    HUB_LAYER = "hub-layer",
    HUB_COMMS_LAYER = "hub-comms-layer",
    MISSION_LAYER = "mission-layer",
    GRID_LAYER = "grid-layer",
    DIVE_LAYER = "dive-layer",
    DRIFT_LAYER = "drift-layer",
    CONTOUR_LAYER = "contour-layer",
    RALLY_LAYER = "rally-layer",
    MEASURE_LAYER = "measure-layer",
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
}

export enum MapModes {
    DEFAULT = "DEFAULT",
    RALLY = "RALLY",
    MEASURE = "MEASURE",
    SURVEY_PLANNING = "SURVEY_PLANNING",
}

export enum SurveyEndpoints {
    START = 1,
    END = 2,
}

export enum LineType {
    SOLID = 1,
    DASHED = 2,
}
