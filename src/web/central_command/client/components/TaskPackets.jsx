import { jaiaAPI } from "../../common/JaiaAPI"
import { Heatmap } from "ol/layer"
import VectorSource from 'ol/source/Vector'
import Collection from "ol/Collection"
import { getTransform } from "ol/proj"
import { Vector as VectorLayer } from "ol/layer"
import GeoJSON from 'ol/format/GeoJSON'
import {Circle as CircleStyle, Fill, Stroke, Style} from 'ol/style'
import {asString} from 'ol/color'

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

        this.contourLayer = new VectorLayer({
            title: 'Depth Contours',
            zIndex: 25,
            opacity: 0.5,
            source: null,
          })

    }

    _updateContourPlot() {
        jaiaAPI.getDepthContours().then((geojson) => {
                console.log('geojson = ', geojson)

                // Manually transform features from lon/lat to the view's projection.
                var features = new GeoJSON().readFeatures(geojson)
                features.forEach((feature) => {
                    // Transform to the map's mercator projection
                    feature.getGeometry().transform(equirectangular, mercator)

                    const properties = feature.getProperties()
                    const color = properties.color

                    feature.setStyle(new Style({
                        stroke: new Stroke({
                            color: color,
                            width: 2.0
                        })
                    }))

                })

                const vectorSource = new VectorSource({
                    features: features,
                    projection: equirectangular
                })
              
                this.contourLayer.setSource(vectorSource)
        })
    }

    _pollTaskPackets() {
        jaiaAPI.getTaskPackets().then((taskPackets) => {
            console.log('taskPackets.length = ', taskPackets.length)
            console.log('this.taskPackets.length = ', this.taskPackets.length)
            if (taskPackets.length != this.taskPackets.length) {
                this.taskPackets = taskPackets

                if (taskPackets.length >= 3) {
                    console.log('Updating contour plot')
                    this._updateContourPlot()
                }

            }

        })
    }

    getContourLayer() {
        return this.contourLayer
    }

}

export const taskData = new TaskData()
