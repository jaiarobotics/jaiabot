import React from 'react'
import {JaiaAPI} from '../../../common/JaiaAPI'
import { PortalBotStatus } from '../PortalStatus';
import { MissionListInterface } from '../CommandControl';
import TeamMissionList from "./MissionList";
import TeamMissionDetailsPanel from './ObjectivePanel';
// Material Design Icons
import Icon from '@mdi/react'
import Button from '@mui/material/Button';
import { mdiDelete, mdiPlay, mdiFolderOpen, mdiContentSave, 
	mdiLanDisconnect, mdiCheckboxMarkedCirclePlusOutline, 
	mdiFlagVariantPlus, mdiSkipNext, mdiArrowULeftTop, mdiDownload,
    mdiStop, mdiPause, mdiViewList, mdiDotsVertical, mdiPlus} from '@mdi/js'
const goToRallyGreen = require('../../icons/go-to-rally-point-green.png')
const goToRallyRed = require('../../icons/go-to-rally-point-red.png')


interface Props {
	api: JaiaAPI
	bots: {[key: number]: PortalBotStatus}
	missionList: MissionListInterface
}

interface State {
	bots: {[key: number]: PortalBotStatus},
	missionList: MissionListInterface,
	showMissionDetails: boolean,
	showMissionId: string
}

export default class MissionControllerPanel extends React.Component {
	api: JaiaAPI

	props: Props
	state: State

    constructor(props: Props) {
        super(props)
        this.api = props.api

        this.state = {
            bots: props.bots,
			missionList: props.missionList,
			showMissionDetails: false,
			showMissionId: ""
        }
    }

    static getDerivedStateFromProps(props: Props) {
        return {
            bots: props.bots
        }
    }

    render() {
		let self = this;

		let missionListComponent = null;
		let missionDetails = null;

		if(this.state.showMissionDetails)
		{
			missionDetails =
				<TeamMissionDetailsPanel
					bots={self.state.bots} 
					teamMission={self.state.missionList?.missions[self.state.showMissionId]}
					teamMissionList={self.state.missionList}
					missionDetailsClicked={self.missionDetailsClicked.bind(self)}
				/>
		}
		else
		{
			missionListComponent = 
				<TeamMissionList
					bots={self.state.bots} 
					missionList={self.state.missionList}
					missionDetailsClicked={self.missionDetailsClicked.bind(self)}
				/>
		}

		return (
			<React.Fragment>
				<div id="missionToolbars">
					<div className="missionCard">
						<div><b>Objective 1</b></div>
						<div id="commandsDrawer">
							<Button className="button-jcc" style={{"backgroundColor":"#cc0505"}}>
								<Icon path={mdiStop} title="Stop All Missions" />
							</Button>	
							<Button className="button-jcc" id="goToRallyGreen">
								<img src={goToRallyGreen} title="Go To Start Rally" />
							</Button>
							<Button className="button-jcc" id="goToRallyRed">
								<img src={goToRallyRed} title="Go To Finish Rally" />
							</Button>			
							<Button id= "missionStartStop" className="button-jcc stopMission">
								<Icon path={mdiPlay} title="Run Mission"/>
							</Button>
							<Button className={'button-jcc'}>
								<Icon path={mdiDotsVertical} title="Get More Details"/>
							</Button>
						</div>
					</div>
					<div className="missionCard">
						<div><b>Objective 2</b></div>
						<div id="commandsDrawer">
							<Button className="button-jcc" style={{"backgroundColor":"#cc0505"}}>
								<Icon path={mdiStop} title="Stop All Missions" />
							</Button>	
							<Button className="button-jcc" id="goToRallyGreen">
								<img src={goToRallyGreen} title="Go To Start Rally" />
							</Button>
							<Button className="button-jcc" id="goToRallyRed">
								<img src={goToRallyRed} title="Go To Finish Rally" />
							</Button>			
							<Button id= "missionStartStop" className="button-jcc stopMission">
								<Icon path={mdiPlay} title="Run Mission"/>
							</Button>
							<Button className={'button-jcc'}>
								<Icon path={mdiDotsVertical} title="Get More Details"/>
							</Button>
						</div>
					</div>
					<div className="missionCard">
						<div><b>Objective 3</b></div>
						<div id="commandsDrawer">
							<Button className="button-jcc" style={{"backgroundColor":"#cc0505"}}>
								<Icon path={mdiStop} title="Stop All Missions" />
							</Button>	
							<Button className="button-jcc" id="goToRallyGreen">
								<img src={goToRallyGreen} title="Go To Start Rally" />
							</Button>
							<Button className="button-jcc" id="goToRallyRed">
								<img src={goToRallyRed} title="Go To Finish Rally" />
							</Button>			
							<Button id= "missionStartStop" className="button-jcc stopMission">
								<Icon path={mdiPlay} title="Run Mission"/>
							</Button>
							<Button className={'button-jcc'}>
								<Icon path={mdiDotsVertical} title="Get More Details"/>
							</Button>
						</div>
					</div>
					<Button 
						className="button-jcc" 
						id="add-mission" 
					>
						<Icon path={mdiPlus} title="Add Team Mission"/>
					</Button>
				</div>
				<div id="missionPanel" className="column-right">
					<div className="panelsContainerVertical">
						<div className="panel" >
							<b>Mission Panels (Beta)</b><br />						
						</div>
						{missionDetails}
						{missionListComponent}
					</div>
				</div>
			</React.Fragment>
		)

    }

	missionDetailsClicked(missionId: string) {
		this.state.showMissionDetails = !this.state.showMissionDetails;
		this.state.showMissionId = missionId;
	}
}
