import React from 'react'

import RunItem from './RunItem'
import { PortalBotStatus } from '../shared/PortalStatus'
import { MissionInterface, RunInterface } from '../CommandControl'

type RunListProps = {
    bots: {[key: number]: PortalBotStatus}
    mission: MissionInterface
    loadMissionClick: any
    saveMissionClick: any
    deleteAllRunsInMission: any
    autoAssignBotsToRuns: any
    toggleEditMode: (evt: React.ChangeEvent, run: RunInterface) => boolean
    unSelectHubOrBot: () => void
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
        if (this.props.mission.runIdInEditMode !== this.state.runIdInEditMode) {
            let openRunPanels = {...this.state.openRunPanels}
            openRunPanels[this.props.mission.runIdInEditMode] = true
            this.setState({ 
                openRunPanels, 
                runIdInEditMode: this.props.mission.runIdInEditMode 
            })
            if (this.props.mission.runIdInEditMode !== '') {
                const element = document.getElementById(
                    `run-accordion-${this.props.mission.runIdInEditMode.split('-')[1]}`
                )
                element.scrollIntoView()
            }
        }
    }

    initRunPanelStates() {
        const runIdInEditMode = this.props.mission.runIdInEditMode
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
                    Object.entries(this.props?.mission?.runs).map(([key, value]) => 
                        <React.Fragment key={key}>
                            <RunItem 
                                bots={this.props.bots} 
                                run={value} 
                                mission={this.props.mission}
                                openRunPanels={this.state.openRunPanels}
                                toggleEditMode={this.props.toggleEditMode}
                                unSelectHubOrBot={this.props.unSelectHubOrBot}
                                setOpenRunPanels={this.setOpenRunPanels.bind(this)}
                            />
                        </React.Fragment>
                    )
                }
            </div>
        )
    }
}