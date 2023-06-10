import React from 'react'
import { PortalBotStatus } from '../PortalStatus'
import RunList from './RunList'
import { MissionInterface } from '../CommandControl'

interface Props {
    bots: { [key: number]: PortalBotStatus }
    mission: MissionInterface
    loadMissionClick: any
    saveMissionClick: any
    deleteAllRunsInMission: any
    autoAssignBotsToRuns: any
}

interface State {}

export default class RunPanel extends React.Component {
    props: Props
    state: State

    constructor(props: Props) {
        super(props)
        this.state = {}
    }

    render() {
        return (
            <React.Fragment>
                {
                    <RunList
                        bots={this.props.bots}
                        mission={this.props.mission}
                        loadMissionClick={this.props.loadMissionClick}
                        saveMissionClick={this.props.saveMissionClick}
                        deleteAllRunsInMission={this.props.deleteAllRunsInMission}
                        autoAssignBotsToRuns={this.props.autoAssignBotsToRuns}
                    />
                }
            </React.Fragment>
        )
    }
}
