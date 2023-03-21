import React from 'react'
import {JaiaAPI} from '../../../common/JaiaAPI'
import { PortalBotStatus } from '../PortalStatus';
import { MissionInterface } from '../CommandControl';
import RunPanel from './RunPanel';


interface Props {
	api: JaiaAPI,
	bots: {[key: number]: PortalBotStatus},
	mission: MissionInterface,
}

interface State {
}

export default class MissionControllerPanel extends React.Component {
	api: JaiaAPI

	props: Props
	state: State

    constructor(props: Props) {
        super(props)
        this.api = props.api

        this.state = {
        }
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
			/>

		return (
			<React.Fragment>
				<div id="missionPanel" className="column-right">
					<div className="panelsContainerVertical">
						<div className="panel" >
							<b>Run Panels (Beta)</b><br />						
						</div>
						{runPanelComponent}
					</div>
				</div>
			</React.Fragment>
		)

    }
}
