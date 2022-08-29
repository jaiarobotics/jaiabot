import { jaiaAPI } from "../../common/JaiaAPI"
import { Heatmap } from "ol/layer"
import VectorSource from 'ol/source/Vector'
import KML from 'ol/format/KML'
import Collection from "ol/Collection"
import Feature from "ol/Feature"
import { Point } from "ol/geom"
import { getTransform } from "ol/proj"

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

        this.heatMapLayer = new Heatmap({
            title: 'Depth',
            source: new VectorSource({
                features: this.collection
            }),
            zIndex: 25,
            weight: (feature) => {
                return (feature.get('depth') - this.depthRange[0]) / (this.depthRange[1] + 0.01)
            },
          })
    }

    pollDivePackets() {
        jaiaAPI.getDivePackets().then((divePackets) => {
            this.divePackets = divePackets

            this.collection.clear()

            // Get the depth range for plotting

            const depths = divePackets.map((divePacket) => divePacket.depthAchieved)
            var min = 0
            var max = depths.reduce((a, b) => Math.max(a, b), -Infinity)

            if (min == max) {
                min -= 1.0
            }

            this.depthRange = [min, max - min]
            
            for (const divePacket of this.divePackets) {
                var feature = new Feature({
                    name: 'depthAchieved',
                    geometry: new Point(equirectangular_to_mercator([divePacket.location.lon, divePacket.location.lat]))
                })

                feature.set('depth', divePacket.depthAchieved)

                this.collection.push(feature)
            }
        })
    }

    getHeatMapLayer() {
        return this.heatMapLayer
    }

}

export const diveData = new DiveData()
