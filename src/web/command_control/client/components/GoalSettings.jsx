/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react'
import Settings from './Settings'

export class GoalSettingsPanel extends React.Component {

    constructor(props) {
        super(props)

        this.state = {
            goal: props.goal
        }

        this.onClose = props.onClose
        this.onChange = props.onChange
    }

    componentDidUpdate() {
        this.onChange?.()
    }

    render() {
        self = this

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
                <select name="GoalType" id="GoalType" onChange={evt => self.changeTaskType(evt.target.value) } defaultValue={taskType ?? "NONE"}>
                    <option value="NONE">None</option>
                    <option value="DIVE">Dive</option>
                    <option value="SURFACE_DRIFT">Surface Drift</option>
                    <option value="STATION_KEEP">Station Keep</option>
                </select>
                { taskOptionsPanel }

                <div className='HorizontalFlexbox'>
                    <button onClick={this.closeClicked.bind(this)}>Close</button>
                </div>

            </div>
        </div>
        )
    }

    changeTaskType(taskType) {
        let {goal} = this.state

        if (taskType == goal.task?.type) {
            return
        }

        switch(taskType) {
            case 'DIVE':
                goal.task = {
                    type: taskType,
                    dive: {
                        max_depth: 10,
                        depth_interval: 10,
                        hold_time: 1
                    },
                    surface_drift: {
                        drift_time: 10
                    }
                }
                break;
            case 'SURFACE_DRIFT':
                goal.task = {
                    type: taskType,
                    surface_drift: {
                        drift_time: 10
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
                            <td><input type="number" step="1" className="NumberInput" name="max_depth" defaultValue={dive.max_depth} onChange={this.changeDiveParameter.bind(this)} /> m</td>
                        </tr>
                        <tr>
                            <td>Depth Interval</td>
                            <td><input type="number" step="1" className="NumberInput" name="depth_interval" defaultValue={dive.depth_interval} onChange={this.changeDiveParameter.bind(this)} /> m</td>
                        </tr>
                        <tr>
                            <td>Hold Time</td>
                            <td><input type="number" step="1" className="NumberInput" name="hold_time" defaultValue={dive.hold_time} onChange={this.changeDiveParameter.bind(this)} /> s</td>
                        </tr>
                        <tr>
                            <td>Drift Time</td>
                            <td><input type="number" step="1" className="NumberInput" name="drift_time" defaultValue={surface_drift.drift_time} onChange={this.changeDiveParameter.bind(this)} /> s</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        )
    }

    changeDiveParameter(evt) {
        let {goal} = this.state

        const key = evt.target.name
        const value = evt.target.value

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
                            <td><input type="number" step="1" className="NumberInput" name="drift_time" defaultValue={surface_drift.drift_time} onChange={this.changeDriftParameter.bind(this)} /> s</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        )
    }

    changeDriftParameter(evt) {
        let {goal} = this.state

        const key = evt.target.name
        const value = evt.target.value

        goal.task.surface_drift[key] = value

        this.setState({goal})
    }

    closeClicked() {
        this.onClose?.()
    }

    applyClicked() {
        let {goal} = this.state
        this.onApply?.(goal)
    }

}
