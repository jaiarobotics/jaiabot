/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React, { FormEvent } from 'react'
import Button from '@mui/material/Button';
import { Setting, Settings } from './Settings'
import { Goal, TaskType, DiveParameters, DriftParameters } from './gui/JAIAProtobuf';
import * as DiveDriftSettings from './DiveParameters';


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

        var taskOptionsPanel
        let taskType = this.state.goal.task?.type

        switch (taskType) {
            case 'DIVE':
                taskOptionsPanel = this.diveOptionsPanel()
                break;
            case 'SURFACE_DRIFT':
                taskOptionsPanel = this.driftOptionsPanel()
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
                    dive: DiveDriftSettings.currentDiveParameters(),
                    surface_drift: DiveDriftSettings.currentDriftParameters()
                }
                break;
            case 'SURFACE_DRIFT':
                goal.task = {
                    type: taskType,
                    surface_drift: {
                        drift_time: Settings.driftTime.get()
                    }
                }
                break;
            case 'STATION_KEEP':
                goal.task = {
                    type: taskType
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
            <div>
                <table className="DiveParametersTable">
                    <tbody>
                        <tr>
                            <td>Max Depth</td>
                            <td><input type="number" step="1" className="NumberInput" name="max_depth" defaultValue={dive.max_depth} onChange={(this.changeParameter.bind(this))} /> m</td>
                        </tr>
                        <tr>
                            <td>Depth Interval</td>
                            <td><input type="number" step="1" className="NumberInput" name="depth_interval" defaultValue={dive.depth_interval} onChange={this.changeParameter.bind(this)} /> m</td>
                        </tr>
                        <tr>
                            <td>Hold Time</td>
                            <td><input type="number" step="1" className="NumberInput" name="hold_time" defaultValue={dive.hold_time} onChange={this.changeParameter.bind(this)} /> s</td>
                        </tr>
                        <tr>
                            <td>Drift Time</td>
                            <td><input type="number" step="1" className="NumberInput" name="drift_time" defaultValue={surface_drift.drift_time} onChange={this.changeParameter.bind(this)} /> s</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        )
    }

    changeParameter(evt: FormEvent) {
        let {goal} = this.state

        let target = evt.target as any
        const key = target.name as (keyof DiveParameters) | (keyof DriftParameters)
        const value = Number(target.value)

        const settingMap = {
            max_depth: Settings.diveMaxDepth,
            hold_time: Settings.diveHoldTime,
            depth_interval: Settings.diveDepthInterval,
            drift_time: Settings.driftTime
        };

        (settingMap[key] as Setting).set(value)

        if(key != "drift_time")
        {
            goal.task.dive[key] = value;
        }
        else
        {
            goal.task.surface_drift[key] = value;
        }

        this.setState({goal})
    }

    driftOptionsPanel() {
        let surface_drift = this.state.goal.task.surface_drift

        return (
            <div>
                <table className="DiveParametersTable">
                    <tbody>
                        <tr>
                            <td>Drift Time</td>
                            <td><input type="number" step="1" className="NumberInput" name="drift_time" defaultValue={surface_drift.drift_time} onChange={this.changeParameter.bind(this)} /> s</td>
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
