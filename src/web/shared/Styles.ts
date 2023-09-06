import Stroke from 'ol/style/Stroke';
import { Feature } from 'ol'
import { LineString, Point } from 'ol/geom';
import { Fill, Icon, Style, Text} from 'ol/style';
import { Goal, DivePacket, TaskType } from './JAIAProtobuf'
import { PortalBotStatus, isRemoteControlled } from './PortalStatus';

// We use "require" here, so we can use the "as" keyword to tell TypeScript the types of these resource variables
const arrowHead = require('./arrowHead.svg') as string
const bottomStrike = require('./bottomStrike.svg') as string
const driftTaskPacket = require('./driftTaskPacket.svg') as string
const start = require('./start.svg') as string
const end = require('./end.svg') as string
const botIcon = require('./bot.svg') as string
const hubIcon = require('./hub.svg') as string
const rallyPoint = require('./rally.svg') as string
const runFlag = require('./run-flag.svg') as string
const botCourseOverGround = require('./botCourseOverGround.svg') as string
const botDesiredHeading = require('./botDesiredHeading.svg') as string
const taskDive = require('./taskDive.svg') as string
const taskDrift = require('./taskDrift.svg') as string
const taskStationKeep = require('./taskStationKeep.svg') as string
const taskConstantHeading = require('./taskConstantHeading.svg') as string
const satellite = require('./satellite.svg') as string
export const taskNone = require('./taskNone.svg') as string

// Export the PNG data for use in KMZ files
export const arrowHeadPng = require('./arrowHead.png') as string
export const bottomStrikePng = require('./bottomStrike.png') as string

// Colors
const defaultColor = 'white'
const defaultPathColor = 'white'
const activeGoalColor = 'chartreuse'
const selectedColor = 'turquoise'
const editColor = 'gold'
const remoteControlledColor = 'mediumpurple'
const driftArrowColor = 'darkorange'
const disconnectedColor = 'gray'

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

interface XYCoordinate {
    x: number
    y: number
}

export function botMarker(feature: Feature): Style[] {
    const geometry = feature.getGeometry() as Point
    const centerPosition = geometry.getCoordinates()

    function angleToXY(angle: number): XYCoordinate {
        return { x: Math.cos(Math.PI / 2 - angle), y: -Math.sin(Math.PI / 2 - angle) }
    }

    const botStatus = feature.get('bot') as PortalBotStatus
    const heading = (botStatus.attitude?.heading ?? 0.0) * DEG
    const headingDelta = angleToXY(heading)

    const textOffsetRadius = 11

    let color: string

    if (botStatus.isDisconnected ?? false) {
        color = disconnectedColor
    } else if (isRemoteControlled(botStatus.mission_state)) {
        color = remoteControlledColor
    } else if (feature.get('selected')) {
        color = selectedColor
    } else {
        color = defaultColor
    }

    const text = String(botStatus.bot_id ?? "")

    var style = [ 
        // Bot body marker
        new Style({
            image: new Icon({
                src: botIcon,
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
                offsetY: -textOffsetRadius * headingDelta.y,
                rotateWithView: true
            })
        })
    ]

    return style
}

export function hubMarker(feature: Feature): Style[] {
    const geometry = feature.getGeometry() as Point

    const textOffsetRadius = 11

    var color = defaultColor

    if (feature.get('selected')) {
        color = selectedColor
    }

    const text = "HUB"

    var style = [ 
        // Hub body marker
        new Style({
            image: new Icon({
                src: hubIcon,
                color: color,
                anchor: [0.5, 0.5],
                rotateWithView: true
            }),
            text: new Text({
                text: text,
                font: 'bold 11pt sans-serif',
                fill: new Fill({
                    color: 'black'
                }),
                offsetX: 0,
                offsetY: textOffsetRadius
            })
        })
    ]

    return style
}

export function courseOverGroundArrow(courseOverGround: number): Style {
    const courseOverGroundDeg = courseOverGround * DEG
    const color = 'green'

    return new Style({
        image: new Icon({
            src: botCourseOverGround,
            color: color,
            anchor: [0.5, 1.0],
            rotation: courseOverGroundDeg,
            rotateWithView: true
        })
    })
}

