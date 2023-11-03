import Stroke from 'ol/style/Stroke';
import { Feature } from 'ol'
import { Goal, HubStatus, TaskType } from './JAIAProtobuf'
import { LineString, Point, Circle } from 'ol/geom';
import { Circle as CircleStyle, Fill, Icon, Style, Text } from 'ol/style';
import { Coordinate } from 'ol/coordinate';
import { PortalBotStatus } from './PortalStatus';
import { colorNameToHex } from './Color';
import './MapColors.less'

// We use "require" here, so we can use the "as" keyword to tell TypeScript the types of these resource variables
const driftMapIcon = require('./driftMapIcon.svg') as string
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
const arrowHead = require('./arrowHead.svg') as string
const bottomStrike = require('./bottomStrike.svg') as string
const satellite = require('./satellite.svg') as string
export const taskNone = require('./taskNone.svg') as string

// Export the PNG data for use in KMZ files
export const arrowHeadPng = require('./arrowHead.png') as string
export const bottomStrikePng = require('./bottomStrike.png') as string


function styleFromClass(className: string) {
    const dummyElement = document.createElement('div')
    document.body.appendChild(dummyElement)
    dummyElement.className = className
    const computedStyle = JSON.parse(JSON.stringify(getComputedStyle(dummyElement))) as CSSStyleDeclaration
    document.body.removeChild(dummyElement)
    return computedStyle
}


const selectedColor = styleFromClass('selected-bot').backgroundColor


// Colors
const defaultColor = 'white'
const defaultPathColor = 'white'
const activeGoalColor = 'chartreuse'
const editColor = 'gold'
const remoteControlledColor = 'mediumpurple'
const driftArrowColor = 'darkorange'
const disconnectedColor = 'gray'

const DEG = Math.PI / 180
const SELECTED_Z_INDEX = 990 // Needs to be larger than the number of runs created in a session (determines increment) otherwise unselected features would have a higher z-index than selected features

interface XYCoordinate {
    x: number
    y: number
}

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

export function botMarker(feature: Feature): Style[] {
    const geometry = feature.getGeometry() as Point
    const centerPosition = geometry.getCoordinates()

    function angleToXY(angle: number): XYCoordinate {
        return { x: Math.cos(Math.PI / 2 - angle), y: -Math.sin(Math.PI / 2 - angle) }
    }

    const botStatus = feature.get('bot') as PortalBotStatus
    const heading = (botStatus?.attitude?.heading ?? 0.0) * DEG

    const headingDelta = angleToXY(heading)

    const textOffsetRadius = 11

    let color: string

    if (botStatus?.isDisconnected ?? false) {
        color = disconnectedColor
    } 
    else if (feature.get('rcMode')) {
        color = remoteControlledColor
    } else if (feature.get('selected')) {
        color = selectedColor
    } else {
        color = defaultColor
    }

    const text = String(botStatus?.bot_id ?? "")

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

    if (botStatus?.mission_state?.includes('REACQUIRE_GPS')) {
        style.push(getGpsStyle(heading))
    }

    return style
}

export function hubMarker(feature: Feature<Point>): Style[] {
    const hub = feature.get('hub') as HubStatus

    const textOffsetRadius = 11

    var color = defaultColor

    if (feature.get('selected')) {
        color = selectedColor
    }

    const text = "HUB"

    var markerStyle = 
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

    return [ markerStyle ]
}



/**
 * The style for the circles showing the comms limit radii for hubs
 * @date 10/27/2023 - 7:36:33 AM
 *
 * @export
 * @param {Feature<Point>} feature Point feature of a hub
 */
