// Saving and loading settings from browser's localStorage
import { ConstantHeadingParameters, DiveParameters, DriftParameters, Speeds } from "./shared/JAIAProtobuf"
import { Coordinate } from 'ol/coordinate'

/**
 * Return an updated version of the first object, updating values recursively from the second object, if they're both objects.
 * 
 * @param obj1 First object
 * @param obj2 Second object
 * @returns Updated object
 */
function update(obj1: any, obj2: any) {
    // If the types are not the same, or obj2 == null, then just keep obj1
    if (typeof obj2 !== typeof obj1 || obj2 == null) {
        return obj1
    }

    // If it's a simple type, just keep obj2
    if (typeof obj2 !== 'object') {
        return obj2
    }

    // If we're expecting an array here, and obj2 contains an array here, use obj2's array, otherwise use obj1's array
    if (Array.isArray(obj1)) {
        if (Array.isArray(obj2)) {
            return obj2
        }
        else {
            return obj1
        }
    }

    // If both are JS objects, we need to update each element of obj1
    for (const [key, value] of Object.entries(obj1)) {
        obj1[key] = update(obj1[key], obj2[key])
    }
    return obj1
}


export function Load<T>(key: string, defaultValue: T) {
    var value = defaultValue;

    (value as any)._localStorageKeyFunc = () => key

    const s = localStorage.getItem(key)
    if (s) {
        const storedValue = JSON.parse(s)

        if (storedValue) {
            value = update(value, storedValue)
        }
    }

    return value
}


export function Save(value: any) {
    const key = value._localStorageKeyFunc()
    localStorage.setItem(key, JSON.stringify(value))
}


export interface MapSettings {
    visibleLayers: string[]
    center: Coordinate
    zoomLevel: number
    rotation: number
}


export let GlobalSettings = {

    // Default dive parameters when creating a new dive task
    diveParameters: Load<DiveParameters>('diveParameters', {
        max_depth: 10,
        depth_interval: 10,
        hold_time: 0
    }),

    // Default drift parameters for dive and drift tasks
    driftParameters: Load<DriftParameters>('driftParameters', {
        drift_time: 10
    }),

    constantHeadingParameters: Load<ConstantHeadingParameters>('constantHeadingParameters', {
        constant_heading: 0,
        constant_heading_speed: 3,
        constant_heading_time: 10
    }),

    // MissionPlan speeds
    missionPlanSpeeds: Load<Speeds>('missionPlanSpeeds', {
        transit: 2,
        stationkeep_outer: 1.5
    }),

    mapSettings: Load<MapSettings>('mapSettings', {
        visibleLayers: ['OpenStreetMap'],
        center: [0, 0],
        zoomLevel: 2,
        rotation: 0
    })
}
