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

    missionLayer = new VectorLayer()

    selectedMissionLayer = new VectorLayer({
        properties: {
            title: 'Selected Mission',
        },
        source: new VectorSource(),
        zIndex: 1001
    })

    activeMissionLayer = new VectorLayer({
        properties: {
            title: 'Active Missions',
        },
        source: new VectorSource(),
        zIndex: 999,
        opacity: 0.25
    })

    missionPlanningLayer = new VectorLayer({
        properties: { 
            name: 'missionPlanningLayer',
            title: 'Mission Planning'
        },
    });

    exclusionsLayer = new VectorLayer({
        properties: { 
            name: 'exclusionsLayer',
            title: 'Mission Exclusion Areas'
        }
    });

    missionLayerGroup = new LayerGroup({
        properties: {
            title: 'Mission',
            fold: 'close',
        },
        layers: [
            this.activeMissionLayer,
            this.missionPlanningLayer,
            //this.exclusionsLayer,
            this.selectedMissionLayer
        ]
    })
        
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

    measureLayer = new VectorLayer({
        source: new VectorSource(),
        style: new Style.Style({
            fill: new Style.Fill({
                color: 'rgba(255, 255, 255, 0.2)'
            }),
            stroke: new Style.Stroke({
                color: '#ffcc33',
                width: 2
            }),
            image: new Style.Circle({
                radius: 7,
                fill: new Style.Fill({
                    color: '#ffcc33'
                })
            })
        })
    });

    dragAndDropVectorLayer = new VectorLayer()

    baseLayerGroup = createBaseLayerGroup()

    chartLayerGroup = createChartLayerGroup()

    all: BaseLayer[]

    constructor() {
        this.all = [
            this.baseLayerGroup,
            this.chartLayerGroup,
            this.measurementLayerGroup,
            this.graticuleLayer,
            this.measureLayer,
            this.missionLayer,
            this.missionLayerGroup,
            this.dragAndDropVectorLayer,
        ]

    }

}

export const layers = new Layers()
