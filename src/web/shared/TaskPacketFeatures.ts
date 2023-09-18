import { TaskPacket } from './JAIAProtobuf'
import { createMarker } from './Marker'

import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Geometry, Point } from 'ol/geom'
import { fromLonLat } from 'ol/proj.js'
import { Feature } from 'ol'
import { Map } from 'ol'

import * as Styles from "./Styles"

export function createDivePacketFeature(map: Map, task_packet: TaskPacket) {
    const dive = task_packet.dive
    if (!dive) {
        return null
    }

    const feature = createMarker(map, {title: 'dive', lon: dive.start_location.lon, lat: dive.start_location.lat})
    feature.setProperties({
        'type': 'dive',
        'id': Math.random(),
        'depthAchieved': dive.depth_achieved, // (m)
        'diveRate': dive.dive_rate, // (m/s)
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

export function createDriftPacketFeature(map: Map, task_packet: TaskPacket) {
    const drift = task_packet.drift
    if (!drift) {
        return null
    }

    const projection = map.getView().getProjection()
    const start = fromLonLat([drift.start_location.lon, drift.start_location.lat], projection)
    const end = fromLonLat([drift.end_location.lon, drift.end_location.lat], projection)
    const middle = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]
    const feature = new Feature({geometry: new Point(middle)})
    feature.setProperties({
        'drift': drift,
        'type': 'drift',
        'id': Math.random(),
        'duration': drift.drift_duration, // (s)
        'speed': drift.estimated_drift?.speed, // (m/s)
        'driftDirection': drift.estimated_drift?.heading,
        'sigWaveHeight': drift.significant_wave_height,
        'botId': task_packet.bot_id,
        'startTime': task_packet.start_time,
        'endTime': task_packet.end_time,
        'startLocation': drift.start_location,
        'selected': false,
        'animated': false
    })
    feature.setStyle(Styles.driftPacketIconStyle(feature))

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

function getSelectedFeature(layer: VectorLayer<VectorSource<Geometry>>) {
    const currentFeatures = layer.getSource().getFeatures()
    for (const feature of currentFeatures) {
        if (feature.get('selected')) {
            return feature
        }
    }  
}

function compareFeatures(selectedFeature: Feature<Geometry>, newFeature: Feature<Geometry>) {
    if (selectedFeature?.get('botId') === newFeature.get('botId') && selectedFeature?.get('startTime') === newFeature.get('startTime')) {
        return selectedFeature
    }
    return newFeature
}
