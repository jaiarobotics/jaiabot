import React from 'react'
import { PIDGainsPanel } from './PIDGainsPanel'
import * as DiveParameters from './DiveParameters'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGripVertical } from '@fortawesome/free-solid-svg-icons';

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

		return (
			<div id="leftSidebar" className="column-left">
				<div id="leftPanelsContainer" className="panelsContainerVertical">
					<div className="panel">
						JaiaBot Central Command<br />
						Version 1.1.0
					</div>
					<div className="panel">
						<button type="button" onClick={function() {
							window.location.assign('/pid/')
						} }>
							Jaia Engineering
						</button>
					</div>

					<PIDGainsPanel bots={this.state.bots} />

					{
						DiveParameters.panel()
					}

					<button type="button" style={{"margin": "4pt"}} onClick={function() {
						self.sna.postCommand({
							botId: this.getSelectedBotId(),
							type: "RESTART_ALL_SERVICES"
						})
					}}>
						Restart Services
					</button>

					<button type="button" style={{"margin": "4pt"}} onClick={function() {
						self.sna.postCommand({
							botId: this.getSelectedBotId(),
							type: "REBOOT_COMPUTER"
						})
					}}>
						Reboot Bot
					</button>

					<button type="button" style={{"margin": "4pt"}} onClick={function() {
						self.sna.postCommand({
							botId: this.getSelectedBotId(),
							type: "RECOVERED"
						})
					}}>
						Recover Bot
					</button>

					<button className="danger" type="button" style={{"margin": "4pt"}} onClick={function() {
						self.sna.postCommand({
							botId: this.getSelectedBotId(),
							type: "SHUTDOWN"
						})
					}}>
						Shutdown Bot
					</button>
				</div>
				<div id="sidebarResizeHandle" className="ui-resizable-handle ui-resizable-e">
					<FontAwesomeIcon icon={faGripVertical} />
				</div>
			</div>
		)

    }
}