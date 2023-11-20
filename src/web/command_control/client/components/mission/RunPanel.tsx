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
    deleteSingleRun: (runId: string) => void
    unSelectHubOrBot: () => void
    toggleEditMode: (evt: React.ChangeEvent, run: RunInterface) => boolean
}

type RunPanelState = {}

export default class RunPanel extends React.Component<RunPanelProps, RunPanelState> {
    /**
     * Executes the static function duplicateRun which copies
     * the run parameter and creates a new run from the run that is
     * passed as a parameter
     * 
     * @param run The run that is going to be duplicated
     * @returns {void}
     */
    addDuplicateRun(run: RunInterface) {
        Missions.duplicateRun(run, this.props.mission);
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
                deleteSingleRun={this.props.deleteSingleRun}
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
