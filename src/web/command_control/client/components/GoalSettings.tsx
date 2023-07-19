import React from 'react'
import WptToggle from './WptToggle';
import { Goal } from './shared/JAIAProtobuf';
import { deepcopy } from './shared/Utilities'
import { TaskSettingsPanel } from './TaskSettingsPanel';
import { Map } from 'ol';
import { MissionInterface, PanelType, RunInterface } from './CommandControl';
import '../style/components/GoalSettingsPanel.css'

interface Props {
    key: string // When this changes, React will create a new component
    botId: number
    goalIndex: number
    goal: Goal
    map: Map
    runList: MissionInterface
    onChange: () => void
    setVisiblePanel: (panelType: PanelType) => void
    setMoveWptMode: (canMoveWptMode: boolean, botId: number, goalNum: number) => void
    canEditRunState: (run: RunInterface) => boolean
}

interface State {
    isChecked: boolean
}

export class GoalSettingsPanel extends React.Component {
    props: Props
    state: State
    oldGoal: Goal

    constructor(props: Props) {
        super(props)
        this.state = {
            isChecked: false
        }
        this.oldGoal = deepcopy(props.goal)
    }

    componentWillUnmount() {
        this.doneClicked()
    }

    handleToggleClick() {
        const updatedIsChecked = !this.state.isChecked
        this.setState({ isChecked: updatedIsChecked })
        this.props.setMoveWptMode(updatedIsChecked, this.props.botId, this.props.goalIndex)
    }

    isChecked() {
        return this.state.isChecked
    }

    doneClicked() {
        this.props.setMoveWptMode(false, this.props.botId, this.props.goalIndex)
        this.props.setVisiblePanel(PanelType.NONE)
    }

    cancelClicked() {
        const { goal } = this.props

        // Clear this goal
        Object.keys(goal).forEach((key: keyof Goal) => {
            delete goal[key]
        })

        // Copy items from our backup copy of the goal
        Object.assign(goal, this.oldGoal)

        this.props.onChange()
        this.props.setMoveWptMode(false, this.props.botId, this.props.goalIndex)
        this.props.setVisiblePanel(PanelType.NONE)
    }

    updatePanelVisibility() {
        const runs = this.props.runList.runs
        let run = null

        for (const testRun of Object.values(runs)) {
            if (testRun.assigned === this.props.botId) {
                run = testRun
            }
        }

        const canEditRun = run.canEdit

        if (!canEditRun) {
            this.doneClicked()
        }
    }

    render() {
        const { botId, goalIndex, goal } = this.props

        this.updatePanelVisibility()

        return (
            <div className="goal-settings-panel-outer-container">
                <div className="goal-settings-panel-container">
                    <div className="goal-settings-label">Goal:</div>
                    <div className="goal-settings-input">{goalIndex}</div>
                    <div className="goal-settings-line-break"></div>
                    <div className="goal-settings-label">Bot:</div>
                    <div className="goal-settings-input">{botId}</div>
                    <div className="goal-settings-line-break"></div>
                    <div className="goal-settings-move-container">
                        <div className="goal-settings-label move-label">Tap To Move</div>
                        <WptToggle 
                            checked={() => this.isChecked()}
                            onClick={() => this.handleToggleClick()}
                            label=''
                            title='Click on map to move goal'
                        />
                    </div>
                    <div className="goal-settings-line-break"></div>
                    <div className="goal-settings-label task-label">Task:</div>
                    <TaskSettingsPanel 
                        task={goal.task}
                        map={this.props.map}
                        location={goal.location}
                        onChange={task => {
                            goal.task = task
                            this.props.onChange?.()
                        }}
                    />
                    <div className="goal-settings-line-break"></div>
                    <div className="goal-settings-button-container">
                        <button className="goal-settings-btn" onClick={this.cancelClicked.bind(this)}>Cancel</button>
                        <button className="goal-settings-btn" onClick={this.doneClicked.bind(this)}>Done</button>
                    </div>
                </div>
            </div>
        )
    }
}
