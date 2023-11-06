import React from 'react'

import RunList from './RunList'
import { Goal } from '../shared/JAIAProtobuf'
import { Missions } from '../Missions'
import { MissionInterface, RunInterface } from '../CommandControl'

type RunPanelProps = {
    botIds: number[]
    mission: MissionInterface
    loadMissionClick: any
    saveMissionClick: any
    deleteAllRunsInMission: any
    autoAssignBotsToRuns: any
    unSelectHubOrBot: () => void
    toggleEditMode: (evt: React.ChangeEvent, run: RunInterface) => boolean
}

type RunPanelState = {}

export default class RunPanel extends React.Component<RunPanelProps, RunPanelState> {
    addDuplicateRun(goals: Goal[]) {
        Missions.addRunWithGoals(-1, goals, this.props.mission)
    }

    deleteRun(runId: string) {
        const run = this.props.mission.runs[runId]
        const warningString = `Are you sure you want to delete ${run.name}?`
        if (confirm(warningString)) {
            let mission = this.props.mission
            delete mission.runs[run.id]
            delete mission.botsAssignedToRuns[run.assigned]
        }
    }

    handleBotAssignChange(prevBotId: number, newBotId: number, runId: string) {
        if (isFinite(newBotId)) {
            // Delete bot assignment if changed from previous
            if (newBotId !== prevBotId) {
                delete this.props.mission.botsAssignedToRuns[prevBotId]
            }
            // Change run assignment for run to bot
            let run = this.props.mission.runs[runId]
            run.assigned = newBotId
            run.command.bot_id = newBotId
            this.props.mission.botsAssignedToRuns[run.assigned] = runId
        }
    }

    getBotsNotAssignedToRuns() {
        const botsAssignedToRuns = Object.keys(this.props.mission.botsAssignedToRuns)
        let botsNotAssignedToRuns: number[] = [] 
        this.props.botIds.forEach((botId) => {
            if (!botsAssignedToRuns.includes(botId.toString())) {
                botsNotAssignedToRuns.push(botId)
            }
        })
        return botsNotAssignedToRuns
    }

    render() {
        return (
            <RunList
                botIds={this.props.botIds}
                botsNotAssignedToRuns={this.getBotsNotAssignedToRuns()}
                runs={this.props.mission.runs}
                runIdInEditMode={this.props.mission.runIdInEditMode}
                loadMissionClick={this.props.loadMissionClick}
                saveMissionClick={this.props.saveMissionClick}
                deleteSingleRun={this.deleteRun.bind(this)}
                deleteAllRunsInMission={this.props.deleteAllRunsInMission}
                autoAssignBotsToRuns={this.props.autoAssignBotsToRuns}
                handleBotAssignChange={this.handleBotAssignChange.bind(this)}
                unSelectHubOrBot={this.props.unSelectHubOrBot}
                addDuplicateRun={this.addDuplicateRun.bind(this)}
                toggleEditMode={this.props.toggleEditMode}
            />
        )
    }
}
