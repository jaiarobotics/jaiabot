import Stroke from 'ol/style/Stroke';
import {Circle as CircleStyle, Fill, Icon, Style, Text} from 'ol/style';

export const startMarker = new Style({
    image: new CircleStyle({
        radius: 6,
        stroke: new Stroke({
            color: 'white',
            width: 2
        }),
        fill: new Fill({
            color: 'green',
        }),
    })
})

export const endMarker = new Style({
    image: new Icon({
        src: '/stop.svg',
    })
})

export const botMarker = function(feature) {
    return new Style({
        image: new CircleStyle({
            radius: 8,
            stroke: new Stroke({
                color: 'white',
                width: 2
            }),
            fill: new Fill({
                color: 'blue',
            }),
        })
    })
}


// Markers for the mission goals
export function goal(goalIndex, goal, isActive) {
    const srcMap = {
        'DIVE': '/taskDive.svg',
        'STATION_KEEP': '/taskStationKeep.svg',
        'SURFACE_DRIFT': '/taskDrift.svg',
        'NONE': '/taskNone.svg'        
    }

    const src = srcMap[goal.task?.type ?? 'NONE'] ?? '/taskNone.svg'
    console.log(goal, src)

    return new Style({
        image: new Icon({
            src: src,
            color: isActive ? '#64db4f' : '#bbb',
            anchor: [0.5, 1]
        }),
        text: new Text({
            text: new String(goalIndex),
            font: '12pt sans-serif',
            fill: new Fill({
                color: 'black'
            }),
            offsetY: -15
        })
    })
}


// Markers for dives
export function diveTask(dive) {

    // Depth text
    var text = dive.depth_achieved?.toFixed(1)
    if (text != null) {
        text = text + 'm'
    }
    else {
        text = ''
    }

    // Icon color
    const color = dive.bottom_dive ? 'red': 'white'

    return new Style({
        image: new Icon({
            src: '/bottomStrike.svg',
            color: color
        }),
        text: new Text({
            text: new String(text),
            font: '12pt sans-serif',
            fill: new Fill({
                color: 'black'
            }),
            offsetY: 20
        })
    })
}

// Markers for surface drift tasks
export function driftTask(drift) {

    // Icon color
    const color = 'white'

    return new Style({
        image: new Icon({
            src: '/driftTaskPacket.svg',
            color: color,
            rotateWithView: true,
            rotation: drift.estimated_drift.heading * Math.PI / 180.0,
        }),
        // text: new Text({
        //     text: new String(text),
        //     font: '12pt sans-serif',
        //     fill: new Fill({
        //         color: 'black'
        //     }),
        //     offsetY: 20
        // })
    })
}

// The mission path linestring
export function missionPath(feature) {
    return new Style({
        stroke: new Stroke({
            width: 2,
            color: 'black'
        })
    })
}