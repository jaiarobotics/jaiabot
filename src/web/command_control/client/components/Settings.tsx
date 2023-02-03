// Saving and loading settings from browser's localStorage

import { ConstantHeadingParameters, DiveParameters, DriftParameters, Speeds } from "./gui/JAIAProtobuf"
import { Coordinate } from 'ol/coordinate'
import $ from 'jquery'


export function Load<T>(key: string, defaultValue: T) {
    var value = defaultValue;

    (value as any)._localStorageKeyFunc = () => key

    const s = localStorage.getItem(key)
    if (s) {
        const storedValue = JSON.parse(s)

        if (storedValue) {
            $.extend(true, value, storedValue)
        }
    }

    return value
}


export function Save(value: any) {
    const key = value._localStorageKeyFunc()
    localStorage.setItem(key, JSON.stringify(value))
}


export interface MapSettings {
    visibleLayers: Set<string>
    center: Coordinate
    zoomLevel: number
    rotation: number
}


export let GlobalSettings = {

    // Default dive parameters when creating a new dive task
    diveParameters: Load<DiveParameters>('diveParameters', {
        max_depth: 10,
        depth_interval: 10,
        hold_time: 1
    }),

    // Default drift parameters for dive and drift tasks
    driftParameters: Load<DriftParameters>('driftParameters', {
        drift_time: 10
    }),

    constantHeadingParameters: Load<ConstantHeadingParameters>('constantHeadingParameters', {
        constant_heading: 0,
        constant_heading_speed: 1,
        constant_heading_time: 10
    }),

    // MissionPlan speeds
    missionPlanSpeeds: Load<Speeds>('missionPlanSpeeds', {
        transit: 2,
        stationkeep_outer: 1.5
    }),

    mapSettings: Load<MapSettings>('mapSettings', {
        visibleLayers: new Set(['OpenStreetMap', 'NOAA ENC Charts']),
        center: [0, 0],
        zoomLevel: 2,
        rotation: 0
    })
    
}

// Process the array from JSON into the proper type:  a Set
GlobalSettings.mapSettings.visibleLayers = new Set(GlobalSettings.mapSettings.visibleLayers)
