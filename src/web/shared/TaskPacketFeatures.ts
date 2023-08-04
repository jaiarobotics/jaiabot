import { Feature } from 'ol'
import { fromLonLat } from 'ol/proj.js'
import { createMarker } from './Marker'
import { LineString } from 'ol/geom'
import * as Styles from "./Styles"
import {Map} from 'ol'
import { DriftPacket, DivePacket, TaskPacket } from './JAIAProtobuf';


function DivePacketDescription(dive: DivePacket): string[] {

    var rows: string[] = []

    if (dive?.depth_achieved !== undefined) {
        rows.push(`Depth achieved: ${dive.depth_achieved.toFixed(2)} m`)
    }

    if (dive?.duration_to_acquire_gps !== undefined) {
        rows.push(`Duration to acquire GPS: ${dive.duration_to_acquire_gps.toFixed(2)} s`)
    }

    if (dive?.powered_rise_rate !== undefined) {
        rows.push(`Powered rise rate: ${dive.powered_rise_rate.toFixed(2)} m/s`)
    }

    if (dive?.unpowered_rise_rate !== undefined) {
        rows.push(`Unpowered rise rate: ${dive.unpowered_rise_rate.toFixed(2)} m/s`)
    }

    return rows
}
    

function createDriftPacketFeature(map: Map, drift: DriftPacket) {
    const projection = map.getView().getProjection()
    const start = fromLonLat([drift.start_location.lon, drift.start_location.lat], projection)
    const end = fromLonLat([drift.end_location.lon, drift.end_location.lat], projection)
    const k = 120 / drift.drift_duration
    const coordinates = [start, end]
    const feature = new Feature({geometry: new LineString(coordinates)})
    feature.setStyle(Styles.driftArrow)
    return feature
}


interface FieldDescriptor {
    name: string
    units: string
    key: string
}


export function createTaskPacketFeatures(map: Map, taskPacket: TaskPacket) {
    var features = []

    if (taskPacket?.drift !== undefined) {
        // Drift markers
        const drift = taskPacket.drift

        if (drift?.drift_duration !== undefined
            && drift?.start_location !== undefined
            && drift?.start_location?.lat !== undefined
            && drift?.start_location?.lon !== undefined
            && drift?.end_location !== undefined
            && drift?.end_location?.lat !== undefined
            && drift?.end_location?.lon !== undefined
            && drift?.drift_duration != 0) {

            features.push(createDriftPacketFeature(map, drift))

        }
    }

    if (taskPacket?.dive !== undefined) {

        // Dive markers
        const dive = taskPacket.dive

        if (dive?.bottom_dive !== undefined
            && dive?.start_location !== undefined
            && dive?.start_location?.lat !== undefined
            && dive?.start_location?.lon !== undefined) {

            const rows = DivePacketDescription(dive).join('<br>') + '<br>'

            const d_description = `<h3>Dive</h3>Bottom strike: ${dive.bottom_dive ? 'yes' : 'no'}<br>${rows}`

            if (dive.depth_achieved != 0) {
                features.push(createMarker(map, {title: 'Dive', lon: dive.start_location.lon, lat: dive.start_location.lat, style: Styles.divePacket(dive), popupHTML: d_description}))
            }
        }
    }

    return features
}
