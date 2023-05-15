import React from 'react'
import { PIDGainsPanel } from './PIDGainsPanel'
import { RCDiveParametersPanel } from './RCDiveParametersPanel'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGripVertical } from '@fortawesome/free-solid-svg-icons';
import MissionSpeedSettingsPanel from './MissionSpeedSettingsPanel';
import Button from '@mui/material/Button';
import {JaiaAPI} from '../../common/JaiaAPI'
import { PortalBotStatus, PortalHubStatus } from './PortalStatus';
import QueryBotStatusPanel from "./QueryBotStatusPanel"
import ScanForBotPanel from './ScanForBotPanel';


interface Props {
	api: JaiaAPI
	bots: {[key: number]: PortalBotStatus}
	hubs: {[key: number]: PortalHubStatus}
	getSelectedBotId: () => number
	control: () => boolean
}


interface State {
	bots: {[key: number]: PortalBotStatus}
	hubs: {[key: number]: PortalHubStatus}
}


export default class EngineeringPanel extends React.Component {
	api: JaiaAPI
	getSelectedBotId: () => number

	props: Props
	state: State

    constructor(props: Props) {
        super(props)
        this.api = props.api
        this.getSelectedBotId = props.getSelectedBotId

        this.state = {
            bots: props.bots,
            hubs: props.hubs
        }
    }

    static getDerivedStateFromProps(props: Props) {
        return {
            bots: props.bots,
            hubs: props.hubs
        }
    }

    render() {
		let self = this

		return (
			<div id="engineeringPanel" className="column-right">
				<div className="panelsContainerVertical">
					<div className="panel" >
						<b>Engineering Panels (Beta)</b><br />						
					</div>
					<div className="panel">
						<Button className="button-jcc engineering-panel-btn" onClick={() => window.open("/jed/")}>
							JaiaBot Engineer & Debug
						</Button>
						{/* 40010 is the default port number set in jaiabot/src/web/jdv/server/jaiabot_data_vision.py */}
						<Button className="button-jcc engineering-panel-btn" onClick={() => window.open("http://localhost:40010")}>
							JaiaBot Data Vision
						</Button>
					</div>

					<MissionSpeedSettingsPanel />

					<PIDGainsPanel bots={self.state.bots}  control={this.props.control} api={this.api} />

					<QueryBotStatusPanel control={this.props.control} api={this.api} />

					<ScanForBotPanel hubs={self.state.hubs} control={this.props.control} api={this.api} />

				</div>
			</div>
		)

    }
}
