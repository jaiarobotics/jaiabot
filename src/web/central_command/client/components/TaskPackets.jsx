import { jaiaAPI } from "../../common/JaiaAPI"
import { Heatmap } from "ol/layer"
import VectorSource from 'ol/source/Vector'
import { Vector as OlVectorLayer } from 'ol/layer';
import KML from 'ol/format/KML'
import Collection from "ol/Collection"
import Feature from "ol/Feature"
import { Point } from "ol/geom"
import { getTransform } from "ol/proj"
import ImageLayer from 'ol/layer/Image';
import Projection from 'ol/proj/Projection';
import Static from 'ol/source/ImageStatic';
import { mdiConsoleNetwork } from "@mdi/js"
import {
	Circle as OlCircleStyle, Fill as OlFillStyle, Stroke as OlStrokeStyle, Style as OlStyle
} from 'ol/style';
import OlFeature from 'ol/Feature';
import OlIcon from 'ol/style/Icon';
import OlPoint from 'ol/geom/Point';
import diveLocation from '../icons/task_packet/DiveLocation.png'
import currentDirection from '../icons/task_packet/Arrow.png'
import botSelectedIcon from '../icons/bot-selected.svg'
import OlText from 'ol/style/Text';
// TurfJS
import * as turf from '@turf/turf';

const POLL_INTERVAL = 5000

const mercator = 'EPSG:3857'
const equirectangular = 'EPSG:4326'
const equirectangular_to_mercator = getTransform(equirectangular, mercator);
const mercator_to_equirectangular = getTransform(mercator, equirectangular);

export class TaskData {

    constructor() {
        this.pollTimer = setInterval(this._pollTaskPackets.bind(this), POLL_INTERVAL)
        
        this.collection = new Collection([])

        this.depthRange = [0, 1]

        this.taskPackets = []

        // Plot depth soundings using a heatmap
        this.heatMapLayer = new Heatmap({
            title: 'Depth',
            source: new VectorSource({
                features: this.collection
            }),
            gradient: ['#00f', '#0ff', '#0f0', '#ff0', '#f00', '#f00', '#f00', '#f00', '#f00'],
            radius: 16,
            blur: 32,
            zIndex: 25,
            weight: (feature) => {
                const weight = (feature.get('depth') - this.depthRange[0]) / (this.depthRange[1])
                return weight
            },
          })

        // Plot depth soundings using a contour plot

        this.contourLayer = new ImageLayer({
            title: 'Depth Contours',
            zIndex: 25,
            opacity: 0.5,
            source: null,
          })

        this.taskPacketDiveLayer = new OlVectorLayer({
            title: 'Dive Data',
            zIndex: 25,
            opacity: 1,
            source: null,
          })

        this.taskPacketDriftLayer = new OlVectorLayer({
            title: 'Drift Data',
            zIndex: 25,
            opacity: 1,
            source: null,
          })
    }

    updateContourPlot() {
        jaiaAPI.getContourMapBounds().then((bounds) => {
            const imageExtent = [bounds.x0, bounds.y0, bounds.x1, bounds.y1]

            const source = new Static({
                attributions: 'JaiaBot',
                url: '/jaia/contour-map',
                projection: equirectangular,
                imageExtent: imageExtent,
              })

            this.contourLayer.setSource(source)

            console.log('loaded: ', source)
        })
    }

/*
Task Packet
0: 
botId: 0
dive: 
    depthAchieved: 1
    diveRate: 0.5
    durationToAcquireGps: 0.3
    measurement: Array(1)
        0: 
        {meanDepth: 1, meanTemperature: 15, meanSalinity: 20}
        length: 1
    startLocation: 
        lat: 41.487142
        lon: -71.259441 
    unpoweredRiseRate: 0.3
drift: 
    driftDuration: 0
    endLocation: 
        lat: 41.487135
        lon: -71.259441
    startLocation: 
        lat: 41.487136
        lon: -71.259441
    endTime: "1664484912000000"
    startTime: "1664484905000000"
    type: "DIVE"
*/

    updateDiveLocations() {
        let taskDiveFeatures = []

        for (let [botId, taskPacket] of Object.entries(this.taskPackets)) {
            let divePacket = taskPacket.dive;
            let iconStyle = new OlStyle({
                image: new OlIcon({
                    src: diveLocation,
                    // the real size of your icon
                    size: [319, 299],
                    // the scale factor
                    scale: 0.1
                })
            });

            let pt = equirectangular_to_mercator([divePacket.startLocation.lon, divePacket.startLocation.lat])
            let diveFeature = new OlFeature({ geometry: new OlPoint(pt) })
            diveFeature.setStyle(iconStyle)   
            taskDiveFeatures.push(diveFeature)         
        }

        let diveVectorSource = new VectorSource({
            features: taskDiveFeatures
        })

        this.taskPacketDiveLayer.setSource(diveVectorSource)
    }

    updateDriftLocations() {
        let taskDriftFeatures = []

        for (let [botId, taskPacket] of Object.entries(this.taskPackets)) {
            let driftPacket = taskPacket.drift;
            
            let start = [driftPacket.startLocation.lon, driftPacket.startLocation.lat];
            let end = [driftPacket.endLocation.lon, driftPacket.endLocation.lat];

            let bearing = turf.bearing(start, end);

            let rotation = (bearing ?? 180) * (Math.PI / 180.0)

            let iconStyle = new OlStyle({
                image: new OlIcon({
                    src: currentDirection,
                    // the real size of your icon
                    size: [152, 793],
                    // the scale factor
                    scale: 0.05,
                    rotation: rotation,
                    rotateWithView : true
                }),
                text : new OlText({
                    font : `bold 16 helvetica,sans-serif`,
                    text : `Testinggggggggggg`,
                    overflow : true,
                    //scale: 1.3,
                    fill: new OlFillStyle({
                    color: '#000000'
                    }),
                    stroke: new OlStrokeStyle({
                    color: '#FFFF99',
                    width: 3.5
                    })
                  })
            });

            let pt = equirectangular_to_mercator([driftPacket.endLocation.lon, driftPacket.endLocation.lat])
            let driftFeature = new OlFeature({ geometry: new OlPoint(pt) })
            driftFeature.setStyle(iconStyle)   
            taskDriftFeatures.push(driftFeature)         
        }

        let driftVectorSource = new VectorSource({
            features: taskDriftFeatures
        })

        this.taskPacketDriftLayer.setSource(driftVectorSource)
    }

    _pollTaskPackets() {
        jaiaAPI.getTaskPackets().then((taskPackets) => {

            console.log('taskPackets.length = ', taskPackets.length)

            if (taskPackets.length > this.taskPackets.length) {
                console.log('new taskPackets arrived!')

                this.taskPackets = taskPackets

                console.log(this.taskPackets);
                this.updateDiveLocations();
                this.updateDriftLocations();

                if (taskPackets.length >= 3) {
                    console.log('Updating contour plot')
                    //this.updateContourPlot()
                }

            }

        })
    }

    getContourLayer() {
        return this.contourLayer
    }

    getTaskPacketDiveLayer() {
        return this.taskPacketDiveLayer
    }

    getTaskPacketDriftLayer() {
        return this.taskPacketDriftLayer
    }
    
}

export const taskData = new TaskData()
