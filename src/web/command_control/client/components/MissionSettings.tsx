import React from 'react'
import Map from 'ol/Map'
import turf from '@turf/turf'
import Select, { SelectChangeEvent } from '@mui/material/Select'
import { BotStatus, GeographicCoordinate, Goal, MissionTask } from './shared/JAIAProtobuf'
import { getGeographicCoordinate } from './shared/Utilities'
import { TaskSettingsPanel } from './TaskSettingsPanel'
import { FormControl, MenuItem } from '@mui/material'
import '../style/components/MissionSettings.css'

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
            <div className="mission-settings-panel-outer-container">
				<div className="panel-heading">Mission Settings</div>
                
                <div className="mission-settings-panel-container">

                    <div className="mission-settings-input-label">Mission Edit Mode:</div>
                    <FormControl sx={{ minWidth: 120 }} size="small">
                        <Select onChange={(evt: SelectChangeEvent) => self.changeMissionEditMode(evt.target.value)}  value={missionType ?? "editing"}>
                            <MenuItem value={"lines"}>Lines</MenuItem>
                        </Select>
                    </FormControl>

                    <div className="mission-settings-input-label">Mission Spacing:</div>
                    <div className="mission-settings-input-row"><input type="number" name="spacing" className="mission-settings-num-input" defaultValue={this.state.missionParams.spacing} onChange={this.changeMissionParameter.bind(this)} /> m</div>

                    <div className="mission-settings-input-label">Rally Point Spacing:</div>
                    <div className="mission-settings-input-row"><input type="number" name="rally_spacing" className="mission-settings-num-input" defaultValue={this.state.missionParams.rallySpacing} onChange={this.changeMissionParameter.bind(this)} /> m</div>

                    <div className="mission-settings-input-label">Mission Orientation:</div>
                    <div className="mission-settings-input-row"><input id='missionOrientation' name="orientation" className="mission-settings-num-input" readOnly={true} defaultValue={this.state.missionParams.orientation} onChange={this.changeMissionParameter.bind(this)} /> deg</div>


                    <div className="mission-settings-tasks-title">Task:</div>
                    <TaskSettingsPanel task={missionBaseGoal.task} onChange={(task) => {
                        missionBaseGoal.task = task
                        self.setState({missionBaseGoal})
                    }} />

                    <div className="mission-settings-tasks-title">End Task:</div>
                    <TaskSettingsPanel 
                        title="End Task" 
                        map={map} 
                        location={finalLocation}
                        task={missionEndTask} onChange={(missionEndTask) => {
                            self.setState({missionEndTask})
                        }} 
                    />

                    <div className="mission-settings-line-break"></div>

                    <div className="mission-settings-header">Metrics:</div>

                    <div>Area:</div>
                    <div id="missionStatArea">-</div>
                    
                    <div>Perimeter:</div>
                    <div id="missionStatPerimeter">-</div>
                    
                    <div>Mission Orientation:</div>
                    <div id="missionStatOrientation">-</div>
                    
                    <div>Rally Start Dist:</div>
                    <div id="missionStatRallyStartDistance">-</div>
                    
                    <div>Rally Finish Dist:</div>
                    <div id="missionStatRallyFinishDistance">-</div>

                </div>
                
                <div className="mission-settings-button-container">
                    <button className="mission-settings-btn" onClick={() => this.props.onClose()}>Cancel</button>
                    <button className={`mission-settings-btn ${!this.props.missionPlanningGrid ? 'disabled' : ''}`} onClick={this.applyMissionClicked.bind(this)} disabled={!this.props.missionPlanningGrid}>Apply</button>
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
