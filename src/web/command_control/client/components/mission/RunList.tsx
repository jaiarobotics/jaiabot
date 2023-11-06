import React from 'react'

import RunItem from './RunItem'
import { Goal } from '../shared/JAIAProtobuf'
import { RunInterface } from '../CommandControl'

type RunListProps = {
    botIds: number[]
    botsNotAssignedToRuns: number[]
    runIdInEditMode: string
    runs: {[key: string]: RunInterface}
    loadMissionClick: any
    saveMissionClick: any
    deleteAllRunsInMission: any
    autoAssignBotsToRuns: any

    handleBotAssignChange: (prevBotId: number, newBotId: number, runId: string) => void
    unSelectHubOrBot: () => void
    addDuplicateRun: (goals: Goal[]) => void
    deleteSingleRun: (runId: string) => void
    toggleEditMode: (evt: React.ChangeEvent, run: RunInterface) => boolean
}

type RunListState = {
    openRunPanels: {[runId: string]: boolean}
    runIdInEditMode: string
}

export default class RunList extends React.Component<RunListProps, RunListState> {
    state: RunListState = {
        openRunPanels: {},
        runIdInEditMode: ''
    }

    componentDidUpdate() {
        if (this.props.runIdInEditMode !== this.state.runIdInEditMode) {
            let openRunPanels = {...this.state.openRunPanels}
            openRunPanels[this.props.runIdInEditMode] = true
            this.setState({ 
                openRunPanels, 
                runIdInEditMode: this.props.runIdInEditMode 
            })
            if (this.props.runIdInEditMode) {
                const element = document.getElementById(
                    `run-accordion-${this.props.runIdInEditMode.split('-')[1]}`
                )
                setTimeout(() => element?.scrollIntoView(), 30) // 30 seems to be sufficent time for dropdown to establish its height               
            }
        }
    }

    initRunPanelStates() {
        const runIdInEditMode = this.props.runIdInEditMode
        const openRunPanels = {
            runIdInEditMode: true
        }
        this.setState({ openRunPanels })
    }

    setOpenRunPanels(openRunPanels: {[runId: string]: boolean}) {
        let updatedOpenRunPanels = {...openRunPanels}
        this.setState({ openRunPanels: updatedOpenRunPanels })
    }

    render() {
        return (
            <div id="runList">
                {
                    Object.entries(this.props.runs).map(([key, value]) => 
                        <React.Fragment key={key}>
                            <RunItem 
                                botIds={this.props.botIds} 
                                botsNotAssignedToRuns={this.props.botsNotAssignedToRuns}
                                runIdInEditMode={this.props.runIdInEditMode}
                                run={value} 
                                openRunPanels={this.state.openRunPanels}
                                setOpenRunPanels={this.setOpenRunPanels.bind(this)}
                                handleBotAssignChange={this.props.handleBotAssignChange}
                                unSelectHubOrBot={this.props.unSelectHubOrBot}
                                addDuplicateRun={this.props.addDuplicateRun}
                                deleteSingleRun={this.props.deleteSingleRun}
                                toggleEditMode={this.props.toggleEditMode}
                            />
                        </React.Fragment>
                    )
                }
            </div>
        )
    }
}
