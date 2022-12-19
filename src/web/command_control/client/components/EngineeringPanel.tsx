import React from 'react'
import { PIDGainsPanel } from './PIDGainsPanel'
import * as DiveParameters from './DiveParameters'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGripVertical } from '@fortawesome/free-solid-svg-icons';
import MissionSpeedSettingsPanel from './MissionSpeedSettingsPanel';
import Button from '@mui/material/Button';
import {JaiaAPI} from '../../common/JaiaAPI'
import { PortalBotStatus } from './PortalStatus';


interface Props {
	api: JaiaAPI
	bots: {[key: number]: PortalBotStatus}
	getSelectedBotId: () => number
	control: () => boolean
}


interface State {
	bots: {[key: number]: PortalBotStatus}
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
            bots: props.bots
        }
    }

    static getDerivedStateFromProps(props: Props) {
        return {
            bots: props.bots
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
						<Button className="button-jcc" onClick={function() {
							window.location.assign('/jed/')
						} }>
							JaiaBot Engineer & Debug
						</Button>
					</div>

					<PIDGainsPanel bots={self.state.bots}  control={this.props.control} api={this.api} />

					{
						DiveParameters.panel()
					}

                    <MissionSpeedSettingsPanel />

				</div>
			</div>
		)

    }
}
