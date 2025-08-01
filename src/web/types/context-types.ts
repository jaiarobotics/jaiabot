export const enum HubAccordionNames {
    QUICKLOOK = "quickLook",
    COMMANDS = "commands",
    LINKS = "links",
}

export interface HubAccordionStates {
    quickLook: boolean;
    commands: boolean;
    links: boolean;
}

export const enum BotAccordionNames {
    QUICKLOOK = "quickLook",
    COMMANDS = "commands",
    ADVANCED_COMMANDS = "advanced_commands",
    HEALTH = "health",
    DATA = "data",
    GPS = "gps",
    IMU = "imu",
    SENSOR = "sensor",
}

export interface BotAccordionStates {
    quickLook: boolean;
    commands: boolean;
    advancedCommands: boolean;
    health: boolean;
    data: boolean;
    gps: boolean;
    imu: boolean;
    sensor: boolean;
}

export const enum MapLayerAccordionNames {
    BASE_MAPS = "baseMaps",
    BATHYMETRY = "bathymetry",
    MEASUREMENTS = "measurements",
    MISSION = "mission",
}

export interface MapLayerAccordionStates {
    baseMaps: boolean;
    bathymetry: boolean;
    measurements: boolean;
    mission: boolean;
}

export const enum ButtonTypes {
    PANEL = 1,
    COMMAND = 2,
    MAP_MODE = 3,
}

export const enum ButtonNames {
    NONE = "none",
    ADD_RALLY = "add_rally",
    GO_TO_RALLY = "go_to_rally",
    DATA_OFFLOAD_PANEL = "data_offload_panel",
    HELP_PANEL = "help_panel",
    JAIA_ABOUT_PANEL = "jaia_about_panel",
    MISSIONS_PANEL = "missions_panel",
    RALLY_PANEL = "rally_panel",
    SETTINGS_PANEL = "settings_panel",
    START_ALL_MISSIONS = "start_all_missions",
    TASK_PACKET_PANEL = "task_packet_panel",
    WAYPOINT_PANEL = "waypoint_panel",
}

export enum DialogActions {
    NONE = 1,
    CONFIRMED = 2,
}

export enum PanelActions {
    CANCEL = 1,
    DONE = 2,
    CLOSE = 3,
}
