/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React, { ReactElement } from 'react'
import Button from '@mui/material/Button';
import { BotStatus, DiveParameters, DriftParameters, GeographicCoordinate, Goal, MissionTask, TaskType } from './shared/JAIAProtobuf';
import { GlobalSettings } from './Settings';
import { deepcopy } from './Utilities';
import { TaskSettingsPanel } from './TaskSettingsPanel';
import Map from 'ol/Map'

// This panel passes its settings back through onMissionApply using this interface
export interface MissionSettings {
    endTask: MissionTask
}

export interface MissionParams {
	mission_type: 'editing' | 'polygon-grid' | 'lines' | 'exclusions'
	num_bots: number,
	num_goals: number,
	spacing: number,
	orientation: number,
	rally_spacing: number,
	sp_area: number,
	sp_perimeter: number,
	sp_rally_start_dist: number,
	sp_rally_finish_dist: number,
	selected_bots: number[],
	use_max_length: boolean
}

interface Props {
    map: Map
    missionBaseGoal: Goal
    missionEndTask: MissionTask
    mission_params: MissionParams
    bot_list?: {[key: string]: BotStatus}

    onClose: () => void
    onChange?: () => void
    onMissionApply: (missionSettings: MissionSettings) => void
    onMissionChangeEditMode: () => void
    onMissionChangeBotList: () => void
    onTaskTypeChange: () => void
    areBotsAssignedToRuns: () => boolean
}

interface State {
    missionBaseGoal: Goal
    missionEndTask: MissionTask // This is the final task for bots to do at the last line waypoint (station keep OR constant heading back to shore)
    mission_params: MissionParams
    bot_list?: {[key: string]: BotStatus}
}


export class MissionSettingsPanel extends React.Component {

    props: Props
    state: State

    onClose: () => void
    onChange?: () => void
    onMissionChangeEditMode: () => void
    onMissionChangeBotList: () => void
    onTaskTypeChange: () => void

    constructor(props: Props) {
        super(props)

        this.state = {
            missionBaseGoal: props.missionBaseGoal,
            missionEndTask: props.missionEndTask,
            mission_params: props.mission_params,
            bot_list: props.bot_list
        }

        this.onClose = props.onClose
        this.onChange = props.onChange
        this.onMissionChangeEditMode = props.onMissionChangeEditMode
        this.onMissionChangeBotList = props.onMissionChangeBotList
        this.onTaskTypeChange = props.onTaskTypeChange
    }

    componentDidUpdate() {
        this.onChange?.()
    }

    render() {
        const { map } = this.props
        let self = this

        let missionType = this.state.mission_params?.mission_type

        const {missionBaseGoal, missionEndTask} = this.state

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
                                <td><input type="checkbox" className="RadioInput" name="use_max_length" checked={this.state.mission_params.use_max_length} onChange={this.changeMissionParameter.bind(this)} /></td>
                            </tr>
                            </tbody>
                        </table>
                    </div>

                    <hr/>
                    {/* Settings for the goals to be used in this mission */}
                    <TaskSettingsPanel task={missionBaseGoal.task} onChange={(task) => {
                        missionBaseGoal.task = task
                        self.setState({missionBaseGoal})
                    }} />

                    <hr/>
                    {/* Settings for the final goal to be used at the end rally point */}
                    <TaskSettingsPanel 
                        title="End Task" 
                        map={map} 
                        task={missionEndTask} onChange={(missionEndTask) => {
                            self.setState({missionEndTask})
                        }} 
                    />

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
        var {mission_params} = this.state

        const target = evt.target as any
        const key = target.name
        const value = target.value as any

        (mission_params as any)[key] = value

        this.setState({mission_params})
    }

    closeClicked() {
        this.onClose?.()
    }

    applyMissionClicked() {
        if (this.props.areBotsAssignedToRuns() && !confirm('Adding this new mision will delete the current misison. If the current mission is saved, select OK')) {
            return
        }

        const missionSettings: MissionSettings = {
            endTask: this.state.missionEndTask
        }

        this.props.onMissionApply?.(missionSettings)
    }

    changeMissionBotSelection() {
        const selected = document.querySelectorAll('#mission-bot-selection option:checked')
        const missionBots = Array.from(selected).map(el => Number((el as HTMLSelectElement).value));
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
