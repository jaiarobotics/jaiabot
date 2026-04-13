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
    GHOST_MISSION_LAYER = "ghost-mission-layer",
    GRID_LAYER = "grid-layer",
    EXCLUSION_ZONE_LAYER = "exclusion-zone-layer",
    DIVE_LAYER = "dive-layer",
    DRIFT_LAYER = "drift-layer",
    CONTOUR_LAYER = "contour-layer",
    EXCLUDED_TASK_PACKETS_LAYER = "excluded-task-packets-layer",
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
    // Type name comes from server side
    DEPTH_CONTOUR = "depth-contour",
    ZONE_VERTEX = "ZONE_VERTEX",
}

export enum MapModes {
    DEFAULT = "DEFAULT",
    RALLY = "RALLY",
    MEASURE = "MEASURE",
    SURVEY_PLANNING = "SURVEY_PLANNING",
    SURVEY_CONSTANT_HEADING_SELECT = "SURVEY_CONSTANT_HEADING_SELECT",
    CONSTANT_HEADING_SELECT = "CONSTANT_HEADING_SELECT",
    HUB_LOCATION_SELECT = "HUB_LOCATION_SELECT",
    EXCLUSION_ZONE_DRAWING = "EXCLUSION_ZONE_DRAWING",
}

export enum SurveyEndpoints {
    START = 1,
    END = 2,
}

export enum LineType {
    SOLID = 1,
    DASHED = 2,
}
