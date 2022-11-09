import { Feature } from 'ol'
import { fromLonLat } from 'ol/proj.js'
import { createMarker } from './Marker.js'
import { LineString } from 'ol/geom'
import * as Styles from "./Styles"


function createDriftTaskFeature(map, drift) {
    const projection = map.getView().getProjection()
    const start = fromLonLat([drift.start_location.lon, drift.start_location.lat], projection)
    const end = fromLonLat([drift.end_location.lon, drift.end_location.lat], projection)
    const k = 120 / drift.drift_duration
    const adjustedEnd = [start[0] + k * (end[0] - start[0]), start[1] + k * (end[1] - start[1])]

    const coordinates = [start, adjustedEnd]
    console.log(coordinates)
    const feature = new Feature({geometry: new LineString(coordinates)})
    feature.setStyle(Styles.driftArrow)
    return feature
}


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
        features.push(createDriftTaskFeature(map, drift))
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
