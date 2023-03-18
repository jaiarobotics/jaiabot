/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React, { FormEvent } from 'react'
import Button from '@mui/material/Button';
import { GlobalSettings, Save } from './Settings'
import { Goal, TaskType, DiveParameters, DriftParameters, ConstantHeadingParameters } from './gui/JAIAProtobuf';
import { deepcopy } from './Utilities'
import { taskNone } from './gui/Styles';


interface Props {
    botId: number
    goalIndex: number
    goal: Goal
    onClose: () => void
    onChange: () => void
}


export class GoalSettingsPanel extends React.Component {

    props: Props
    key: string

    constructor(props: Props) {
        super(props)
        this.key = `goal-${props.botId}-${props.goalIndex}`
    }

    componentDidUpdate() {
        this.props.onChange?.()
    }

    render() {
        const { botId, goalIndex } = this.props
        let self = this

        let taskOptionsPanel = <div></div>
        let taskType = this.props.goal.task?.type

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
                <div>Goal {goalIndex}</div>
                <div>Bot {botId}</div>
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
                    <Button className="button-jcc" onClick={this.closeClicked.bind(this)}>Close</Button>
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

        // this.setState({goal})
    }

    diveOptionsPanel() {
        let dive = this.props.goal.task.dive
        let surface_drift = this.props.goal.task.surface_drift
        // console.log(`key = ${this.key}.drift.drift_time`)
        // console.log(`  defaultValue = ${surface_drift.drift_time}`)

        return (
            <div id="DiveDiv">
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
            <div id="DriftDiv">
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
            <div id="ConstantHeadingDiv">
                <Button className="button-jcc select-on-map" onClick={this.closeClicked.bind(this)}>Select on Map</Button>
                <table className="ConstantHeadingParametersTable">
                    <tbody>
                        <tr>
                            <td>Heading</td>
                            <td><input key={`${this.key}.constant_heading.constant_heading`} type="number" step="1" className="NumberInput" name="constant_heading" defaultValue={constant_heading.constant_heading} onChange={this.changeConstantHeadingParameter.bind(this)} /></td>
                            <td>deg</td>
                        </tr>
                        <tr>
                            <td>Time</td>
                            <td><input key={`${this.key}.constant_heading.time`} type="number" step="1" className="NumberInput" name="constant_heading_time" defaultValue={constant_heading.constant_heading_time} onChange={this.changeConstantHeadingParameter.bind(this)} /></td>
                            <td>s</td>
                        </tr>
                        <tr>
                            <td>Speed</td>
                            <td><input key={`${this.key}.constant_heading.speed`} type="number" step="1" className="NumberInput" name="constant_heading_speed" defaultValue={constant_heading.constant_heading_speed} onChange={this.changeConstantHeadingParameter.bind(this)} /></td>
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

    closeClicked() {
        this.props.onClose?.()
    }

}
