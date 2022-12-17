import Stroke from 'ol/style/Stroke';
import { Fill, Icon, Style, Text} from 'ol/style';
import { LineString, Point } from 'ol/geom';
import arrowHead from './arrowHead.svg'
import bottomStrike from './bottomStrike.svg'
import driftTaskPacket from './driftTaskPacket.svg'
import end from './end.svg'
import start from './start.svg'
import bot from './bot.svg'
import botCourseOverGround from './botCourseOverGround.svg'
import botDesiredHeading from './botDesiredHeading.svg'
import taskDive from './taskDive.svg'
import taskDrift from './taskDrift.svg'
import taskNone from './taskNone.svg'
import taskStationKeep from './taskStationKeep.svg'

// Colors
const defaultColor = 'white'
const defaultPathColor = 'white'
const activeGoalColor = 'chartreuse'
const selectedColor = 'turquoise'
const driftArrowColor = 'darkorange'
const disconnectedColor = 'red'
const remoteControlledColor = 'mediumpurple'

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

const DEG = Math.PI / 180

export function botMarker(feature) {
    const centerPosition = feature.getGeometry().getCoordinates()

    function angleToXY(angle) {
        return { x: Math.cos(Math.PI / 2 - angle), y: -Math.sin(Math.PI / 2 - angle) }
    }

    const heading = feature.get('heading') * DEG
    const headingDelta = angleToXY(heading)

    const textOffsetRadius = 11

    var color = defaultColor

    if (feature.get('isDisconnected')) {
        color = disconnectedColor
    }
    else if (feature.get('remoteControlled')) {
        color = remoteControlledColor
    }
    else if (feature.get('selected')) {
        color = selectedColor
    }

    const text = new String(feature.get('botId'))

    return [ 
        // Bot body marker
        new Style({
            image: new Icon({
                src: bot,
                color: color,
                anchor: [0.5, 0.5],
                rotation: heading,
                rotateWithView: true
            }),
            text: new Text({
                text: text,
                font: 'bold 11pt sans-serif',
                fill: new Fill({
                    color: 'black'
                }),
                offsetX: -textOffsetRadius * headingDelta.x,
                offsetY: -textOffsetRadius * headingDelta.y
            })
        })
    ]
}


export function courseOverGroundArrow(feature) {
    const courseOverGround = feature.get('courseOverGround') * DEG
    const color = 'green'

    return new Style({
        image: new Icon({
            src: botCourseOverGround,
            color: color,
            anchor: [0.5, 1.0],
            rotation: courseOverGround,
            rotateWithView: true
        })
    })
}


export function desiredHeadingArrow(feature) {
    const desiredHeading = feature.get('desiredHeading') * DEG
    const color = 'green'

    return new Style({
        image: new Icon({
            src: botDesiredHeading,
            color: color,
            anchor: [0.5, 1.0],
            rotation: desiredHeading,
            rotateWithView: true
        })
    })
}


// Markers for the mission goals
export function goal(goalIndex, goal, isActive, isSelected) {
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
            color: isActive ? activeGoalColor : (isSelected ? selectedColor : defaultColor),
            anchor: [0.5, 1],
        }),
        text: new Text({
            text: new String(goalIndex),
            font: '12pt sans-serif',
            fill: new Fill({
                color: 'black'
            }),
            offsetY: -15,
        }),
        zIndex: 2
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
    const pathColor = (feature.get('isSelected') ?? false) ? selectedColor : defaultPathColor

    const geometry = feature.getGeometry()

    const styles = [
        new Style({
            stroke: new Stroke({
                width: 4,
                color: 'black'
            })
        }),
        new Style({
            stroke: new Stroke({
                width: 2,
                color: pathColor
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
                    anchor: [0.5, 0.5],
                    rotateWithView: true,
                    rotation: -rotation,
                    color: pathColor,
                }),
                zIndex: 1
            })
        );
    });

    return styles
}

// The drift task linestring
export function driftArrow(feature) {
    const color = driftArrowColor

    const geometry = feature.getGeometry()
    const styles = [
        new Style({
            stroke: new Stroke({
                width: 6,
                color: 'black'
            })
        }),
        new Style({
            stroke: new Stroke({
                width: 4,
                color: color
            })
        })
    ]

    geometry.forEachSegment(function (start, end) {
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        const rotation = Math.atan2(dy, dx);

        // arrows
        styles.push(
            new Style({
                geometry: new Point(end),
                image: new Icon({
                    src: arrowHead,
                    anchor: [0, 0.5],
                    rotateWithView: true,
                    rotation: -rotation,
                    color: color,
                }),
                zIndex: 1
            })
        );
    });

    return styles
}
