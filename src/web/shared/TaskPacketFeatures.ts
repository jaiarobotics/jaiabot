import { TaskPacket } from './JAIAProtobuf'
import { createMarker } from './Marker'

import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Geometry, Point } from 'ol/geom'
import { fromLonLat } from 'ol/proj.js'
import { Feature } from 'ol'
import { Map } from 'ol'

import * as turf from '@turf/turf'
import * as Styles from "./Styles"

export function createDivePacketFeature(map: Map, task_packet: TaskPacket) {
    const dive = task_packet.dive
    if (!dive) {
        return null
    }

    const feature = createMarker(map, {title: 'dive', lon: dive?.start_location?.lon ?? 0, lat: dive?.start_location?.lat ?? 0})
    feature.setProperties({
        'type': 'dive',
        'id': Math.random(),
        'taskPacket': task_packet,
        'diveRate': Number(dive.dive_rate?.toFixed(2)), // (m/s)
        'bottomDive': dive.bottom_dive,
        'botId': task_packet.bot_id,
        'startTime': task_packet.start_time,
        'endTime': task_packet.end_time,
        'startLocation': dive.start_location,
        'selected': false,
        'animated': false
    })
    feature.setStyle(Styles.divePacketIconStyle(feature))
    return feature
}

export function createDriftPacketFeature(map: Map, taskPacket: TaskPacket) {
    const drift = taskPacket.drift

    const startLon = drift?.start_location?.lon
    const startLat = drift?.start_location?.lat
    const endLon = drift?.end_location?.lon
    const endLat = drift?.end_location?.lat

    const projection = map.getView().getProjection()
    const start = turf.point([startLon, startLat])
    const end = turf.point([endLon, endLat])
    const midpoint = turf.midpoint(start, end).geometry.coordinates

    const feature = new Feature({geometry: new Point(fromLonLat(midpoint, projection))})
    feature.setProperties({
        'drift': drift,
        'type': 'drift',
        'id': Math.random(),
        'duration': Number(drift?.drift_duration?.toFixed(2)), // (s)
        'speed': Number(drift?.estimated_drift?.speed?.toFixed(2)), // (m/s)
        'driftDirection': Number(drift?.estimated_drift?.heading?.toFixed(2)),
        'sigWaveHeight': Number(drift?.significant_wave_height?.toFixed(2)),
        'botId': taskPacket.bot_id,
        'startTime': taskPacket.start_time,
        'endTime': taskPacket.end_time,
        'startLocation': drift?.start_location,
        'selected': false,
        'animated': false
    })
    const style = Styles.driftPacketIconStyle(feature)
    feature.setStyle(style)

    return feature
}

export function getDivePacketFeature(map: Map, taskPacket: TaskPacket, divePacketLayer: VectorLayer<VectorSource<Geometry>>) {
    if (taskPacket?.dive != undefined) {
        const dive = taskPacket.dive
        if (
            dive?.bottom_dive != undefined &&
            dive?.start_location != undefined &&
            dive?.start_location?.lat != undefined &&
            dive?.start_location?.lon != undefined &&
            dive?.depth_achieved != 0
        ) {
            const selectedFeature = getSelectedFeature(divePacketLayer)
            const newFeature = createDivePacketFeature(map, taskPacket)
            return compareFeatures(selectedFeature, newFeature)
        }
    }
}

export function getDriftPacketFeature(map: Map, taskPacket: TaskPacket, driftPacketLayer: VectorLayer<VectorSource<Geometry>>) {
    if (taskPacket?.drift != undefined) {
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
            const selectedFeature = getSelectedFeature(driftPacketLayer)
            const newFeature = createDriftPacketFeature(map, taskPacket)
            return compareFeatures(selectedFeature, newFeature)
        }
    }
}

function getSelectedFeature(collectionLayer: VectorLayer<VectorSource<Geometry>>) {
    const currentFeatures = collectionLayer.getSource()?.getFeatures() ?? []
    for (const featuresArray of currentFeatures) {
        const feature = featuresArray.get('features')[0]
        if (feature.get('selected')) {
            return feature
        }
    }
    return null
}

function compareFeatures(selectedFeature: Feature<Geometry> | null, newFeature: Feature<Geometry> | null) {
    if (selectedFeature?.get('botId') === newFeature?.get('botId') && selectedFeature?.get('startTime') === newFeature?.get('startTime')) {
        return selectedFeature
    }
    return newFeature
}