export function desiredHeadingArrow(feature: Feature): Style {
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

export function headingArrow(heading: number): Style {
    const finalHeading = heading * DEG
    const color = 'green'

    return new Style({
        image: new Icon({
            src: botDesiredHeading,
            color: color,
            anchor: [0.5, 1.0],
            rotation: finalHeading,
            rotateWithView: true
        })
    })
}

// Markers for the mission goals
function getGoalSrc(taskType: TaskType | null) {
    const srcMap: {[key: string]: string} = {
        'DIVE': taskDive,
        'STATION_KEEP': taskStationKeep,
        'SURFACE_DRIFT': taskDrift,
        'CONSTANT_HEADING': taskConstantHeading,
        'NONE': taskNone       
    }

    return srcMap[taskType ?? 'NONE'] ?? taskNone
}

export function createGoalIcon(taskType: TaskType | null, isActiveGoal: boolean, isSelected: boolean, canEdit: boolean) {
    if (!taskType) {
        taskType === TaskType.NONE
    }
    const src = getGoalSrc(taskType)
    let nonActiveGoalColor: string

    if (canEdit) {
        nonActiveGoalColor = isSelected ? editColor : defaultColor
    } else {
        nonActiveGoalColor = isSelected ? selectedColor : defaultColor
    }

    return new Icon({
        src: src,
        color: isActiveGoal ? activeGoalColor : nonActiveGoalColor,
        anchor: [0.5, 1],
    })
}


function createFlagIcon(taskType: TaskType | null, isSelected: boolean, runNumber: number, canEdit: boolean) {
    const isTask = taskType && taskType !== 'NONE'

    return new Icon({
        src: runFlag,
        color: isSelected ? (canEdit ? editColor : selectedColor) : defaultColor,
        // Need a bigger flag for a 3-digit run number...this also causes new anchor values
        anchor: runNumber > 99 ? (isTask ? [0.21, 1.85] : [0.21, 1.55]) : (isTask ? [0.21, 1.92] : [0.21, 1.62]),
        scale: runNumber > 99 ? 1.075 : 1.0
    })
}

function createGpsIcon() {
    return new Icon({
        src: satellite,
        color: driftArrowColor,
        anchor: [0.5, -1.25],
        scale: 1.25
    })
}

function createRallyIcon() {
    return new Icon({
        src: rallyPoint,
        scale: 0.35
    })
}

export function getGoalStyle(goalIndex: number, goal: Goal, isActive: boolean, isSelected: boolean, canEdit: boolean) {
    let icon = createGoalIcon(goal.task?.type, isActive, isSelected, canEdit)

    return new Style({
        image: icon,
        stroke: new Stroke({
            color: 'rgba(0, 0, 0, 0)',
            width: 50
        }),
        text: new Text({
            text: String(goalIndex),
            font: '12pt sans-serif',
            fill: new Fill({
                color: 'black'
            }),
            offsetY: -15
        }),
        zIndex: isSelected ? 102 : 2
    })
}

export function getFlagStyle(goal: Goal, isSelected: boolean, runNumber: string, zIndex: number, canEdit: boolean) {
    let icon = createFlagIcon(goal.task?.type, isSelected, Number(runNumber), canEdit)
    const isTask = goal.task?.type && goal.task.type !== 'NONE'

    return new Style({
        image: icon,
        text: new Text({
            text: `R${runNumber}`,
            font: '12pt sans-serif',
            fill: new Fill({
                color: 'black'
            }),
            // Text needs additional adjustments for 3-digit run numbers
            offsetY: Number(runNumber) > 99 ? isTask ? -78.875 : -62.125 : isTask ? -76.75 : -61.2175,
            offsetX: Number(runNumber) > 99 ? 24 : 20
        }),
        zIndex: isSelected ? 102 : 2
    })
}

export function getGpsStyle() {
    return new Style({
        image: createGpsIcon(),
        zIndex: 104 // One higher than the bot's zIndex to prevent to the bot from covering the icon
    })
}

export function getRallyStyle(rallyFeatureCount: number) {
    return new Style({
        image: createRallyIcon(),
        text: new Text({
            text: rallyFeatureCount.toString(),
            font: '12pt sans-serif',
            fill: new Fill({
                color: 'black'
            }),
            offsetY: 9,
            offsetX: 0
        }),
    })
}

// Markers for dives
export function divePacketIconStyle(feature: Feature, animationColor?: string) {
    // Depth text
    let text = feature.get('depthAchieved') ? feature.get('depthAchieved').toFixed(1) : null
    if (text != null) {
        text = text + 'm'
    } else {
        text = ''
    }

    // Icon color
    const color = 'white'

    return new Style({
        image: new Icon({
            src: bottomStrike,
            color: animationColor ? animationColor : color
        }),
        text: new Text({
            text: String(text),
            font: '14pt sans-serif',
            fill: new Fill({
                color: 'white'
            }),
            stroke: new Stroke({
                color: 'black',
                width: 3
            }),
            offsetY: 20
        })
    })
}


interface EstimatedDrift {
    speed: number
    heading: number
}


interface DriftTask {
    estimated_drift: EstimatedDrift
}



interface EstimatedDrift {
    speed: number
    heading: number
}


interface DriftTask {
    estimated_drift: EstimatedDrift
}


// Markers for surface drift tasks
export function driftTask(drift: DriftTask) {

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
        })
    })
}

// The mission path linestring
export function missionPath(feature: Feature) {
    const isSelected = feature.get('isSelected') ?? false
    const zIndex = isSelected ? 101 : 1
    const canEdit = feature.get('canEdit')
    let pathColor = ''
    
    if (canEdit) {
        pathColor = isSelected ? editColor : defaultPathColor
    } else {
        pathColor = isSelected ? selectedColor : defaultPathColor
    }

    const lineDash = (feature.get('isConstantHeading') ?? false) ? [6, 12] : undefined

    const geometry = feature.getGeometry() as LineString

    const styles = [
        new Style({
            stroke: new Stroke({
                width: 4,
                color: 'black',
                lineDash: lineDash
            })
        }),
        new Style({
            stroke: new Stroke({
                width: 2,
                color: pathColor,
                lineDash: lineDash
            }),
            zIndex: zIndex
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
                zIndex: zIndex
            })
        );
    });

    return styles
}

// Drift task linestring
export function driftPacketIconStyle(feature: Feature, animationColor?: string) {
    const color = driftArrowColor

    const geometry = feature.getGeometry() as LineString
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
                color: animationColor ? animationColor : color
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
                    color: animationColor ? animationColor : color
                }),
                zIndex: 1
            })
        );
    });

    return styles
}
