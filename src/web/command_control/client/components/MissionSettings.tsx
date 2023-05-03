/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React, { ReactElement } from 'react'
import Button from '@mui/material/Button';
import { BotStatus, DiveParameters, DriftParameters, Goal, TaskType } from './shared/JAIAProtobuf';


interface Props {
    goal: Goal
    style: any
    mission_params: any
    bot_list?: {[key: string]: BotStatus}

    onClose: () => void
    onChange?: () => void
    onMissionApply: () => void
    onMissionChangeEditMode: () => void
    onMissionChangeBotList: () => void
    onTaskTypeChange: () => void
    areBotsAssignedToRuns: () => boolean
}

interface State {
    goal: Goal
    style: any
    mission_params: any
    bot_list?: {[key: string]: BotStatus}
}


export class MissionSettingsPanel extends React.Component {

    props: Props
    state: State

    onClose: () => void
    onChange?: () => void
    onMissionApply: () => void
    onMissionChangeEditMode: () => void
    onMissionChangeBotList: () => void
    onTaskTypeChange: () => void

    constructor(props: Props) {
        super(props)

        this.state = {
            goal: props.goal,
            style: props.style,
            mission_params: props.mission_params,
            bot_list: props.bot_list
        }

        this.onClose = props.onClose
        this.onChange = props.onChange
        this.onMissionApply = props.onMissionApply
        this.onMissionChangeEditMode = props.onMissionChangeEditMode
        this.onMissionChangeBotList = props.onMissionChangeBotList
        this.onTaskTypeChange = props.onTaskTypeChange
    }

    componentDidUpdate() {
        this.onChange?.()
    }

    render() {
        let self = this

        let taskOptionsPanel
        let taskType = this.state.goal.task?.type
        let missionType = this.state.mission_params?.mission_type

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

        let botListPanel

        return (
            <div className="MissionSettingsPanel">
                Mission Settings<hr/>
                <div>
                    <div>
                        <table className="MissionParametersTable">
                            <tbody>
                            <tr hidden>
                                <td>Bot Selection List:</td>
                                <td>
                                    <select multiple name="mission_bot_selection" id="mission-bot-selection" onChange={evt => self.changeMissionBotSelection() }>
                                        <option value="0">Bot 0</option>
                                        <option value="1">Bot 1</option>
                                        <option value="2">Bot 2</option>
                                        <option value="3">Bot 3</option>
                                    </select>
                                </td>
                            </tr>
                            <tr>
                                <td>Mission Edit Mode:</td>
                                <td>
                                    <select name="mission_type" id="mission-type" defaultValue={missionType ?? "editing"} onChange={evt => self.changeMissionEditMode(evt.target.value) }>
                                        {/*<option value="editing">Editing</option>*/}
                                        {/*<option value="polygon-grid">Polygon</option>*/}
                                        <option value="lines">Lines</option>
                                        {/*<option value="exclusions">Exclusions</option>*/}
                                    </select>
                                </td>
                            </tr>
                            <tr hidden>
                                <td>Bot Count</td>
                                <td><input type="number" className="NumberInput" name="num_bots" defaultValue={this.state.mission_params.num_bots} onChange={this.changeMissionParameter.bind(this)} /></td>
                            </tr>
                            <tr>
                                <td>Max Points per Bot</td>
                                <td><input type="number" className="NumberInput" name="num_goals" defaultValue={this.state.mission_params.num_goals} onChange={this.changeMissionParameter.bind(this)} /></td>
                            </tr>
                            <tr>
                                <td>Mission Spacing</td>
                                <td><input type="number" className="NumberInput" name="spacing" defaultValue={this.state.mission_params.spacing} onChange={this.changeMissionParameter.bind(this)} /> m</td>
                            </tr>
                            <tr>
                                <td>Rally Point Spacing</td>
                                <td><input type="number" className="NumberInput" name="rally_spacing" defaultValue={this.state.mission_params.rally_spacing} onChange={this.changeMissionParameter.bind(this)} /> m</td>
                            </tr>
                            <tr>
                                <td>Mission Orientation</td>
                                <td><input id='missionOrientation' className="NumberInput" name="orientation" readOnly={true} defaultValue={this.state.mission_params.orientation} onChange={this.changeMissionParameter.bind(this)} /> deg</td>
                            </tr>
                            <tr hidden>
                                <td>Use Max Line Length</td>
                                <td><input type="checkbox" className="RadioInput" name="use_max_length" defaultValue={this.state.mission_params.use_max_length} onChange={this.changeMissionParameter.bind(this)} /></td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                    <hr/>
                    Task
                    <select name="GoalType" id="GoalType" onChange={evt => self.changeTaskType(evt.target.value as TaskType) } defaultValue={taskType ?? "NONE"}>
                        <option value="NONE">None</option>
                        <option value="DIVE">Dive</option>
                        <option value="SURFACE_DRIFT">Surface Drift</option>
                        <option value="STATION_KEEP">Station Keep</option>
                    </select>

                    { taskOptionsPanel }

                    <hr/>
                    <div className='HorizontalFlexbox'>
                        {/*<Button className="button-jcc" onClick={this.closeClicked.bind(this)}>Close</Button>*/}
                        <Button className="button-jcc" onClick={this.applyMissionClicked.bind(this)}>Apply</Button>
                    </div>

                    <hr/>
                    Survey Stats
                    <div id="surveyPolygonResults">
                        <table>
                            <tbody>
                            <tr>
                                <td className="missionStatsHeader">Area (km^2): </td>
                                <td className="missionStatsValue"><div id="missionStatArea"></div></td>
                            </tr>
                            <tr>
                                <td className="missionStatsHeader">Perimeter (km): </td>
                                <td className="missionStatsValue"><div id="missionStatPerimeter"></div></td>
                            </tr>
                            <tr>
                                <td className="missionStatsHeader">Mission Orientation (deg): </td>
                                <td className="missionStatsValue"><div id="missionStatOrientation"></div></td>
                            </tr>
                            <tr>
                                <td className="missionStatsHeader">Rally Start Distance (km): </td>
                                <td className="missionStatsValue"><div id="missionStatRallyStartDistance"></div></td>
                            </tr>
                            <tr>
                                <td className="missionStatsHeader">Rally Finish Distance (km): </td>
                                <td className="missionStatsValue"><div id="missionStatRallyFinishDistance"></div></td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )
    }

