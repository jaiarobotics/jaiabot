import React from 'react'
import { PIDGainsPanel } from './PIDGainsPanel'
import MissionSpeedSettingsPanel from './MissionSpeedSettingsPanel';
import Button from '@mui/material/Button';
import {JaiaAPI} from '../../common/JaiaAPI'
import { PortalBotStatus, PortalHubStatus } from './shared/PortalStatus';
import QueryBotStatusPanel from "./QueryBotStatusPanel"
import ScanForBotPanel from './ScanForBotPanel';

interface Props {
	api: JaiaAPI
	bots: {[key: number]: PortalBotStatus}
	hubs: {[key: number]: PortalHubStatus}
	getSelectedBotId: () => number
	getFleetId: () => number
	control: (onSuccess: () => void) => void
}

interface State {
	bots: {[key: number]: PortalBotStatus}
	hubs: {[key: number]: PortalHubStatus}
}

export default class EngineeringPanel extends React.Component {
	props: Props
	state: State

    constructor(props: Props) {
        super(props)

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
		const self = this

		return (
			<div id="engineeringPanel">
					<div className="panel-heading">Engineering Panels (Beta)</div>
					<div className="panel">
						<Button className="button-jcc engineering-panel-btn" onClick={() => window.open("/jed/")}>
							JaiaBot Engineer & Debug
						</Button>
					</div>

					<MissionSpeedSettingsPanel />

					<PIDGainsPanel bots={self.state.bots}  control={this.props.control} api={this.props.api} />

					<QueryBotStatusPanel control={this.props.control} api={this.props.api} />

					<ScanForBotPanel hubs={self.state.hubs} control={this.props.control} api={this.props.api} />
			</div>
		)

    }
}
