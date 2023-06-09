import React, { useState } from 'react'
import {
    MissionTask,
    TaskType,
    DiveParameters,
    DriftParameters,
    ConstantHeadingParameters,
    GeographicCoordinate
} from './shared/JAIAProtobuf'
import { SelectChangeEvent } from '@mui/material'
import { GlobalSettings, Save } from './Settings'
import { deepcopy, getGeographicCoordinate } from './Utilities'
import { Button } from '@mui/material'
import { rhumbBearing, rhumbDistance } from '@turf/turf'
import Map from 'ol/Map'
import PointerInteraction from 'ol/interaction/Pointer'
import { toLonLat, transformWithProjections } from 'ol/proj'
import { Draw } from 'ol/interaction'
import { Vector as VectorLayer } from 'ol/layer'
import { Vector as VectorSource } from 'ol/source'
import { LineString, Point } from 'ol/geom'

// For keeping heading angles in the [0, 360] range
function fmod(a: number, b: number) {
    return Number((a - Math.floor(a / b) * b).toPrecision(8))
}

interface Props {
    map?: Map
    title?: string
    task?: MissionTask
    location?: GeographicCoordinate
    onChange?: (task?: MissionTask) => void
}

// TaskOptionsPanel
//   This panel is used to configure the task for some goal or set of goals.
//   It includes a dropdown to select the task type, and depending on the task type,
//   it presents the user with a set of configuration options relevant to that task
//   type.
function TaskOptionsPanel(props: Props) {
    const task = props.task
    if (task == null) return

    const [clickingMap, setClickingMap] = useState(false)

    function onChangeDiveParameter(evt: React.ChangeEvent<HTMLInputElement>) {
        const target = evt.target as any
        const key = target.name as keyof DiveParameters
        const value = Number(target.value)

        var newTask = deepcopy(task)
        newTask.dive[key] = value

        GlobalSettings.diveParameters[key] = value
        Save(GlobalSettings.diveParameters)

        props.onChange(newTask)
    }

    function onChangeDriftParameter(evt: React.ChangeEvent<HTMLInputElement>) {
        const target = evt.target as any
        const key = target.name as keyof DriftParameters
        const value = Number(target.value)

        var newTask = deepcopy(task)
        newTask.surface_drift[key] = value

        GlobalSettings.driftParameters[key] = value
        Save(GlobalSettings.driftParameters)

        props.onChange(newTask)
    }

    function onChangeConstantHeadingParameter(evt: React.ChangeEvent<HTMLInputElement>) {
        const target = evt.target as any
        const key = target.name as keyof ConstantHeadingParameters
        const value = Number(target.value)

        var newTask = deepcopy(task)
        newTask.constant_heading[key] = value

        GlobalSettings.constantHeadingParameters[key] = value
        Save(GlobalSettings.constantHeadingParameters)

        props.onChange(newTask)
    }

    // For selecting target for constant heading task type
    function selectOnMapClicked() {
        const { map, location } = props

        if (map == null) {
            console.warn('No map passed to the TaskSettingsPanel')
            return
        }

        // New layer for the constant heading line preview
        const source = new VectorSource({ wrapX: false })

        const vector = new VectorLayer({
            source: source
        })

        map.addLayer(vector)

        // New interaction to get two points
        let draw = new Draw({
            source: source,
            type: 'Point',
            stopClick: true
        })
        draw.stopDown = (handled) => {
            return handled
        }

        map.addInteraction(draw)
        setClickingMap(true)

        draw.on('drawend', (evt) => {
            map.removeLayer(vector)
            map.removeInteraction(draw)
            setClickingMap(false)

            if (location == null) {
                console.warn('No start location yet!')
                return
            }

            const feature = evt.feature
            const geometry = feature.getGeometry() as Point
            const endCoordinate = geometry.getCoordinates()
            const start = location
            const end = getGeographicCoordinate(endCoordinate, map)

            let constant_heading = task.constant_heading
            let speed = constant_heading?.constant_heading_speed

            // Guard
            if (start == null || constant_heading == null) {
                return false
            }

            if (speed == null) {
                console.error(`Constant heading task has speed == ${speed}`)
                return false
            }

            // Calculate heading and time from location and speed
            let rhumb_bearing = fmod(rhumbBearing([start.lon, start.lat], [end.lon, end.lat]), 360)
            constant_heading.constant_heading = Number(rhumb_bearing.toFixed(0))

            let rhumb_distance = rhumbDistance([start.lon, start.lat], [end.lon, end.lat], {
                units: 'meters'
            })
            let t = rhumb_distance / speed
            constant_heading.constant_heading_time = Number(t.toFixed(0))
        })
    }

    let dive = task.dive
    let surface_drift = task.surface_drift
    let constant_heading = task.constant_heading

    switch (task.type) {
        case TaskType.NONE:
            return <div>NONE</div>
            break
        case TaskType.DIVE:
            return (
                <div id='DiveDiv' className='task-options'>
                    <table className='DiveParametersTable'>
                        <tbody>
                            <tr>
                                <td>Max Depth</td>
                                <td>
                                    <input
                                        type='number'
                                        step='1'
                                        className='NumberInput'
                                        name='max_depth'
                                        defaultValue={dive.max_depth}
                                        onChange={onChangeDiveParameter}
                                    />{' '}
                                    m
                                </td>
                            </tr>
                            <tr>
                                <td>Depth Interval</td>
                                <td>
                                    <input
                                        type='number'
                                        step='1'
                                        className='NumberInput'
                                        name='depth_interval'
                                        defaultValue={dive.depth_interval}
                                        onChange={onChangeDiveParameter}
                                    />{' '}
                                    m
                                </td>
                            </tr>
                            <tr>
                                <td>Hold Time</td>
                                <td>
                                    <input
                                        type='number'
                                        step='1'
                                        className='NumberInput'
                                        name='hold_time'
                                        defaultValue={dive.hold_time}
                                        onChange={onChangeDiveParameter}
                                    />{' '}
                                    s
                                </td>
                            </tr>
                            <tr>
                                <td>Drift Time</td>
                                <td>
                                    <input
                                        type='number'
                                        step='1'
                                        className='NumberInput'
                                        name='drift_time'
                                        defaultValue={surface_drift.drift_time}
                                        onChange={onChangeDriftParameter}
                                    />{' '}
                                    s
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )

            break
        case TaskType.STATION_KEEP:
            return null
            break
        case TaskType.SURFACE_DRIFT:
            return (
                <div id='DriftDiv' className='task-options'>
                    <table className='DriftParametersTable'>
                        <tbody>
                            <tr>
                                <td>Drift Time</td>
                                <td>
                                    <input
                                        type='number'
                                        step='1'
                                        className='NumberInput'
                                        name='drift_time'
                                        defaultValue={surface_drift.drift_time}
                                        onChange={onChangeDriftParameter}
                                    />{' '}
                                    s
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )
            break
        case TaskType.CONSTANT_HEADING:
            function calculateDistance(speed: number, time: number) {
                if (speed == null || time == null) return null
                else return speed * time
            }

            const clickingMapClass = clickingMap ? ' clicking-map' : ''

            // Select on Map button is only present if a location is passed via Props
            const selectOnMapButton =
                props.location != null ? (
                    <Button
                        className={'button-jcc select-on-map' + clickingMapClass}
                        onClick={selectOnMapClicked}
                    >
                        Select on Map
                    </Button>
                ) : null

            return (
                <div id='ConstantHeadingDiv' className='task-options'>
                    {selectOnMapButton}
                    <table className='ConstantHeadingParametersTable'>
                        <tbody>
                            <tr>
                                <td>Heading</td>
                                <td>
                                    <input
                                        type='number'
                                        step='1'
                                        className='NumberInput'
                                        name='constant_heading'
                                        value={constant_heading.constant_heading.toFixed(0)}
                                        onChange={onChangeConstantHeadingParameter}
                                    />
                                </td>
                                <td>deg</td>
                            </tr>
                            <tr>
                                <td>Time</td>
                                <td>
                                    <input
                                        type='number'
                                        step='1'
                                        className='NumberInput'
                                        name='constant_heading_time'
                                        value={constant_heading.constant_heading_time.toFixed(0)}
                                        onChange={onChangeConstantHeadingParameter}
                                    />
                                </td>
                                <td>s</td>
                            </tr>
                            <tr>
                                <td>Speed</td>
                                <td>
                                    <input
                                        type='number'
                                        min='1'
                                        max='3'
                                        step='1'
                                        className='NumberInput'
                                        name='constant_heading_speed'
                                        value={constant_heading.constant_heading_speed.toFixed(0)}
                                        onChange={onChangeConstantHeadingParameter}
                                    />
                                </td>
                                <td>m/s</td>
                            </tr>
                            <tr>
                                <td>Distance</td>
                                <td style={{ textAlign: 'right' }}>
                                    {calculateDistance(
                                        constant_heading.constant_heading_speed,
                                        constant_heading.constant_heading_time
                                    )?.toFixed(1) ?? '?'}
                                </td>
                                <td>m</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )
            break
    }
}

