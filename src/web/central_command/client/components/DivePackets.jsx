import { jaiaAPI } from "../../common/JaiaAPI"
import { Heatmap } from "ol/layer"
import VectorSource from 'ol/source/Vector'
import KML from 'ol/format/KML'
import Collection from "ol/Collection"
import Feature from "ol/Feature"
import { Point } from "ol/geom"
import { getTransform } from "ol/proj"
import ImageLayer from 'ol/layer/Image';
import Projection from 'ol/proj/Projection';
import Static from 'ol/source/ImageStatic';

const POLL_INTERVAL = 5000

const mercator = 'EPSG:3857'
const equirectangular = 'EPSG:4326'
const equirectangular_to_mercator = getTransform(equirectangular, mercator);
const mercator_to_equirectangular = getTransform(mercator, equirectangular);

export class DiveData {

    constructor() {
        this.pollTimer = setInterval(this.pollDivePackets.bind(this), POLL_INTERVAL)
        
        this.collection = new Collection([])

        this.depthRange = [0, 1]

        this.divePackets = []

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

    pollDivePackets() {
        jaiaAPI.getDivePackets().then((divePackets) => {
            console.log('divePackets.length = ', divePackets.length)
            if (divePackets.length > this.divePackets.length) {
                console.log('new divePackets arrived!')
                this.divePackets = divePackets

                if (divePackets.length >= 3) {
                    console.log('Updating contour plot')
                    this.updateContourPlot()
                }

            }

        })
    }

    getContourLayer() {
        return this.contourLayer
    }

}

export const diveData = new DiveData()
