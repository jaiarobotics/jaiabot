// Saving and loading settings from browser's localStorage

class Setting {

    constructor(key, defaultValue=null) {
        this.key = key
        this.defaultValue = defaultValue
    }

    set(value) {
        localStorage.setItem(this.key, JSON.stringify(value))
    }

    get() {
        let valueString = localStorage.getItem(this.key)
        if (!valueString) {
        return this.defaultValue
        }
        else {
        return JSON.parse(valueString)
        }
    }

}

export let Settings = {
    diveMaxDepth: new Setting("dive.max_depth", 10),
    diveDepthInterval: new Setting("dive.depth_interval", 10),
    diveHoldTime: new Setting("dive.hold_time", 1),
    driftTime: new Setting("drift.time", 10),

    constantHeading: new Setting("constantHeading.constant_heading", 0),
    constantHeadingTime: new Setting("constantHeading.constant_heading_time", 10),
    constantHeadingSpeed: new Setting("constantHeading.constant_heading_speed", 1),

    mapVisibleLayers: new Setting("map.visibleLayers"),
    mapCenter: new Setting("map.center"),
    mapZoomLevel: new Setting("map.zoomLevel"),
    mapRotation: new Setting("map.rotation"),

    missionPlanSpeeds: new Setting("mission.plan.speeds"),

    savedMissions: new Setting("savedMissionsV1"),
}
