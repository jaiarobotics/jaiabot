import React from 'react'
import RunPanel from './RunPanel';
import {JaiaAPI} from '../../../common/JaiaAPI'
import { PortalBotStatus } from '../shared/PortalStatus';
import { MissionInterface, RunInterface } from '../CommandControl';
import { mdiPlus, mdiDelete, mdiFolderOpen, mdiContentSave, mdiAutoFix } from '@mdi/js';
import { Missions } from '../Missions'
import Button from '@mui/material/Button';
import Icon from '@mdi/react'

interface Props {
    api: JaiaAPI,
    bots: {[key: number]: PortalBotStatus},
    mission: MissionInterface,
    loadMissionClick: any,
    saveMissionClick: any,
    deleteAllRunsInMission: any,
    autoAssignBotsToRuns: any,
    setEditRunMode: (botIds: number[], canEdit: boolean) => void,
    setEditModeToggle: (runNumber: number, isOn: boolean) => void
    updateEditModeToggle: (run: RunInterface) => boolean,
    isEditModeToggleDisabled: (run: RunInterface) => boolean,
    toggleEditMode: (run: RunInterface) => boolean
}

export default class MissionControllerPanel extends React.Component {
    api: JaiaAPI
    props: Props

    constructor(props: Props) {
        super(props)
        this.api = props.api
    }

    static getDerivedStateFromProps(props: Props) {
        return {
            bots: props.bots
        }
    }

    render() {
		const self = this;
        const emptyMission = Object.keys(this.props.mission.runs).length == 0

		let runPanelComponent =
			<RunPanel
				bots={self.props.bots} 
				mission={self.props.mission}
				loadMissionClick={self.props.loadMissionClick}
				saveMissionClick={self.props.saveMissionClick}
				deleteAllRunsInMission={self.props.deleteAllRunsInMission}
				autoAssignBotsToRuns={self.props.autoAssignBotsToRuns}
				setEditRunMode={self.props.setEditRunMode}
				setEditModeToggle={self.props.setEditModeToggle}
				updateEditModeToggle={self.props.updateEditModeToggle}
				isEditModeToggleDisabled={self.props.isEditModeToggleDisabled}
				toggleEditMode={self.props.toggleEditMode}
			/>

		return (
			<div id="missionPanel">
				<div className="panel-heading">Mission Panel</div>
				<div className="mission-panel-commands-container">
                    <Button 
                        className="button-jcc" 
                        id="add-run" 
                        onClick={() => {
                            Missions.addRunWithWaypoints(-1, [], this.props.mission, this.props.setEditModeToggle);
                            setTimeout(() => {
                                const runListElement = document.getElementById('runList')
                                const scrollAmount = runListElement.scrollHeight
                                runListElement.scrollTo({
                                    top: scrollAmount,
                                    behavior: 'smooth'
                                })
                            }, 100)
                        }}
                    >
                        <Icon path={mdiPlus} title="Add Run"/>
                    </Button>
                    <Button 
                        className={"button-jcc" + (emptyMission ? ' inactive' : '')}
                        onClick={() => {
                            if (emptyMission) return
                            this.props.deleteAllRunsInMission(this.props.mission) 
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
				{runPanelComponent}
			</div>
		)

    }
}
