// Jaia Imports
import { geoJSONToDepthContourFeatures } from "./shared/Contours"
import { createTaskPacketFeatures } from './shared/TaskPacketFeatures'
import { TaskPacket } from "./shared/JAIAProtobuf"
import { jaiaAPI } from "../../common/JaiaAPI"

// Open Layer Imports
import VectorSource from 'ol/source/Vector'
import Collection from "ol/Collection"
import Feature from "ol/Feature"
import { Map } from "ol"
import { Vector as VectorLayer } from "ol/layer"

// Constants
const POLL_INTERVAL = 5000

export class TaskData {
    map: Map
    pollTimer = setInterval(this._pollTaskPackets.bind(this), POLL_INTERVAL)
    collection: Collection<Feature> = new Collection([])
    depthRange = [0, 1]
    taskPackets: TaskPacket[] = []

    // Layers
    contourLayer: VectorLayer<VectorSource> = new VectorLayer({
        properties: {
            title: 'Depth Contours',
        },
        zIndex: 25,
        opacity: 0.5,
        source: null,
        visible: false,
      })

    taskPacketInfoLayer = new VectorLayer({
        properties: {
            title: 'Task Packets',
        },
        zIndex: 1001,
        opacity: 1,
        source: new VectorSource(),
        visible: false
    })

    _updateContourPlot() {
        jaiaAPI.getDepthContours().catch((error) => {
            console.error(error)
        }).then((geojson) => {
            const features = geoJSONToDepthContourFeatures(this.map.getView().getProjection(), geojson)

            const vectorSource = new VectorSource({
                features: features
            })
            
            this.contourLayer.setSource(vectorSource)
        })
    }

    _pollTaskPackets() {
        jaiaAPI.getTaskPackets().catch((error) => {
            console.error(error)
        }).then((taskPackets: TaskPacket[]) => {

            if (taskPackets.length != this.taskPackets.length) {
                this.taskPackets = taskPackets

                if (taskPackets.length >= 3) {
                    this._updateContourPlot()
                }

            }

            const taskPacketFeatures = taskPackets.map(taskPacket => createTaskPacketFeatures(this.map, taskPacket)).flat()

            this.taskPacketInfoLayer.getSource().clear()
            this.taskPacketInfoLayer.getSource().addFeatures(taskPacketFeatures)
        })
    }

    getContourLayer() {
        return this.contourLayer
    }
}

export const taskData = new TaskData()
