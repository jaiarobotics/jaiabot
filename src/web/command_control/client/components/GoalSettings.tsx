/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React, { FormEvent } from 'react'
import Button from '@mui/material/Button';
import { GlobalSettings, Save } from './Settings'
import { Goal, TaskType, DiveParameters, DriftParameters, ConstantHeadingParameters, GeographicCoordinate } from './gui/JAIAProtobuf';
import { deepcopy } from './Utilities'
import { taskNone } from './gui/Styles';
import { rhumbDistance, rhumbBearing } from '@turf/turf';


// For keeping heading angles in the [0, 360] range
function fmod(a: number, b: number) { 
    return Number((a - (Math.floor(a / b) * b)).toPrecision(8))
}


interface Props {
    botId: number
    goalIndex: number
    goal: Goal
    onClose: () => void
    onChange: () => void
    getCoordinate: () => Promise<GeographicCoordinate>
}


export class GoalSettingsPanel extends React.Component {

    props: Props
    key: string
    oldGoal: Goal

    constructor(props: Props) {
        super(props)
        
        // This key is for React components
        this.key = `goal-${props.botId}-${props.goalIndex}`

        // Copy the original goal, for if user hits "cancel"
        this.oldGoal = deepcopy(props.goal)

        console.log("constructor called")
    }

    componentDidUpdate() {
        this.props.onChange?.()
    }

    render() {
        const { botId, goalIndex, goal } = this.props
        let self = this

        let taskOptionsPanel = <div></div>
        let taskType = goal.task?.type

        switch (taskType) {
            case 'DIVE':
                taskOptionsPanel = this.diveOptionsPanel()
                break;
            case 'SURFACE_DRIFT':
                taskOptionsPanel = this.driftOptionsPanel()
                break;
            case 'CONSTANT_HEADING':
                taskOptionsPanel = this.ConstantHeadingOptionsPanel()
                break;
            default:
                taskOptionsPanel = <div></div>
                break;
        }

        return (
        <div className="GoalSettingsPanel">
            <div className='HorizontalFlexbox'>
                <img src={taskNone} />
                <div className="goalSettingsHeader">Goal {goalIndex}</div>
                <div className="goalSettingsHeader">Bot {botId}</div>
            </div>
            <div>
                Task
                <select name="GoalType" id="GoalType" onChange={evt => self.changeTaskType(evt.target.value as TaskType) } defaultValue={taskType ?? "NONE"}>
                    <option value="NONE">None</option>
                    <option value="DIVE">Dive</option>
                    <option value="SURFACE_DRIFT">Surface Drift</option>
                    <option value="STATION_KEEP">Station Keep</option>
                    <option value="CONSTANT_HEADING">Constant Heading</option>
                </select>
                { taskOptionsPanel }

                <div className='HorizontalFlexbox'>
                    <Button className="button-jcc" onClick={this.cancelClicked.bind(this)}>Cancel</Button>
                    <Button className="button-jcc" onClick={this.doneClicked.bind(this)}>Done</Button>
                </div>

            </div>
        </div>
        )
    }

    changeTaskType(taskType: TaskType) {
        let {goal} = this.props

        if (taskType == goal.task?.type) {
            return
        }

        switch(taskType) {
            case 'DIVE':
                goal.task = {
                    type: taskType,
                    dive: deepcopy(GlobalSettings.diveParameters),
                    surface_drift: deepcopy(GlobalSettings.driftParameters)
                }
                break;
            case 'SURFACE_DRIFT':
                goal.task = {
                    type: taskType,
                    surface_drift: deepcopy(GlobalSettings.driftParameters)
                }
                break;
            case 'STATION_KEEP':
                goal.task = {
                    type: taskType
                }
                break;
            case 'CONSTANT_HEADING':
                goal.task = {
                    type: taskType,
                    constant_heading: deepcopy(GlobalSettings.constantHeadingParameters)
                }
                break;
            default:
                goal.task = null
                break;
        }
    }

    diveOptionsPanel() {
        const { goal } = this.props
        let dive = goal.task.dive
        let surface_drift = goal.task.surface_drift
        // console.log(`key = ${this.key}.drift.drift_time`)
        // console.log(`  defaultValue = ${surface_drift.drift_time}`)

        return (
            <div id="DiveDiv" className='task-options'>
                <table className="DiveParametersTable">
                    <tbody>
                        <tr>
                            <td>Max Depth</td>
                            <td><input key={`${this.key}.dive.max_depth`} type="number" step="1" className="NumberInput" name="max_depth" defaultValue={dive.max_depth} onChange={(this.changeDiveParameter.bind(this))} /> m</td>
                        </tr>
                        <tr>
                            <td>Depth Interval</td>
                            <td><input key={`${this.key}.dive.depth_interval`} type="number" step="1" className="NumberInput" name="depth_interval" defaultValue={dive.depth_interval} onChange={this.changeDiveParameter.bind(this)} /> m</td>
                        </tr>
                        <tr>
                            <td>Hold Time</td>
                            <td><input key={`${this.key}.dive.hold_time`} type="number" step="1" className="NumberInput" name="hold_time" defaultValue={dive.hold_time} onChange={this.changeDiveParameter.bind(this)} /> s</td>
                        </tr>
                        <tr>
                            <td>Drift Time</td>
                            <td><input key={`${this.key}.dive.drift_time`} type="number" step="1" className="NumberInput" name="drift_time" defaultValue={surface_drift.drift_time} onChange={this.changeDriftParameter.bind(this)} /> s</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        )
    }