export function TaskSettingsPanel(props: Props) {
    let taskOptionsPanel = <div></div>

    function onChangeTaskType(evt: React.ChangeEvent<HTMLSelectElement>) {
        const newTaskType = evt.target.value as TaskType
        const oldTaskType = props.task?.type ?? TaskType.NONE

        // No change
        if (newTaskType == oldTaskType) return

        // Change to NONE
        if (newTaskType == TaskType.NONE) {
            props.onChange(null)
            return
        }

        // Use default parameters depending on which type of task we've switched to
        var newTask: MissionTask = {
            type: newTaskType
        }

        switch (newTaskType) {
            case TaskType.CONSTANT_HEADING:
                newTask.constant_heading = deepcopy(GlobalSettings.constantHeadingParameters)
                break
            case TaskType.DIVE:
                newTask.dive = deepcopy(GlobalSettings.diveParameters)
                newTask.surface_drift = deepcopy(GlobalSettings.driftParameters)
                break
            case TaskType.SURFACE_DRIFT:
                newTask.surface_drift = deepcopy(GlobalSettings.driftParameters)
                break
        }

        props.onChange(newTask)
    }

    const title = props.title ?? 'Task'

    return (
        <div>
            {title}
            <select
                name='GoalType'
                id='GoalType'
                onChange={onChangeTaskType}
                value={props.task?.type ?? 'NONE'}
            >
                <option value='NONE'>None</option>
                <option value='DIVE'>Dive</option>
                <option value='SURFACE_DRIFT'>Surface Drift</option>
                <option value='STATION_KEEP'>Station Keep</option>
                <option value='CONSTANT_HEADING'>Constant Heading</option>
            </select>
            {TaskOptionsPanel(props)}
        </div>
    )
}
