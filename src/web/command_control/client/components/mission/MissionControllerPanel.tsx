import React from 'react'
import RunPanel from './RunPanel';
import {JaiaAPI} from '../../../common/JaiaAPI'
import { PortalBotStatus } from '../shared/PortalStatus';
import { MissionInterface } from '../CommandControl';

interface Props {
	api: JaiaAPI,
	bots: {[key: number]: PortalBotStatus},
	mission: MissionInterface,
	loadMissionClick: any,
	saveMissionClick: any,
	deleteAllRunsInMission: any,
    autoAssignBotsToRuns: any,
	setEditRunMode: (botIds: number[], canEdit: boolean) => void
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
		let self = this;

		let runPanelComponent =
			<RunPanel
				bots={self.props.bots} 
				mission={self.props.mission}
				loadMissionClick={self.props.loadMissionClick}
				saveMissionClick={self.props.saveMissionClick}
				deleteAllRunsInMission={self.props.deleteAllRunsInMission}
				autoAssignBotsToRuns={self.props.autoAssignBotsToRuns}
				setEditRunMode={self.props.setEditRunMode}
			/>

		return (
			<React.Fragment>
				<div id="missionPanel" className="column-right">
					<div className="panelsContainerVertical">
						<div className="panel" >
							<b>Mission Panel</b><br />						
						</div>
						{runPanelComponent}
					</div>
				</div>
			</React.Fragment>
		)

    }
}
