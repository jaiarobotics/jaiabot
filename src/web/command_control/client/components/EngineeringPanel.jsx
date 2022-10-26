import React from 'react'
import { PIDGainsPanel } from './PIDGainsPanel'
import * as DiveParameters from './DiveParameters'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGripVertical } from '@fortawesome/free-solid-svg-icons';
import MissionSpeedSettingsPanel from './MissionSpeedSettingsPanel';
import Button from '@mui/material/Button';

export default class EngineeringPanel extends React.Component {

    constructor(props) {
        super(props)
        this.api = props.api
        this.getSelectedBotId = props.getSelectedBotId

        this.state = {
            bots: props.bots
        }
    }

    static getDerivedStateFromProps(props) {
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
						<b>Engineering Panels</b><br />						
					</div>
					<div className="panel">
						<Button className="button-jcc" onClick={function() {
							window.location.assign('/pid/')
						} }>
							JaiaBot Engineer & Debug
						</Button>
					</div>

					<PIDGainsPanel bots={self.state.bots} />

					{
						DiveParameters.panel()
					}

                    <MissionSpeedSettingsPanel />

				</div>
			</div>
		)

    }
}
