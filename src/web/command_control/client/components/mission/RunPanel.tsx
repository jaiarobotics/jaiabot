import React from 'react'

import RunList from './RunList'
import { PortalBotStatus } from '../shared/PortalStatus'
import { MissionInterface, RunInterface } from '../CommandControl'

type RunPanelProps = {
    bots: {[key: number]: PortalBotStatus}
    mission: MissionInterface
    loadMissionClick: any
    saveMissionClick: any
    deleteAllRunsInMission: any
    autoAssignBotsToRuns: any
    toggleEditMode: (evt: React.ChangeEvent, run: RunInterface) => boolean
    unSelectHubOrBot: () => void
}

type RunPanelState = {}

export default class RunPanel extends React.Component<RunPanelProps, RunPanelState> {
    render() { 
        return (
            <RunList
                bots={this.props.bots} 
                mission={this.props.mission}
                loadMissionClick={this.props.loadMissionClick}
                saveMissionClick={this.props.saveMissionClick}
                deleteAllRunsInMission={this.props.deleteAllRunsInMission}
                autoAssignBotsToRuns={this.props.autoAssignBotsToRuns}
                toggleEditMode={this.props.toggleEditMode}
                unSelectHubOrBot={this.props.unSelectHubOrBot}
            />
        )
    }
}
