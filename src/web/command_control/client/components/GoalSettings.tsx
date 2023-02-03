/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React, { FormEvent } from 'react'
import Button from '@mui/material/Button';
import { GlobalSettings, Save } from './Settings'
import { Goal, TaskType, DiveParameters, DriftParameters, ConstantHeadingParameters } from './gui/JAIAProtobuf';


interface Props {
    goal: Goal
    onClose: () => void
    onChange: () => void
}


interface State {
    goal: Goal
}


export class GoalSettingsPanel extends React.Component {

    props: Props
    state: State

    constructor(props: Props) {
        super(props)

        this.state = {
            goal: props.goal
        }

    }

    componentDidUpdate() {
        this.props.onChange?.()
    }

    render() {
        let self = this

        let taskOptionsPanel = <div></div>
        let taskType = this.state.goal.task?.type

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
            Goal Settings
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
        let {goal} = this.state

        if (taskType == goal.task?.type) {
            return
        }

        switch(taskType) {
            case 'DIVE':
                goal.task = {
                    type: taskType,
                    dive: GlobalSettings.diveParameters,
                    surface_drift: GlobalSettings.driftParameters
                }
                break;
            case 'SURFACE_DRIFT':
                goal.task = {
                    type: taskType,
                    surface_drift: GlobalSettings.driftParameters
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
                    constant_heading: GlobalSettings.constantHeadingParameters
                }
                break;
            default:
                goal.task = null
                break;
        }

        this.setState({goal})
    }

    diveOptionsPanel() {
        let dive = this.state.goal.task.dive
        let surface_drift = this.state.goal.task.surface_drift

        return (
            <div id="DiveDiv">
                <table className="DiveParametersTable">
                    <tbody>
                        <tr>
                            <td>Max Depth</td>
                            <td><input key="dive.max_depth" type="number" step="1" className="NumberInput" name="max_depth" defaultValue={dive.max_depth} onChange={(this.changeDiveParameter.bind(this))} /> m</td>
                        </tr>
                        <tr>
                            <td>Depth Interval</td>
                            <td><input key="dive.depth_interval" type="number" step="1" className="NumberInput" name="depth_interval" defaultValue={dive.depth_interval} onChange={this.changeDiveParameter.bind(this)} /> m</td>
                        </tr>
                        <tr>
                            <td>Hold Time</td>
                            <td><input key="dive.hold_time" type="number" step="1" className="NumberInput" name="hold_time" defaultValue={dive.hold_time} onChange={this.changeDiveParameter.bind(this)} /> s</td>
                        </tr>
                        <tr>
                            <td>Drift Time</td>
                            <td><input key="dive.drift_time" type="number" step="1" className="NumberInput" name="drift_time" defaultValue={surface_drift.drift_time} onChange={this.changeDriftParameter.bind(this)} /> s</td>
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
        var {goal} = this.state

        goal.task.dive[key] = value

        GlobalSettings.diveParameters[key] = value
        Save(GlobalSettings.diveParameters)
    }

    changeDriftParameter(evt: FormEvent) {
        const target = evt.target as any
        const key = target.name as (keyof DriftParameters)
        const value = Number(target.value)
        var {goal} = this.state

        goal.task.surface_drift[key] = value

        GlobalSettings.driftParameters[key] = value
        Save(GlobalSettings.driftParameters)
    }

    changeConstantHeadingParameter(evt: FormEvent)
    {


        const target = evt.target as any
        const key = target.name as (keyof ConstantHeadingParameters)
        const value = Number(target.value)
        var {goal} = this.state

        goal.task.constant_heading[key] = value

        GlobalSettings.constantHeadingParameters[key] = value
        Save(GlobalSettings.constantHeadingParameters)
    }

    driftOptionsPanel() {
        let surface_drift = this.state.goal.task.surface_drift

        return (
            <div id="DriftDiv">
                <table className="DriftParametersTable">
                    <tbody>
                        <tr>
                            <td>Drift Time</td>
                            <td><input key="drift.drift_time" type="number" step="1" className="NumberInput" name="drift_time" defaultValue={surface_drift.drift_time} onChange={this.changeDriftParameter.bind(this)} /> s</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        )
    }

    ConstantHeadingOptionsPanel() {
        let constant_heading = this.state.goal.task.constant_heading

        return (
            <div id="ConstantHeadingDiv">
                <table className="ConstantHeadingParametersTable">
                    <tbody>
                        <tr>
                            <td>Heading</td>
                            <td><input key="constant_heading.constant_heading" type="number" step="1" className="NumberInput" name="constant_heading" defaultValue={constant_heading.constant_heading} onChange={this.changeConstantHeadingParameter.bind(this)} /> deg</td>
                        </tr>
                        <tr>
                            <td>Time</td>
                            <td><input key="constant_heading.time" type="number" step="1" className="NumberInput" name="constant_heading_time" defaultValue={constant_heading.constant_heading_time} onChange={this.changeConstantHeadingParameter.bind(this)} /> s</td>
                        </tr>
                        <tr>
                            <td>Speed</td>
                            <td><input key="constant_heading.speed" type="number" step="1" className="NumberInput" name="constant_heading_speed" defaultValue={constant_heading.constant_heading_speed} onChange={this.changeConstantHeadingParameter.bind(this)} /> m/s</td>
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
