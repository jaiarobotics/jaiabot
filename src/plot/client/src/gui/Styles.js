import Stroke from 'ol/style/Stroke';
import { Fill, Icon, Style, Text} from 'ol/style';
import { Point } from 'ol/geom';
import arrowHead from './arrowHead.svg'
import bottomStrike from './bottomStrike.svg'
import driftTaskPacket from './driftTaskPacket.svg'
import end from './end.svg'
import start from './start.svg'
import bot from './bot.svg'
import taskDive from './taskDive.svg'
import taskDrift from './taskDrift.svg'
import taskNone from './taskNone.svg'
import taskStationKeep from './taskStationKeep.svg'

export const startMarker = new Style({
    image: new Icon({
        src: start,
        anchor: [1/16, 1]
    })
})

export const endMarker = new Style({
    image: new Icon({
        src: end,
        anchor: [1/16, 1]
    })
})

export function botMarker(text, heading) {
    const headingRadians = heading * Math.PI / 180
    const dx = Math.sin(-headingRadians)
    const dy = Math.cos(headingRadians)
    const r = 15

    return new Style({
        image: new Icon({
            src: bot,
            anchor: [0.5, 0.5],
            rotation: headingRadians,
            rotateWithView: true
        }),
        text: new Text({
            text: new String(text),
            font: 'bold 13pt sans-serif',
            fill: new Fill({
                color: 'black'
            }),
            offsetX: r * dx,
            offsetY: r * dy
        })
    })
}


// Markers for the mission goals
export function goal(goalIndex, goal, isActive) {
    const srcMap = {
        'DIVE': taskDive,
        'STATION_KEEP': taskStationKeep,
        'SURFACE_DRIFT': taskDrift,
        'NONE': taskNone       
    }

    const src = srcMap[goal.task?.type ?? 'NONE'] ?? taskNone

    return new Style({
        image: new Icon({
            src: src,
            color: isActive ? 'chartreuse' : '#eee',
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
    const color = 'white'

    return new Style({
        image: new Icon({
            src: bottomStrike,
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
    const color = '#D07103'

    return new Style({
        image: new Icon({
            src: driftTaskPacket,
            anchor: [0.5, 0.908],
            color: color,
            scale: [1.0, drift.estimated_drift.speed / 0.20],
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
    const arrowColor = 'black'

    const geometry = feature.getGeometry()
    const styles = [
        new Style({
            stroke: new Stroke({
                width: 2,
                color: arrowColor
            })
        })
    ]

    geometry.forEachSegment(function (start, end) {
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        const midpoint = [start[0] + dx / 2, start[1] + dy / 2]
        const rotation = Math.atan2(dy, dx);

        // arrows
        styles.push(
            new Style({
                geometry: new Point(midpoint),
                image: new Icon({
                    src: arrowHead,
                    anchor: [1, 0.5],
                    rotateWithView: true,
                    rotation: -rotation,
                    color: arrowColor,
                }),
                zIndex: -1
            })
        );
    });

    return styles
}