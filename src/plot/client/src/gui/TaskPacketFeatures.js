import { createMarker } from './Marker.js'
import * as Styles from "./Styles"


export function createTaskPacketFeatures(map, taskPacket) {
    // Helper to convert from latlon obj to array
    function to_array(latlon) {
        return [latlon.lat, latlon.lon]
    }

    // Helper to get dive / drift description from dictionary
    function description_of(obj, descriptors) {
        var s = ''

        for (const key in descriptors) {
            const name = descriptors[key][0]
            const units = descriptors[key][1]

            if (obj[key] != null) {
                s = s + name + ': ' + obj[key].toFixed(2) + ' ' + units + '<br>'
            }
        }

        return s
    }

    var features = []

    // Drift markers
    const drift = taskPacket.drift

    if (drift != null && drift.drift_duration != 0) {

        const d_start = to_array(drift.start_location)
        const d_end = to_array(drift.end_location)

        const d_hover = '<h3>Surface Drift</h3>Duration: ' + drift.drift_duration + ' s<br>Heading: ' + drift.estimated_drift.heading?.toFixed(2) + '°<br>Speed: ' + drift.estimated_drift.speed?.toFixed(2) + ' m/s'

        features.push(createMarker(map, {title: 'Surface Drift', lon: drift.start_location.lon, lat: drift.start_location.lat, style: Styles.driftTask(drift)}))
    }

    // Dive markers
    const dive = taskPacket.dive

    if (dive != null) {
        const descriptors = {
            'depth_achieved': ['Depth achieved', 'm'],
            'duration_to_acquire_gps': ['Duration to acquire GPS', 's'],
            'powered_rise_rate': ['Powered rise rate', 'm/s'],
            'unpowered_rise_rate': ['Unpowered rise rate', 'm/s']
        }

        const d_description = `<h3>Dive</h3>Bottom strike: ${dive.bottom_dive ? 'yes' : 'no'}<br>${description_of(dive, descriptors)}`

        if (dive.depth_achieved != 0) {
            features.push(createMarker(map, {title: 'Dive', lon: dive.start_location.lon, lat: dive.start_location.lat, style: Styles.diveTask(dive)}))
        }
    }

    return features
}
