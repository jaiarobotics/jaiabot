import { DivePacket, DriftPacket, TaskPacket } from './JAIAProtobuf'
import { GeographicCoordinate } from './JAIAProtobuf'
import { createMarker } from './Marker'

import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Geometry, LineString } from 'ol/geom'
import { fromLonLat } from 'ol/proj.js'
import { Feature } from 'ol'
import { Map } from 'ol'

import * as Styles from "./Styles"

interface TaskPacketCalcResults {
    dive_location?: GeographicCoordinate;
    driftSpeed: number;
    driftDirection: number;
}

function createDriftPacketFeature(map: Map, drift: DriftPacket, botId: number, startTime: number, endTime: number, driftDirection: number) {
    const projection = map.getView().getProjection()
    const start = fromLonLat([drift.start_location.lon, drift.start_location.lat], projection)
    const end = fromLonLat([drift.end_location.lon, drift.end_location.lat], projection)
    const coordinates = [start, end]
    const feature = new Feature({geometry: new LineString(coordinates)})
    feature.setProperties({
        'type': 'drift',
        'id': Math.random(),
        'duration': drift.drift_duration, // (s)
        'speed': drift.estimated_drift?.speed, // (m/s)
        'driftDirection': driftDirection,
        'sigWaveHeight': drift?.significant_wave_height,
        'botId': botId,
        'startTime': startTime,
        'endTime': endTime,
        'startLocation': drift.start_location,
        'selected': false,
        'animated': false
    })
    feature.setStyle(Styles.driftPacketIconStyle(feature))
    return feature
}

function createDivePacketFeature(map: Map, dive: DivePacket, botId: number, startTime: number, endTime: number) {
    const feature = createMarker(map, {title: 'dive', lon: dive.start_location.lon, lat: dive.start_location.lat})
    feature.setProperties({
        'type': 'dive',
        'id': Math.random(),
        'depthAchieved': dive.depth_achieved, // (m)
        'diveRate': dive.dive_rate, // (m/s)
        'bottomDive': dive.bottom_dive,
        'botId': botId,
        'startTime': startTime,
        'endTime': endTime,
        'startLocation': dive.start_location,
        'selected': false,
        'animated': false
    })
    feature.setStyle(Styles.divePacketIconStyle(feature))
    return feature
}

export function createTaskPacketFeatures(map: Map, taskPacket: TaskPacket, taskPacketLayer: VectorLayer<VectorSource<Geometry>>, makeTaskPacketCalculations: (taskPacket: TaskPacket) => TaskPacketCalcResults, index: number) {
    const features: any[] = []
    let selectedFeature = null

    // Add the selected feature to the features[]
    const currentFeatures = taskPacketLayer.getSource().getFeatures()
    for (const feature of currentFeatures) {
        if (feature.get('selected')) {
            selectedFeature = feature
            // Index used to prevent duplicate feature from being added to layer (OpenLayers throws error for duplicate features)
            if (index === 0) {
                features.push(feature)
            }
        }
    }

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
            if (
                selectedFeature?.get('startTime') === taskPacket?.start_time &&
                selectedFeature?.get('startLocation')?.lat === drift.start_location.lat &&
                selectedFeature?.get('startLocation')?.lon === drift.start_location.lon
            ) {
                // Drfit feature is the selected feature...adding it again would disrupt the flashing animation
            } else {
                const driftDirection = makeTaskPacketCalculations(taskPacket)?.driftDirection
                features.push(createDriftPacketFeature(map, drift, taskPacket?.bot_id, taskPacket?.start_time, taskPacket?.end_time, driftDirection))
            }
        }
    }

    if (taskPacket?.dive != undefined) {
        const dive = taskPacket.dive

        if (
            dive?.bottom_dive != undefined &&
            dive?.start_location != undefined &&
            dive?.start_location?.lat != undefined &&
            dive?.start_location?.lon != undefined &&
            dive?.depth_achieved != 0
        ) {
            if (
                selectedFeature?.get('startTime') === taskPacket?.start_time &&
                selectedFeature?.get('startLocation')?.lat === dive.start_location.lat &&
                selectedFeature?.get('startLocation')?.lon === dive.start_location.lon
            ) {
                // Dive feature is the selected feature...adding it again would disrupt the flashing animation
            } else {
                features.push(createDivePacketFeature(map, dive, taskPacket?.bot_id, taskPacket?.start_time, taskPacket?.end_time))
            }
        }
    }
    return features
}
