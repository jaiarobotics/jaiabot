import { Feature } from 'ol'
import { fromLonLat } from 'ol/proj.js'
import { createMarker } from './Marker'
import { LineString } from 'ol/geom'
import * as Styles from "./Styles"
import {Map} from 'ol'
import { DriftTask, Location, TaskPacket, DiveTaskDescription } from './ProtoBufMessages';


function createDriftTaskFeature(map: Map, drift: DriftTask) {
    const projection = map.getView().getProjection()
    const start = fromLonLat([drift.start_location.lon, drift.start_location.lat], projection)
    const end = fromLonLat([drift.end_location.lon, drift.end_location.lat], projection)
    const k = 120 / drift.drift_duration
    const adjustedEnd = [start[0] + k * (end[0] - start[0]), start[1] + k * (end[1] - start[1])]

    const coordinates = [start, adjustedEnd]
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

    // Drift markers
    const drift = taskPacket.drift

    if (drift != null && drift.drift_duration != 0) {
        features.push(createDriftTaskFeature(map, drift))
    }

    // Dive markers
    const dive = taskPacket.dive

    if (dive != null) {
        const rows = DiveTaskDescription(dive).join('<br>') + '<br>'

        const d_description = `<h3>Dive</h3>Bottom strike: ${dive.bottom_dive ? 'yes' : 'no'}<br>${rows}`

        if (dive.depth_achieved != 0) {
            features.push(createMarker(map, {title: 'Dive', lon: dive.start_location.lon, lat: dive.start_location.lat, style: Styles.diveTask(dive), popupHTML: d_description}))
        }
    }

    return features
}