    changeDiveParameter(evt: FormEvent) {
        const target = evt.target as any
        const key = target.name as (keyof DiveParameters)
        const value = Number(target.value)
        var {goal} = this.props

        goal.task.dive[key] = value

        GlobalSettings.diveParameters[key] = value
        Save(GlobalSettings.diveParameters)
    }

    changeDriftParameter(evt: FormEvent) {
        const target = evt.target as any
        const key = target.name as (keyof DriftParameters)
        const value = Number(target.value)
        var {goal} = this.props

        goal.task.surface_drift[key] = value

        GlobalSettings.driftParameters[key] = value
        Save(GlobalSettings.driftParameters)
    }

    changeConstantHeadingParameter(evt: FormEvent)
    {


        const target = evt.target as any
        const key = target.name as (keyof ConstantHeadingParameters)
        const value = Number(target.value)
        var {goal} = this.props

        goal.task.constant_heading[key] = value

        GlobalSettings.constantHeadingParameters[key] = value
        Save(GlobalSettings.constantHeadingParameters)
    }

    driftOptionsPanel() {
        let surface_drift = this.props.goal.task.surface_drift
        // console.log(`key = ${this.key}.drift.drift_time`)
        // console.log(`  defaultValue = ${surface_drift.drift_time}`)

        return (
            <div id="DriftDiv" className='task-options'>
                <table className="DriftParametersTable">
                    <tbody>
                        <tr>
                            <td>Drift Time</td>
                            <td><input key={`${this.key}.drift.drift_time`} type="number" step="1" className="NumberInput" name="drift_time" defaultValue={surface_drift.drift_time} onChange={this.changeDriftParameter.bind(this)} /> s</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        )
    }

    ConstantHeadingOptionsPanel() {
        let constant_heading = this.props.goal.task.constant_heading

        function calculateDistance(speed: number, time: number) {
            if (speed == null || time == null) return null;
            else return speed * time;
        }

        return (
            <div id="ConstantHeadingDiv" className='task-options'>
                <Button className="button-jcc select-on-map" onClick={this.selectOnMapClicked.bind(this)}>Select on Map</Button>
                <table className="ConstantHeadingParametersTable">
                    <tbody>
                        <tr>
                            <td>Heading</td>
                            <td><input key={`${this.key}.constant_heading.constant_heading`} type="number" step="1" className="NumberInput" name="constant_heading" value={constant_heading.constant_heading.toFixed(0)} onChange={this.changeConstantHeadingParameter.bind(this)} /></td>
                            <td>deg</td>
                        </tr>
                        <tr>
                            <td>Time</td>
                            <td><input key={`${this.key}.constant_heading.time`} type="number" step="1" className="NumberInput" name="constant_heading_time" value={constant_heading.constant_heading_time.toFixed(0)} onChange={this.changeConstantHeadingParameter.bind(this)} /></td>
                            <td>s</td>
                        </tr>
                        <tr>
                            <td>Speed</td>
                            <td><input key={`${this.key}.constant_heading.speed`} type="number" step="1" className="NumberInput" name="constant_heading_speed" value={constant_heading.constant_heading_speed.toFixed(0)} onChange={this.changeConstantHeadingParameter.bind(this)} /></td>
                            <td>m/s</td>
                        </tr>
                        <tr>
                            <td>Distance</td>
                            <td style={{textAlign: 'right'}}>{calculateDistance(constant_heading.constant_heading_speed, constant_heading.constant_heading_time)?.toFixed(1) ?? "?"}</td>
                            <td>m</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        )
    }

    doneClicked() {
        this.props.onClose?.()
    }

    cancelClicked() {
        var { goal } = this.props

        // Clear this goal
        Object.keys(goal).forEach((key: keyof Goal) => {
            delete goal[key]
        })

        // Copy items from our backup copy of the goal
        Object.assign(goal, this.oldGoal)

        this.props.onChange?.()

        this.props.onClose?.()
    }

    // For selecting target for constant heading task type    
    selectOnMapClicked() {
        this.props.getCoordinate().then(
            (end: GeographicCoordinate) => {
                var { goal } = this.props

                let start = goal.location
                let constant_heading = goal.task?.constant_heading
                let speed = constant_heading?.constant_heading_speed

                // Guard
                if (start == null || constant_heading == null) {
                    return
                }

                if (speed == null) {
                    console.error(`Constant heading task has speed == ${speed}`)
                    return
                }

                // Calculate heading and time from location and speed
                let rhumb_bearing = fmod(rhumbBearing([start.lon, start.lat], [end.lon, end.lat]), 360)
                constant_heading.constant_heading = Number(rhumb_bearing.toFixed(0))

                let rhumb_distance = rhumbDistance([start.lon, start.lat], [end.lon, end.lat], {units: 'meters'})
                let t = rhumb_distance / speed
                constant_heading.constant_heading_time = Number(t.toFixed(0))
            }
        )
    }

}