export function hubCommsCircleStyle(feature: Feature<Point>) {
    const hub = feature.get('hub') as HubStatus
    if (hub == null) {
        console.warn("Feature doesn't have hub property")
        return
    }
    const center = feature.getGeometry().getCoordinates()

    // The reason we need to divide by the cosine of the 
    // latitude is because the map is using a Mercator projection, (with units in meters at the equator)
    const latitudeCoefficient = Math.max(Math.cos((hub.location?.lat ?? 0) * DEG), 0.001) // To avoid division by zero
    const commsInnerRadius = 250.0 / latitudeCoefficient
    const commsOuterRadius = 500.0 / latitudeCoefficient

    function getCircleStyle(center: Coordinate, radius: number, color: string, lineWidth: number) {
        return new Style({
            geometry: new Circle(center, radius),
            renderer(coordinates: Coordinate[], state) {
                const [[x, y], [x1, y1]] = coordinates
                const dx = x1 - x
                const dy = y1 - y
                const screenRadius = Math.sqrt(dx * dx + dy * dy)

                const ctx = state.context

                ctx.beginPath()
                ctx.arc(x, y, screenRadius, 0, 2 * Math.PI, true)
                ctx.strokeStyle = color
                ctx.lineWidth = lineWidth
                ctx.stroke()
            }
        })
    }

    const commsInnerRadiusStyle = getCircleStyle(center, commsInnerRadius, 'rgba(0,128,0,0.6)', 5)
    const commsOuterRadiusStyle = getCircleStyle(center, commsOuterRadius, 'rgba(128,0,0,0.6)', 5)
        
    return [ commsInnerRadiusStyle, commsOuterRadiusStyle ]
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

export function headingArrow(heading: number): Style {
    const color = 'green'

    return new Style({
        image: new Icon({
            src: botDesiredHeading,
            color: color,
            anchor: [0.5, 1.0],
            rotation: heading * DEG,
            rotateWithView: true
        })
    })
}

export function desiredHeadingArrow(feature: Feature): Style {
    const desiredHeading = feature.get('desiredHeading') as number ?? 0.0
    return headingArrow(desiredHeading)
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

function getGoalColor(isActiveGoal: boolean, isSelected: boolean, canEdit: boolean) {
    let nonActiveGoalColor: string

    if (canEdit) {
        nonActiveGoalColor = isSelected ? editColor : defaultColor
    } else {
        nonActiveGoalColor = isSelected ? selectedColor : defaultColor
    }

    return isActiveGoal ? activeGoalColor : nonActiveGoalColor
}

export function createGoalIcon(taskType: TaskType | null | undefined, isActiveGoal: boolean, isSelected: boolean, canEdit: boolean) {
    taskType = taskType ?? TaskType.NONE
    const src = getGoalSrc(taskType)
    const color = getGoalColor(isActiveGoal, isSelected, canEdit)

    return new Icon({
        src: src,
        color: color,
        anchor: [0.5, 1],
    })
}


function createFlagIcon(taskType: TaskType | null | undefined, isSelected: boolean, runNumber: number, canEdit: boolean) {
    const isTask = taskType && taskType !== 'NONE'

    return new Icon({
        src: runFlag,
        color: isSelected ? (canEdit ? editColor : selectedColor) : defaultColor,
        // Need a bigger flag for a 3-digit run number...this also causes new anchor values
        anchor: runNumber > 99 ? (isTask ? [0.21, 1.85] : [0.21, 1.55]) : (isTask ? [0.21, 1.92] : [0.21, 1.62]),
        scale: runNumber > 99 ? 1.075 : 1.0
    })
}

function createRallyIcon() {
    return new Icon({
        src: rallyPoint,
        scale: 0.35
    })
}


/**
 * Goal / Waypoint map style function
 * @date 10/23/2023 - 8:58:49 AM
 *
 * @export
 * @param {Feature<Point>} feature
 * @returns {{}} Style(s) for the feature
 */
export function getGoalStyle(feature: Feature<Point>) {
    const goal = feature.get('goal') as Goal
    const isActive = feature.get('isActive') as boolean
    const isSelected = feature.get('isSelected') as boolean
    const canEdit = feature.get('canEdit') as boolean
    const goalIndex = feature.get('goalIndex') as number
    const zIndex = feature.get('zIndex') as number

    let icon = createGoalIcon(goal.task?.type, isActive, isSelected, canEdit)

    const markerStyle = new Style({
        image: icon,
        stroke: new Stroke({
            color: 'black',
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
        zIndex: isSelected ? SELECTED_Z_INDEX : zIndex
    })

    return markerStyle
}



/**
 * Gets the style to apply to the waypoint circle layer
 * @date 10/25/2023 - 12:29:46 PM
 *
 * @export
 * @param {Feature<Point>} feature The waypoint circle feature
 */
export function getWaypointCircleStyle(feature: Feature<Point>) {
    const goal = feature.get('goal') as Goal
    const isActive = feature.get('isActive') as boolean
    const isSelected = feature.get('isSelected') as boolean
    const canEdit = feature.get('canEdit') as boolean

    //The reason we need to divide by the cosine of the 
    // latitude is because the map is using a Mercator projection, (with units in meters at the equator)
    const latitudeCoefficient = Math.max(Math.cos((goal.location.lat ?? 0) * DEG), 0.001)
    const captureRadius = 5.0 / latitudeCoefficient // meters, MOOS configuration from templates/bot/bot.bhv.in
    const centerCoordinate = feature.getGeometry().getCoordinates()
    const colorName = getGoalColor(isActive, isSelected, canEdit)
    const colorMain = colorNameToHex(colorName) ?? colorName
    const colorBorder = colorNameToHex('black')

    function getCircleStyle(center: Coordinate, radius: number, color: string, lineWidth: number, addInnerGradientColor: boolean) {
        return new Style({
            geometry: new Circle(center, radius),
            renderer(coordinates: Coordinate[], state) {
                const [[x, y], [x1, y1]] = coordinates
                const dx = x1 - x
                const dy = y1 - y

                const ctx = state.context;
                const radius = Math.sqrt(dx * dx + dy * dy);
                
                if (addInnerGradientColor)
                {
                    const innerRadius = 0;
                    const outerRadius = radius * 1.4;

                    const gradient = ctx.createRadialGradient(x,y,innerRadius,x,y,outerRadius);
                    gradient.addColorStop(0,   `${color}00`);
                    gradient.addColorStop(0.6, `${color}33`);
                    gradient.addColorStop(1,   `${color}cc`);
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, 2 * Math.PI, true);
                    ctx.fillStyle = gradient;
                    ctx.fill();
                }
                
                ctx.arc(x, y, radius, 0, 2 * Math.PI, true);
                ctx.strokeStyle = color;
                ctx.lineWidth = lineWidth;
                ctx.stroke();
            }
        })
    }

    const mainRadiusStyle = getCircleStyle(centerCoordinate, captureRadius, colorMain, 5, true)
    const borderRadiusStyle = getCircleStyle(centerCoordinate, captureRadius, colorBorder, 1, false)

    return [ mainRadiusStyle, borderRadiusStyle ]

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
        zIndex: isSelected ? SELECTED_Z_INDEX : zIndex
    })
}

function getGpsStyle(headingRadians: number) {
    return new Style({
        image: new Icon({
            src: satellite,
            color: driftArrowColor,
            anchor: [0.5, -1.25],
            scale: 1.25,
            rotation: headingRadians,
            rotateWithView: true
        }),
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
export function divePacketIconStyle(feature: Feature, animatedColor?: string) {
    // Depth text
    let text = feature.get('depthAchieved') ? feature.get('depthAchieved').toFixed(1) : null
    if (text != null) {
        text = text + 'm'
    } else {
        text = ''
    }

    // Icon color
    const color = animatedColor ? animatedColor : 'white'

    return new Style({
        image: new Icon({
            src: bottomStrike,
            color: color
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

export function driftPacketIconStyle(feature: Feature, animatedColor?: string) {
    // 6 bins for drift speeds of 0 m/s to 2.5+ m/s
    // Bin numbers (+ 1) correspond with the number of tick marks on the drift arrow visually indicating the speed of the drift to the operator
    const binValueIncrement = 0.5
    let binNumber = Math.floor(feature.get('speed') / binValueIncrement)

    const defaultSrc = require(`./drift-arrows/drift-arrow-${binNumber}.svg`)
    const animatedSrc = require(`./drift-arrows/drift-arrow-animated-${binNumber}.svg`)
    let src = animatedColor === 'black' ? animatedSrc : defaultSrc
    
    return new Style({
        image: new Icon({
            src: src,
            rotation: feature.get('driftDirection') * DEG,
            rotateWithView: true,
            scale: 0.7
        }),
    })
}

export function driftMapStyle(feature: Feature) {
    // 6 bins for drift speeds of 0 m/s to 2.5+ m/s
    // Bin numbers (+ 1) correspond with the number of tick marks on the drift arrow visually indicating the speed of the drift to the operator
    const heading = feature.get('heading') as number
    const speed = feature.get('speed') as number

    const binValueIncrement = 0.5
    let binNumber = Math.floor(speed / binValueIncrement)

    const src = require(`./drift-arrows/drift-arrow-${binNumber}.svg`)
    
    return new Style({
        image: new Icon({
            src: src,
            rotation: heading * DEG,
            rotateWithView: true,
            scale: 0.68
        }),
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

        // Arrows
        styles.push(
            new Style({
                geometry: new Point(midpoint),
                image: new Icon({
                    src: arrowHead,
                    anchor: [0.5, 0.5],
                    rotateWithView: true,
                    rotation: -rotation, // OpenLayers rotates clockwise, while atan2 calculates a counter-clockwise rotation (as is customary in trig)
                    color: pathColor,
                }),
                zIndex: zIndex
            })
        );
    });

    return styles
}
