import { DriftPacket, DivePacket, TaskPacket } from './JAIAProtobuf'
import { createMarker } from './Marker'
import { fromLonLat } from 'ol/proj.js'
import { LineString } from 'ol/geom'
import { Feature } from 'ol'
import { Map } from 'ol'
import * as Styles from "./Styles"
    

function createDriftPacketFeature(map: Map, drift: DriftPacket) {
    const projection = map.getView().getProjection()
    const start = fromLonLat([drift.start_location.lon, drift.start_location.lat], projection)
    const end = fromLonLat([drift.end_location.lon, drift.end_location.lat], projection)
    const coordinates = [start, end]
    const feature = new Feature({geometry: new LineString(coordinates)})
    feature.setProperties({
        'type': 'drift',
        'duration': drift?.drift_duration, // (s)
        'speed': drift?.estimated_drift?.speed // (m/s)
    })
    feature.setStyle(Styles.driftArrow)
    return feature
}

export function createTaskPacketFeatures(map: Map, taskPacket: TaskPacket) {
    const features = []

    if (taskPacket?.drift != undefined) {
        // Drift markers
        const drift = taskPacket.drift

        if (
            drift?.drift_duration != undefined &&
            drift?.drift_duration != 0 &&
            drift?.start_location != undefined &&
            drift?.start_location?.lat != undefined &&
            drift?.start_location?.lon != undefined &&
            drift?.end_location != undefined &&
            drift?.end_location?.lat != undefined &&
            drift?.end_location?.lon != undefined

        ) {
            features.push(createDriftPacketFeature(map, drift))
        }
    }

    if (taskPacket?.dive != undefined) {
        // Dive markers
        const dive = taskPacket.dive

        if (
            dive?.bottom_dive != undefined &&
            dive?.start_location != undefined &&
            dive?.start_location?.lat != undefined &&
            dive?.start_location?.lon != undefined
        ) {
            if (dive.depth_achieved != 0) {
                const diveFeature = createMarker(map, {title: 'dive', lon: dive.start_location.lon, lat: dive.start_location.lat, style: Styles.divePacket(dive)})
                diveFeature.setProperties({
                    'type': 'dive',
                    'depthAchieved': dive?.depth_achieved, // (m)
                    'diveRate': dive?.dive_rate // (m/s)
                })
                features.push(diveFeature)
            }
        }
    }

    return features
}
