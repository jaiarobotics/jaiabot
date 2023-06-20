/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react'
import Button from '@mui/material/Button';
import { Goal, GeographicCoordinate } from './shared/JAIAProtobuf';
import { deepcopy } from './Utilities'
import { taskNone } from './shared/Styles';
import { rhumbDistance, rhumbBearing } from '@turf/turf';
import { TaskSettingsPanel } from './TaskSettingsPanel';
import { Map } from 'ol';


interface Props {
    key: string // When this changes, React will create a new component
    botId: number
    goalIndex: number
    goal: Goal
    onClose: () => void
    onChange: () => void
    map: Map
}


export class GoalSettingsPanel extends React.Component {

    props: Props
    oldGoal: Goal

    // Constructor will be called whenever props.key changes, i.e. whenever goal being edited changes
    constructor(props: Props) {
        super(props)

        this.oldGoal = deepcopy(props.goal)
    }

    render() {
        const { botId, goalIndex, goal } = this.props

        return (
        <div className="GoalSettingsPanel">
            <div className='HorizontalFlexbox'>
                <img src={taskNone} />
                <div className="goalSettingsHeader">Goal {goalIndex}</div>
                <div className="goalSettingsHeader">Bot {botId}</div>
            </div>
            <div>
                <TaskSettingsPanel task={goal.task} map={this.props.map} location={goal.location} onChange={task => {
                    goal.task = task
                    this.props.onChange?.()
                }} />

                <div className='HorizontalFlexbox'>
                    <Button className="button-jcc" onClick={this.cancelClicked.bind(this)}>Cancel</Button>
                    <Button className="button-jcc" onClick={this.doneClicked.bind(this)}>Done</Button>
                </div>

            </div>
        </div>
        )
    }

    doneClicked() {
        this.props.onClose?.()
    }

    cancelClicked() {
        var { goal } = this.props

        // Clear this goal
        Object.keys(goal).forEach((key: keyof Goal) => {
            delete goal[key]
        })

        // Copy items from our backup copy of the goal
        Object.assign(goal, this.oldGoal)

        this.props.onChange?.()

        this.props.onClose?.()
    }

}
