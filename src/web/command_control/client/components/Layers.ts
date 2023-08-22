import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import LayerGroup from 'ol/layer/Group';
import { taskData } from './TaskPackets';
import { createBaseLayerGroup } from './BaseLayers';
import BaseLayer from 'ol/layer/Base';
import { createChartLayerGroup } from './ChartLayers';
import { Collection, Graticule } from 'ol';
import * as Style from 'ol/style';


export class Layers {

    
    /**
     * Layer for the missions
     * @date 6/14/2023 - 5:14:33 PM
     *
     */
    missionLayer = new VectorLayer({
        properties: {
            title: 'Missions',
        },
        source: new VectorSource(),
        zIndex: 2001
    })

    
    /**
     * Layer for the actively running missions for each bot
     * @date 6/14/2023 - 5:16:26 PM
     *
     * @type {*}
     */
    activeMissionLayer = new VectorLayer({
        properties: {
            title: 'Active Missions',
        },
        source: new VectorSource(),
        zIndex: 999,
        opacity: 0.25
    })

    
    /**
     * Layer for planning survey missions
     * @date 6/14/2023 - 5:16:44 PM
     *
     * @type {*}
     */
    missionPlanningLayer = new VectorLayer({
        properties: { 
            name: 'missionPlanningLayer',
            title: 'Mission Planning'
        },
        source: new VectorSource(),
        zIndex: 2000
    });


    /**
     * Layer for rally point icons
     * @date 6/14/2023 - 5:17:23 PM
     *
     * @type {*}
     */
    rallyPointLayer = new VectorLayer({
        properties: {
            title: 'Rally Points'
        },
        source: new VectorSource(),
        zIndex: 1001,
    })


    courseOverGroundLayer = new VectorLayer({
        properties: {
            title: 'Course Over Ground'
            
        },
        source: new VectorSource(),
        visible: false,
        zIndex: 998
    })

    
    headingLayer = new VectorLayer({
        properties: {
            title: 'Heading'
        },
        source: new VectorSource(),
        visible: false,
        zIndex: 998
    })

    
    /**
     * Layer group for mission-related layers
     * @date 6/14/2023 - 5:17:34 PM
     *
     * @type {*}
     */
    missionLayerGroup = new LayerGroup({
        properties: {
            title: 'Mission',
            fold: 'close',
        },
        layers: [
            this.missionLayer,
            this.activeMissionLayer,
            this.rallyPointLayer,
            this.missionPlanningLayer,
            this.courseOverGroundLayer,
            this.headingLayer
        ]
    })
    
    
    /**
     * Layer for measurement features
     * @date 6/14/2023 - 5:19:11 PM
     *
     * @type {*}
     */
    measurementLayerGroup = new LayerGroup({
        properties: { 
            title: 'Measurements',
            fold: 'close',
        },
        layers: [
            taskData.getContourLayer(),
            taskData.getTaskPacketDiveInfoLayer(),
            taskData.getTaskPacketDriftInfoLayer(),
            taskData.getTaskPacketDiveBottomInfoLayer(),
            taskData.taskPacketInfoLayer
        ]
    })

    
    /**
     * Layer for the map's graticule (lon/lat grid)
     * @date 6/14/2023 - 5:19:27 PM
     *
     * @type {*}
     */
    graticuleLayer = new Graticule({
        // the style to use for the lines, optional.
        strokeStyle: new Style.Stroke({
            color: 'rgb(0,0,0)',
            width: 2,
            lineDash: [0.5, 4],
        }),
        zIndex: 30,
        opacity: 0.8,
        showLabels: true,
        wrapX: false,
    })

    
    dragAndDropVectorLayer = new VectorLayer()

    baseLayerGroup = createBaseLayerGroup()

    chartLayerGroup = createChartLayerGroup()

    getAllLayers() {
        return [
            this.baseLayerGroup,
            this.chartLayerGroup,
            this.measurementLayerGroup,
            this.graticuleLayer,
            this.missionLayerGroup,
            this.dragAndDropVectorLayer,
        ]
    }
}

export const layers = new Layers()
