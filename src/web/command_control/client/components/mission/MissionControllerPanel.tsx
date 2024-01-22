import React from 'react'
import RunPanel from './RunPanel';
import { JaiaAPI } from '../../../common/JaiaAPI'
import { Missions } from '../Missions'
import { MissionInterface, RunInterface } from '../CommandControl';

import Icon from '@mdi/react'
import Button from '@mui/material/Button';
import { mdiPlus, mdiDelete, mdiFolderOpen, mdiContentSave, mdiAutoFix } from '@mdi/js';

type MissionControllerProps = {
    api: JaiaAPI
    botIds: number[]
    mission: MissionInterface
    loadMissionClick: any
    saveMissionClick: any
    deleteAllRunsInMission: any
    autoAssignBotsToRuns: any
    deleteSingleRun: (runId: string) => void
    toggleEditMode: (evt: React.ChangeEvent, run: RunInterface) => boolean
    unSelectHubOrBot: () => void
    setRunList: (mission: MissionInterface) => void
    updateMissionHistory: (mission: MissionInterface) => void
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
                                    top: scrollAmount
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
                    botIds={this.props.botIds} 
                    mission={this.props.mission}
                    loadMissionClick={this.props.loadMissionClick}
                    saveMissionClick={this.props.saveMissionClick}
                    deleteAllRunsInMission={this.props.deleteAllRunsInMission}
                    autoAssignBotsToRuns={this.props.autoAssignBotsToRuns}
                    deleteSingleRun={this.props.deleteSingleRun}
                    unSelectHubOrBot={this.props.unSelectHubOrBot}
                    toggleEditMode={this.props.toggleEditMode}
                    setRunList={this.props.setRunList}
                    updateMissionHistory={this.props.updateMissionHistory}
                />
            </div>
        )
    }
}
