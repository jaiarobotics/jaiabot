import React, { ChangeEvent } from 'react'

import { Map } from 'ol';

import JaiaToggle from './JaiaToggle';
import { Goal } from './shared/JAIAProtobuf';
import { CustomAlert } from './shared/CustomAlert';
import { TaskSettingsPanel } from './TaskSettingsPanel';
import { MissionInterface, PanelType } from './CommandControl';
import { deepcopy, adjustAccordionScrollPosition } from './shared/Utilities'
import EditModeToggle from './EditModeToggle'
import { RunInterface } from './CommandControl';
import { Icon } from '@mdi/react'
import { mdiDelete } from '@mdi/js'
import '../style/components/GoalSettingsPanel.css'

enum LatLon {
    LAT = 'lat',
    LON = 'lon'
}

interface Props {
    botId: number
    goalIndex: number
    goal: Goal
    originalGoal: Goal
    map: Map
    runList: MissionInterface
    runNumber: number
    enableEcho: boolean
    onChange: () => void
    onDoneClick: () => void
    setVisiblePanel: (panelType: PanelType) => void
    setMoveWptMode: (canMoveWptMode: boolean, runId: string, goalNum: number) => void
    setRunList: (runList: MissionInterface) => void
    toggleEditMode: (evt: React.ChangeEvent, run: RunInterface) => string
    updateMissionHistory: (mission: MissionInterface) => void
}

interface State {
    isChecked: boolean,
    goalIndex: number,
    pauseNumModif: boolean,
    enterNegative: {[direction: string]: boolean}
}

export class GoalSettingsPanel extends React.Component {
    props: Props
    state: State
    autoScrollTimeout: number

    constructor(props: Props) {
        super(props)
        this.state = {
            isChecked: false,
            goalIndex: this.props.goalIndex,
            pauseNumModif: false,
            enterNegative: {
                'lat': false,
                'lon': false
            }
        }
        this.autoScrollTimeout = 30 // ms
    }

    componentWillUnmount() {
        this.props.setMoveWptMode(false, `run-${this.props.runNumber}`, this.props.goalIndex)
    }

    handleToggleClick() {
        const updatedIsChecked = !this.state.isChecked
        this.setState({ isChecked: updatedIsChecked })
        this.props.setMoveWptMode(updatedIsChecked, `run-${this.props.runNumber}`, this.props.goalIndex)
    }

    isChecked() {
        if (this.state.goalIndex !== this.props.goalIndex) {
            this.setState({ 
                isChecked: false,
                goalIndex: this.props.goalIndex
             })
        }

        return this.state.isChecked
    }

    doneClicked() {
        this.props.setMoveWptMode(false, `run-${this.props.runNumber}`, this.props.goalIndex)
        this.props.setVisiblePanel(PanelType.NONE)
        this.props.onDoneClick()
    }

    cancelClicked() {
        const { goal, originalGoal } = this.props

        if (goal && originalGoal) {
            // Clear this goal
            Object.keys(goal).forEach((key: keyof Goal) => {
                delete goal[key]
            })

            // Copy items from our backup copy of the goal
            Object.assign(goal, originalGoal)
        }

        this.props.setVisiblePanel(PanelType.NONE)
        this.props.onChange()
        this.props.setMoveWptMode(false, `run-${this.props.runNumber}`, this.props.goalIndex)
    }

    updatePanelVisibility() {
        const runs = this.props.runList.runs
        let run = null

        for (const testRun of Object.values(runs)) {
            if (testRun.assigned === this.props.botId) {
                run = testRun
            }
        }
    }

    /**
     * Gets and returns the run that the currently selected waypoint is a part of
     * 
     * @returns {RunInterface} Returns the run that the currently selected wpt is a part of
     */
    getRun() {
        let run: RunInterface = null
        Object.entries(this.props.runList).map(() =>
            run = this.props.runList.runs[`run-${this.props.runNumber}`]
        )

        return run
    }

    getCoordValue(coordType: LatLon, tempValue?: string) {
        const max = coordType === 'lat' ? 90 : 180
        const min = max * -1
        let value = null

        if (
            this.state.pauseNumModif
            && (this.props.goal?.location[coordType] * 100000 / 100000) < max 
            && (this.props.goal?.location[coordType] * 100000 / 100000) > min
        ) {
            value = tempValue
            return value
        }

        if (this.state.enterNegative[coordType]) {
            value = '-'
            return value
        }

        value = Math.round(this.props.goal?.location[coordType] * 100000) / 100000

        if (value > max) {
            return max
        } else if (value < min) {
            return min
        } else {
            return value
        }
    }

    handleCoordChange(e: ChangeEvent<HTMLInputElement>, coordType: LatLon) {
        const value = e.target.value
        const max = coordType === 'lat' ? 90 : 180
        const min = max * -1
        const maxCharacterWidth = 10

        if (Number.isNaN(parseFloat(value))) {
            this.props.goal.location[coordType] = 0
            return
        }

        if (value.length < maxCharacterWidth && (value.slice(-1) === '.' || (value.slice(-1) === '0' && Number(value) > min && Number(value) < max))) {
            this.setState({ pauseNumModif: true }, () => this.getCoordValue(coordType, value))
        } else if (value.slice(1, 2) === '-') {
            const enterNegative = this.state.enterNegative
            enterNegative[coordType] = true
            this.setState({ enterNegative: enterNegative }, () => this.getCoordValue(coordType))
        } else {
            const enterNegative = this.state.enterNegative
            enterNegative[coordType] = false
            this.setState({ pauseNumModif: false, enterNegative }, () => this.getCoordValue(coordType))
            this.props.goal.location[coordType] = parseFloat(value)
        }
    }

