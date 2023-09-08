import React from 'react'
import Map from 'ol/Map'
import turf from '@turf/turf'
import Select, { SelectChangeEvent } from '@mui/material/Select'
import { BotStatus, GeographicCoordinate, Goal, MissionTask } from './shared/JAIAProtobuf'
import { getGeographicCoordinate } from './shared/Utilities'
import { FormControl, MenuItem } from '@mui/material'
import { TaskSettingsPanel } from './TaskSettingsPanel'
import { Geometry } from 'ol/geom'
import { Feature } from 'ol'

import '../style/components/MissionSettings.css'

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
    missionParams: MissionParams
    missionPlanningGrid: {[key: string]: number[][]}
    missionBaseGoal: Goal,
    missionEndTask: MissionTask,
    rallyFeatures: Feature<Geometry>[]
    startRally: Feature<Geometry>,
    endRally: Feature<Geometry>,
    centerLineString: turf.helpers.Feature<turf.helpers.LineString>
    botList?: {[key: string]: BotStatus}

    onClose: () => void
    onMissionApply: (missionSettings: MissionSettings, startRally: Feature<Geometry>, endRally: Feature<Geometry>) => void
    onMissionChangeEditMode: () => void
    onTaskTypeChange: () => void
    setSelectedRallyPoint: (rallyPoint: Feature<Geometry>, isStart: boolean) => void
    onChange?: () => void

}

interface State {
    missionParams: MissionParams
    missionBaseGoal: Goal,
    missionEndTask: MissionTask // This is the final task for bots to do at the last line waypoint (station keep OR constant heading back to shore)
    botList?: {[key: string]: BotStatus}
}

export class MissionSettingsPanel extends React.Component {
    props: Props
    state: State

    onClose: () => void
    onChange?: () => void
    onMissionChangeEditMode: () => void
    onTaskTypeChange: () => void

    constructor(props: Props) {
        super(props)

        this.state = {
            missionParams: props.missionParams,
            missionBaseGoal: props.missionBaseGoal,
            missionEndTask: props.missionEndTask,
            botList: props.botList
        }

        this.onClose = props.onClose
        this.onChange = props.onChange
        this.onMissionChangeEditMode = props.onMissionChangeEditMode
        this.onTaskTypeChange = props.onTaskTypeChange
    }

    componentDidUpdate() {
        this.onChange?.()
    }

    render() {
        const { map, centerLineString } = this.props
        const missionType = this.state.missionParams?.missionType
        // Get the final location, if available
        let finalLocation: GeographicCoordinate

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
                        <Select onChange={(evt: SelectChangeEvent) => this.changeMissionEditMode(evt.target.value)}  value={missionType ?? "editing"}>
                            <MenuItem value={"lines"}>Lines</MenuItem>
                        </Select>
                    </FormControl>

                    <div className="mission-settings-input-label">Mission Spacing:</div>
                    <div className="mission-settings-input-row"><input type="number" name="spacing" className="mission-settings-num-input" defaultValue={this.state.missionParams.spacing} onChange={this.changeMissionParameter.bind(this)} /> m</div>

                    <div className="mission-settings-input-label">Rally Point Spacing:</div>
                    <div className="mission-settings-input-row"><input type="number" name="rally_spacing" className="mission-settings-num-input" defaultValue={this.state.missionParams.rallySpacing} onChange={this.changeMissionParameter.bind(this)} /> m</div>

                    <div className="mission-settings-input-label">Mission Orientation:</div>
                    <div className="mission-settings-input-row"><input id='missionOrientation' name="orientation" className="mission-settings-num-input" readOnly={true} defaultValue={this.state.missionParams.orientation} onChange={this.changeMissionParameter.bind(this)} /> deg</div>

                    <div className="mission-settings-input-label">Start Rally:</div>
                    <FormControl sx={{ minWidth: 120 }} size="small">
                        <Select onChange={(evt: SelectChangeEvent) => this.handleRallyFeatureSelection(evt, true)} value={this.props.startRally?.get('num') ?? ''}>
                            {this.props.rallyFeatures.map((rallyFeature) => {
                                if (rallyFeature.get('num') !== this.props.endRally?.get('num')) {
                                    return <MenuItem value={rallyFeature.get('num')}>{rallyFeature.get('num')}</MenuItem>
                                }
                            })}
                        </Select>
                    </FormControl>

                    <div className="mission-settings-input-label">End Rally:</div>
                    <FormControl sx={{ minWidth: 120 }} size="small">
                        <Select onChange={(evt: SelectChangeEvent) => this.handleRallyFeatureSelection(evt, false)}  value={this.props.endRally?.get('num') ?? ''}>
                            {this.props.rallyFeatures.map((rallyFeature) => {
                                if ((rallyFeature.get('num') !== this.props.startRally?.get('num'))) {
                                    return <MenuItem value={rallyFeature.get('num')}>{rallyFeature.get('num')}</MenuItem>
                                }
                            })}
                        </Select>
                    </FormControl>
                    
                    <div className="mission-settings-task-container">
                        <div className="mission-settings-tasks-title">Task:</div>
                        <TaskSettingsPanel 
                            task={this.state.missionBaseGoal.task} 
                            onChange={(task) => {
                                const missionBaseGoal = this.state.missionBaseGoal
                                missionBaseGoal.task = task
                                this.setState({ missionBaseGoal })
                            }}
                        />
                    </div>

                    <div className="mission-settings-task-container">
                        <div className="mission-settings-tasks-title">End Task:</div>
                        <TaskSettingsPanel 
                            title="End Task" 
                            map={map} 
                            location={finalLocation}
                            task={this.state.missionEndTask} 
                            onChange={(missionEndTask) => { this.setState({ missionEndTask })}} 
                        />
                    </div>

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
        const missionParams = this.state.missionParams
        const target = evt.target as any
        const key = target.name
        const value = target.value as any

        (missionParams as any)[key] = value

        this.setState({ missionParams })
    }

    handleRallyFeatureSelection(evt: SelectChangeEvent, isStart: boolean) {
        const rallyNum = evt.target.value
        let selectedRallyFeature: Feature<Geometry> = null
        for (const rallyFeature of this.props.rallyFeatures) {
            if (rallyFeature.get('num') === rallyNum) {
                selectedRallyFeature = rallyFeature
                break
            }
        }
        if (isStart) {
            this.props.setSelectedRallyPoint(selectedRallyFeature, true)
        } else {
            this.props.setSelectedRallyPoint(selectedRallyFeature, false)
        }
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

        this.props.onMissionApply?.(missionSettings, this.props.startRally, this.props.endRally)
    }

    changeMissionBotSelection() {
        const selected = document.querySelectorAll('#mission-bot-selection option:checked')
        const missionBots = Array.from(selected).map(el => Number((el as HTMLSelectElement).value))
        const missionParams  = this.state.missionParams
        missionParams.selectedBots = missionBots
        this.setState({ missionParams })
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

        this.setState({ missionParams })

        this.onMissionChangeEditMode?.()

    }

    applyMissionEditMode() {
        this.onMissionChangeEditMode?.()
    }

}