    changeMissionParameter(evt: Event) {
        let {mission_params} = this.state

        const target = evt.target as any
        const key = target.name
        const value = target.value

        mission_params[key] = value

        this.setState({mission_params})
    }

    changeTaskType(taskType: TaskType) {
        let {goal} = this.state
        let {style} = this.state

        if (taskType === goal.task?.type) {
            return
        }

        switch(taskType) {
            case 'DIVE':
                style = {

                }

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
                style = {

                }

                goal.task = {
                    type: taskType,
                    surface_drift: {
                        drift_time: 30
                    }
                }
                break;
            case 'STATION_KEEP':
                style = {

                }

                goal.task = {
                    type: taskType
                }
                break;
            case 'NONE':
                style = {

                }

                goal.task = {
                    type: taskType
                }
                break;
            default:
                style = {

                }

                goal.task = null
                break;
        }

        this.setState({goal})
        this.setState({style})
        this.onTaskTypeChange?.()
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

    changeDiveParameter(evt: Event) {
        let {goal} = this.state

        const target = evt.target as any
        const key = target.name as (keyof DiveParameters | keyof DriftParameters)
        const value = target.value

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

    changeDriftParameter(evt: Event) {
        let {goal} = this.state

        const target = evt.target as any
        const key = target.name as keyof DriftParameters
        const value = target.value

        goal.task.surface_drift[key] = value

        this.setState({goal})
    }

    closeClicked() {
        this.onClose?.()
    }

    applyMissionClicked() {
        if (this.props.areBotsAssignedToRuns() && !confirm('Adding this new mision will delete the current misison. If the current mission is saved, select OK')) {
            return
        }

        this.onMissionApply?.()
    }

    changeMissionBotSelection() {
        const selected = document.querySelectorAll('#mission-bot-selection option:checked')
        const missionBots = Array.from(selected).map(el => (el as HTMLSelectElement).value);
        // let missionBots = document.getElementById('mission-bot-selection').val();
        // console.log(missionBots);
        let {mission_params} = this.state;
        mission_params.selected_bots = missionBots;
        this.setState({mission_params});
        this.onMissionChangeBotList?.()
    }

    changeMissionEditMode(missionEditMode: string) {
        // console.log(missionEditMode);
        let {mission_params} = this.state;

        if (missionEditMode === mission_params?.mission_type) {
            return
        }

        switch(missionEditMode) {
            case 'polygon-grid':
                mission_params.mission_type = missionEditMode
                break;
            case 'lines':
                mission_params.mission_type = missionEditMode
                break;
            case 'editing':
                mission_params.mission_type = missionEditMode
                break;
            case 'exclusions':
                mission_params.mission_type = missionEditMode
                break;
            default:
                mission_params.mission_type = 'editing'
                break;
        }

        this.setState({mission_params});

        this.onMissionChangeEditMode?.()

    }

    applyMissionEditMode() {
        this.onMissionChangeEditMode?.()
    }

}
