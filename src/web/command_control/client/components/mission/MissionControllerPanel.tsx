import React from 'react'

import RunPanel from './RunPanel';
import { JaiaAPI } from '../../../common/JaiaAPI'
import { Missions } from '../Missions'
import { PortalBotStatus } from '../shared/PortalStatus';
import { MissionInterface, RunInterface } from '../CommandControl';

import Icon from '@mdi/react'
import Button from '@mui/material/Button';
import { mdiPlus, mdiDelete, mdiFolderOpen, mdiContentSave, mdiAutoFix } from '@mdi/js';

type MissionControllerProps = {
    api: JaiaAPI
    bots: {[key: number]: PortalBotStatus}
    mission: MissionInterface
    loadMissionClick: any
    saveMissionClick: any
    deleteAllRunsInMission: any
    autoAssignBotsToRuns: any
    toggleEditMode: (evt: React.ChangeEvent, run: RunInterface) => boolean
    unSelectHubOrBot: () => void
}

type MissionControllerState = {}

export default class MissionControllerPanel extends React.Component<MissionControllerProps, MissionControllerState> {
    render() {
        const emptyMission = Object.keys(this.props.mission.runs).length === 0

		return (
			<div id="missionPanel">
				<div className="panel-heading">Mission Panel</div>
				<div className="mission-panel-commands-container">
                    <Button 
                        className="button-jcc" 
                        id="add-run" 
                        onClick={() => {
                            this.props.unSelectHubOrBot()
                            Missions.addRunWithWaypoints(-1, [], this.props.mission)
                            setTimeout(() => {
                                const runListElement = document.getElementById('runList')
                                const scrollAmount = runListElement.scrollHeight
                                runListElement.scrollTo({
                                    top: scrollAmount,
                                    // behavior: 'smooth'
                                })
                            }, 30)
                        }}
                    >
                        <Icon path={mdiPlus} title="Add Run"/>
                    </Button>
                    <Button 
                        className={"button-jcc" + (emptyMission ? ' inactive' : '')}
                        onClick={() => {
                            if (emptyMission) return
                            this.props.deleteAllRunsInMission(this.props.mission, true) 
                        }}
                    >
                        <Icon path={mdiDelete} title="Clear Mission"/>
                    </Button>
                    <Button 
                        className="button-jcc" 
                        onClick={() => { this.props.loadMissionClick() }}
                    >
                        <Icon path={mdiFolderOpen} title="Load Mission"/>
                    </Button>
                    <Button 
                        className="button-jcc" 
                        onClick={() => { this.props.saveMissionClick() }}
                    >
                        <Icon path={mdiContentSave} title="Save Mission"/>
                    </Button>
                    <Button 
                        className="button-jcc" 
                        onClick={() => { this.props.autoAssignBotsToRuns() }}
                    >
                        <Icon path={mdiAutoFix} title="Auto Assign Bots"/>
                    </Button>
                </div>
                <RunPanel
                    bots={this.props.bots} 
                    mission={this.props.mission}
                    loadMissionClick={this.props.loadMissionClick}
                    saveMissionClick={this.props.saveMissionClick}
                    deleteAllRunsInMission={this.props.deleteAllRunsInMission}
                    autoAssignBotsToRuns={this.props.autoAssignBotsToRuns}
                    toggleEditMode={this.props.toggleEditMode}
                    unSelectHubOrBot={this.props.unSelectHubOrBot}
			    />
			</div>
		)
    }
}
