import React from 'react'
import Button from '@mui/material/Button';
import { BotStatus, GeographicCoordinate, Goal, MissionTask } from './shared/JAIAProtobuf';
import { GlobalSettings } from './Settings';
import { deepcopy, getGeographicCoordinate } from './shared/Utilities';
import { TaskSettingsPanel } from './TaskSettingsPanel';
import Map from 'ol/Map'
import turf from '@turf/turf';

// This panel passes its settings back through onMissionApply using this interface
export interface MissionSettings {
    endTask: MissionTask
}

export interface MissionParams {
	missionType: 'editing' | 'polygon-grid' | 'lines' | 'exclusions'
	numBots: number,
	numGoals: number,
	spacing: number,
	orientation: number,
	rallySpacing: number,
	spArea: number,
	spPerimeter: number,
	spRallyStartDist: number,
	spRallyFinishDist: number,
	selectedBots: number[],
	useMaxLength: boolean
}

interface Props {
    map: Map
    missionBaseGoal: Goal
    missionEndTask: MissionTask
    missionParams: MissionParams
    missionPlanningGrid: {[key: string]: number[][]}
    botList?: {[key: string]: BotStatus}
    centerLineString: turf.helpers.Feature<turf.helpers.LineString>

    onClose: () => void
    onChange?: () => void
    onMissionApply: (missionSettings: MissionSettings) => void
    onMissionChangeEditMode: () => void
    onMissionChangeBotList: () => void
    onTaskTypeChange: () => void
}

interface State {
    missionBaseGoal: Goal
    missionEndTask: MissionTask // This is the final task for bots to do at the last line waypoint (station keep OR constant heading back to shore)
    missionParams: MissionParams
    botList?: {[key: string]: BotStatus}
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
            missionParams: props.missionParams,
            botList: props.botList
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
        const { map, centerLineString } = this.props
        let self = this

        let missionType = this.state.missionParams?.missionType

        const {missionBaseGoal, missionEndTask} = this.state

        // Get the final location, if available
        var finalLocation: GeographicCoordinate

        if (centerLineString != null) {
            const coordinates = centerLineString.geometry.coordinates
            if (coordinates.length >= 2) {
                finalLocation = getGeographicCoordinate(coordinates[1], map)
            }
        }

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
                                <td><input type="number" className="NumberInput" name="num_bots" defaultValue={this.state.missionParams.numBots} onChange={this.changeMissionParameter.bind(this)} /></td>
                            </tr>
                            <tr>
                                <td>Mission Spacing</td>
                                <td><input type="number" className="NumberInput" name="spacing" defaultValue={this.state.missionParams.spacing} onChange={this.changeMissionParameter.bind(this)} /> m</td>
                            </tr>
                            <tr>
                                <td>Rally Point Spacing</td>
                                <td><input type="number" className="NumberInput" name="rally_spacing" defaultValue={this.state.missionParams.rallySpacing} onChange={this.changeMissionParameter.bind(this)} /> m</td>
                            </tr>
                            <tr>
                                <td>Mission Orientation</td>
                                <td><input id='missionOrientation' className="NumberInput" name="orientation" readOnly={true} defaultValue={this.state.missionParams.orientation} onChange={this.changeMissionParameter.bind(this)} /> deg</td>
                            </tr>
                            <tr hidden>
                                <td>Use Max Line Length</td>
                                <td><input type="checkbox" className="RadioInput" name="use_max_length" checked={this.state.missionParams.useMaxLength} onChange={this.changeMissionParameter.bind(this)} /></td>
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
                        location={finalLocation}
                        task={missionEndTask} onChange={(missionEndTask) => {
                            self.setState({missionEndTask})
                        }} 
                    />

                    <hr/>
                    <div className='HorizontalFlexbox'>
                        {/*<Button className="button-jcc" onClick={this.closeClicked.bind(this)}>Close</Button>*/}
                        <Button className={`button-jcc ${!this.props.missionPlanningGrid ? 'inactive' : ''}`} onClick={this.applyMissionClicked.bind(this)} disabled={!this.props.missionPlanningGrid}>Apply</Button>
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
        var {missionParams} = this.state

        const target = evt.target as any
        const key = target.name
        const value = target.value as any

        (missionParams as any)[key] = value

        this.setState({missionParams})
    }

    closeClicked() {
        this.onClose?.()
    }

    applyMissionClicked() {
        if (!confirm('Adding this new mision will delete the current misison. If the current mission is saved, select OK')) {
            this.props.onClose()
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
        let {missionParams} = this.state;
        missionParams.selectedBots = missionBots;
        this.setState({missionParams});
        this.onMissionChangeBotList?.()
    }

    changeMissionEditMode(missionEditMode: string) {
        // console.log(missionEditMode);
        let {missionParams} = this.state;

        if (missionEditMode === missionParams?.missionType) {
            return
        }

        switch(missionEditMode) {
            case 'polygon-grid':
                missionParams.missionType = missionEditMode
                break;
            case 'lines':
                missionParams.missionType = missionEditMode
                break;
            case 'editing':
                missionParams.missionType = missionEditMode
                break;
            case 'exclusions':
                missionParams.missionType = missionEditMode
                break;
            default:
                missionParams.missionType = 'editing'
                break;
        }

        this.setState({missionParams});

        this.onMissionChangeEditMode?.()

    }

    applyMissionEditMode() {
        this.onMissionChangeEditMode?.()
    }

}
