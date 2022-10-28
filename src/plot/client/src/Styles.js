import Stroke from 'ol/style/Stroke';
import {Circle as CircleStyle, Fill, Icon, Style, Text} from 'ol/style';
import { Point } from 'ol/geom';

export const startMarker = new Style({
    image: new Icon({
        src: '/start.svg',
        anchor: [1/16, 1]
    })
})

export const endMarker = new Style({
    image: new Icon({
        src: '/end.svg',
        anchor: [1/16, 1]
    })
})

export function botMarker(heading) {
    return new Style({
        image: new Icon({
            src: '/bot.svg',
            anchor: [0.5, 0.5],
            rotation: heading * Math.PI / 180,
            rotateWithView: true
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
            color: isActive ? 'darkgreen' : '#eee',
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
                    src: 'arrowHead.svg',
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