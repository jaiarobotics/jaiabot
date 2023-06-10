import React from 'react'
import { JaiaAPI } from '../../../common/JaiaAPI'
import { PortalBotStatus } from '../PortalStatus'
import { MissionInterface } from '../CommandControl'
import RunPanel from './RunPanel'

interface Props {
    api: JaiaAPI
    bots: { [key: number]: PortalBotStatus }
    mission: MissionInterface
    loadMissionClick: any
    saveMissionClick: any
    deleteAllRunsInMission: any
    autoAssignBotsToRuns: any
}

interface State {}

export default class MissionControllerPanel extends React.Component {
    api: JaiaAPI

    props: Props
    state: State

    constructor(props: Props) {
        super(props)
        this.api = props.api

        this.state = {}
    }

    static getDerivedStateFromProps(props: Props) {
        return {
            bots: props.bots
        }
    }

    render() {
        const runPanelComponent = (
            <RunPanel
                bots={this.props.bots}
                mission={this.props.mission}
                loadMissionClick={this.props.loadMissionClick}
                saveMissionClick={this.props.saveMissionClick}
                deleteAllRunsInMission={this.props.deleteAllRunsInMission}
                autoAssignBotsToRuns={this.props.autoAssignBotsToRuns}
            />
        )

        return (
            <React.Fragment>
                <div id='missionPanel' className='column-right'>
                    <div className='panelsContainerVertical'>
                        <div className='panel'>
                            <b>Mission Panel</b>
                            <br />
                        </div>
                        {runPanelComponent}
                    </div>
                </div>
            </React.Fragment>
        )
    }
}
