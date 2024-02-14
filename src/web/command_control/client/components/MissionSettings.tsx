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
import { CustomAlert } from './shared/CustomAlert'

import '../style/components/MissionSettings.css'

export interface MissionSettings {
    endTask: MissionTask
}

export interface MissionParams {
	missionType: 'editing' | 'polygon-grid' | 'lines' | 'exclusions'
	numBots: number,
	numGoals: number,
    pointSpacing: number,
    lineSpacing: number,
	rallySpacing: number,
	orientation: number,
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
    areThereRuns: () => boolean

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

    getSortedRallyFeatures() {
        let rallyFeatures = [...this.props.rallyFeatures]
        return rallyFeatures.sort((a, b) => a.get('num') - b.get('num'))
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
                    <div className="mission-settings-input-label">Point Spacing:</div>
                    <div className="mission-settings-input-row">
                        <input
                            className="mission-settings-num-input"
                            defaultValue={this.state.missionParams.pointSpacing}
                            name="pointSpacing"
                            type="number"
                            onChange={this.changePointSpacing.bind(this)}
                        /> m
                    </div>

                    <div className="mission-settings-input-label">Line Spacing:</div>
                    <div className="mission-settings-input-row">
                        <input
                            className="mission-settings-num-input"
                            defaultValue={this.state.missionParams.lineSpacing}
                            name="lineSpacing"
                            type="number"
                            onChange={this.changeLineSpacing.bind(this)}
                        /> m
                    </div>

                    <div className="mission-settings-input-label">Start Rally:</div>
                    <FormControl sx={{ minWidth: 120 }} size="small">
                        <Select onChange={(evt: SelectChangeEvent) => this.handleRallyFeatureSelection(evt, true)} value={this.props.startRally?.get('num') ?? ''}>
                            {this.getSortedRallyFeatures().map((rallyFeature) => {
                                if (rallyFeature.get('num') !== this.props.endRally?.get('num')) {
                                    return <MenuItem value={rallyFeature.get('num')}>{rallyFeature.get('num')}</MenuItem>
                                }
                            })}
                            <MenuItem value={0}>{''}</MenuItem>
                        </Select>
                    </FormControl>

                    <div className="mission-settings-input-label">End Rally:</div>
                    <FormControl sx={{ minWidth: 120 }} size="small">
                        <Select onChange={(evt: SelectChangeEvent) => this.handleRallyFeatureSelection(evt, false)}  value={this.props.endRally?.get('num') ?? ''}>
                            {this.getSortedRallyFeatures().map((rallyFeature) => {
                                if ((rallyFeature.get('num') !== this.props.startRally?.get('num'))) {
                                    return <MenuItem value={rallyFeature.get('num')}>{rallyFeature.get('num')}</MenuItem>
                                }
                            })}
                            <MenuItem value={0}>{''}</MenuItem>
                        </Select>
                    </FormControl>
                    
                    <div className="mission-settings-task-container">
                        <div className="mission-settings-tasks-title">Task:</div>
                        <TaskSettingsPanel 
                            task={this.state.missionBaseGoal.task} 
                            isEditMode={true}
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
                            isEditMode={true}
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

    /**
     * Prevents negative values or 0 from being used in data processing
     * 
     * @param {number} Value input value to be checked
     * @returns {number} The value passed or DEFAULT_VALUE
     */
    validateNumInput(value: number) {
        const DEFAULT_VALUE = 1
        if (value < DEFAULT_VALUE) {
            return DEFAULT_VALUE
        }
        return value
    }

    /**
     * Updates the point spacing value based on input changes
     * 
     * @param {Event} evt Contains the point spacing value (in meters)
     * @returns {void} 
     */
    changePointSpacing(evt: Event) {
        const element = evt.target as HTMLInputElement
        const value = this.validateNumInput(Number(element.value))
        this.props.missionParams.pointSpacing = value
    }
    
    /**
     * Updates the line spacing value based on input changes
     * 
     * @param {Event} evt Contains the line spacing value (in meters)
     * @returns {void} 
     */
    changeLineSpacing(evt: Event) {
        const element = evt.target as HTMLInputElement
        const value = this.validateNumInput(Number(element.value))
        this.props.missionParams.lineSpacing = value
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

    /**
     * Used to save the mission preview
     * 
     * @returns {void}
     */
    async applyMissionClicked() {
 
        if (this.props.areThereRuns() &&
            !(await CustomAlert.confirmAsync('Adding this new mission will delete the current mission. Are you sure?', 'Replace Current Mission'))) {
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