    /**
     * Removes a single waypoint from a run
     * 
     * @returns {void}
     */
    async deleteWaypoint() {
        const wptNum = this.props.goalIndex

        if (!await CustomAlert.confirmAsync(`Are you sure you want to delete Waypoint ${wptNum}?`, 'Delete Waypoint')) {
            return
        }

        const runId = `run-${this.props.runNumber}`
        let runList = this.props.runList
        const run = runList.runs[runId]
        const wpts = run.command.plan.goal
        // Removes selected wpt from array of wpts
        // Wpt numbers start counting at 1, so we subtract 1 to match 0 index scheme of arrays
        const updatedWpts = wpts.filter((wpt, index) => index !== wptNum - 1)
        runList.runs[runId].command.plan.goal = updatedWpts
        this.props.setRunList(runList)
        this.props.updateMissionHistory(runList)
        this.props.setVisiblePanel(PanelType.NONE)
    }

    /**
     * Auto scrolls Task inputs into view
     * 
     * @returns {void}
     */
    scrollTaskSettingsIntoView() {
        const taskScrollElement = document.getElementById('task-scroll-hook')
        setTimeout(() => {
            adjustAccordionScrollPosition('goal-settings-content-panel', taskScrollElement)
        }, this.autoScrollTimeout)
    }

    render() {
        const { goal, goalIndex, botId } = this.props
        const isEditMode = this.props.runList.runIdInEditMode === `run-${this.props.runNumber}`

        this.updatePanelVisibility()

        return (
            <div className="goal-settings-panel-outer-container">
                <div className="goal-settings-panel-inner-container" id="goal-settings-content-panel">
                    <div className="goal-settings-label wpt-label">Wpt:</div>
                    <div className="goal-settings-wpt-input-container">
                        <div className="goal-settings-input wpt-input">{goalIndex}</div>
                        <div className={`goal-settings-delete-wpt-container button-jcc ${!isEditMode ? 'goal-settings-hide' : ''}`} onClick={() => this.deleteWaypoint()}>
                            <Icon path={mdiDelete} title='Delete Waypoint'/>
                        </div>
                    </div>
                    <div className="goal-settings-line-break"></div>
                    <div className="goal-settings-label">Bot:</div>
                    <div className="goal-settings-input">{botId}</div>
                    <div className="goal-settings-line-break"></div>
                        <div className="goal-settings-label move-label">Edit Run</div>
                            <EditModeToggle
                                onClick={this.props.toggleEditMode}
                                runIdInEditMode={this.props.runList.runIdInEditMode}
                                run={this.getRun()}
                                label=""
                                title="ToggleEditMode"
                            />
                    <div className="goal-settings-line-break"></div>
                    <div className={`goal-settings-move-container ${!isEditMode ? 'goal-settings-hide' : ''}`}>
                        <div className="goal-settings-label move-label">Tap To Move</div>
                        <JaiaToggle 
                            checked={() => this.isChecked()}
                            onClick={() => this.handleToggleClick()}
                            label=''
                            title='Click on map to move goal'
                        />
                    </div>
                    <div className={`goal-settings-line-break ${!isEditMode ? 'goal-settings-hide' : ''}`}></div>
                    <div className="goal-settings-label coord-label">Lat:</div>
                    <input className="goal-settings-input coord-input" value={this.getCoordValue(LatLon.LAT)} onChange={(e) => this.handleCoordChange(e, LatLon.LAT)} disabled={!isEditMode} />
                    <div className="goal-settings-label coord-label">Lon:</div>
                    <input className="goal-settings-input coord-input" value={this.getCoordValue(LatLon.LON)} onChange={(e) => this.handleCoordChange(e, LatLon.LON)} disabled={!isEditMode} />
                    <div className="goal-settings-line-break"></div>
                    <div className="goal-settings-label task-label" id="task-scroll-hook">Task:</div>
                    <TaskSettingsPanel 
                        task={goal?.task}
                        map={this.props.map}
                        location={goal?.location}
                        isEditMode={isEditMode}
                        enableEcho={this.props.enableEcho}
                        scrollTaskSettingsIntoView={this.scrollTaskSettingsIntoView.bind(this)}
                        onChange={task => {
                            goal.task = task
                            this.props.onChange?.()
                        }}
                        onDoneClick={task => {
                            goal.task = task
                            this.props.onDoneClick?.()
                        }}
                    />
                    <div className="goal-settings-line-break"></div>
                </div>
                <div className={`goal-settings-button-container ${!isEditMode ? 'goal-settings-single-button-container' : ''}`}>
                        <button className={`goal-settings-btn ${!isEditMode ? 'goal-settings-hide' : ''}`} onClick={this.cancelClicked.bind(this)}>Cancel</button>
                        <button className={`goal-settings-btn ${!isEditMode ? 'goal-settings-single-btn' : ''}`} onClick={this.doneClicked.bind(this)}>{!isEditMode ? 'Close' : 'Done'}</button>
                </div>
            </div>
        )
    }
}
