import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import LayerGroup from 'ol/layer/Group';
import { createChartLayerGroup } from './ChartLayers';
import { createBaseLayerGroup } from './BaseLayers';
import { Graticule } from 'ol';
import { taskData } from './TaskPackets';
import * as Style from 'ol/style';
import * as Styles from './shared/Styles'


export class Layers {

    missionLayerSource = new VectorSource()

    /**
     * Layer for missions
     */
    missionLayer = new VectorLayer({
        properties: {
            title: 'Missions',
        },
        source: this.missionLayerSource,
        zIndex: 2001
    })

    /**
     * Layer for the actively running missions for each bot
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
     */
    rallyPointLayer = new VectorLayer({
        properties: {
            title: 'Rally Points'
        },
        source: new VectorSource(),
        zIndex: 999,
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

    
    waypointCircleLayer = new VectorLayer({
        properties: {
            title: 'Waypoint Capture Circles'
        },
        source: new VectorSource(),
        visible: true,
        zIndex: 998
    })

    
    /**
     * Layer group for mission-related layers
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
            this.headingLayer,
            this.waypointCircleLayer
        ]
    })
    
    /**
     * Layer for measurement features
     */
    measurementLayerGroup = new LayerGroup({
        properties: { 
            title: 'Measurements',
            fold: 'close',
        },
        layers: [
            taskData.getDiveLayer(),
            taskData.getContourLayer(),
            taskData.getDriftLayer(),
            taskData.getDriftMapLayer()
        ]
    })

    /**
     * Layer for the map's graticule (lon/lat grid)
     */
    graticuleLayer = new Graticule({
        // the style to use for the lines, optional
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

    constructor() {
        // We need to use setStyle in the constructor, because for some reason OpenLayers doesn't obey styles set in layer constructors
        this.waypointCircleLayer.setStyle(Styles.getWaypointCircleStyle)
    }

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
