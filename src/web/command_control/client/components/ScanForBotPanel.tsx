/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */
import React from 'react'
import { error, success, warning, info, debug} from '../libs/notifications';
import Button from '@mui/material/Button';
import { CommandForHub, HubCommandType } from './shared/JAIAProtobuf';
import {JaiaAPI} from '../../common/JaiaAPI'
import { PortalHubStatus } from './shared/PortalStatus';
import { getElementById } from './shared/Utilities';

interface Props {
    hubs: {[key: number]: PortalHubStatus}
    api: JaiaAPI
	control: (onSuccess: () => void) => void
}

export default class ScanForBotPanel extends React.Component {
    props: Props

    constructor(props: Props) {
        super(props)
    }

    render() {

        return (
            <div className="panel">
                <label>Scan For Bot</label>
                <table>
                    <tbody>
                        <tr key="scan_for_bot">
                            <td>Bot-ID</td>
                            <td>
                                <input style={{maxWidth: "80px"}} 
                                    type="number" 
                                    id="scan_for_bot_input" 
                                    name="scan_for_bot_input" 
                                    defaultValue="1"
                                    min="0"
                                    max="30"
                                    step="1" 
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
                <Button className="button-jcc engineering-panel-btn" type="button" id="submit_scan_for_bot" onClick={this.submitScanForBot.bind(this)}>Scan For Bot</Button>
                <Button className="button-jcc engineering-panel-btn" type="button" id="submit_scan_for_all_bots" onClick={this.submitScanForAllBots.bind(this)}>Scan For All Bot</Button>
            </div>
        )

    }

    submitScanForBot()
    {
        this.props.control(() => {
            let botId = Number(getElementById<HTMLInputElement>("scan_for_bot_input").value)
            info("Scan for BOT-ID: " + botId)

            let hubs = this.props.hubs;
            const hubKey = Object.keys(hubs)[0];
            const hub = hubs[Number(hubKey)];

            console.log(hub);
            console.log(hub?.hub_id);

            if (hub?.hub_id != null) {
                let commandForHub: CommandForHub = {
                    hub_id: hub?.hub_id,
                    type: HubCommandType.SCAN_FOR_BOTS,
                    scan_for_bot_id: botId
                }
        
                debug(JSON.stringify(commandForHub))
        
                this.props.api.postCommandForHub(commandForHub);
            }
        })
    }

    submitScanForAllBots()
    {
        this.props.control(() => {
            let hubs = this.props.hubs;
            const hubKey = Object.keys(hubs)[0];
            const hub = hubs[Number(hubKey)];

            console.log(hub);
            console.log(hub?.hub_id);

            if (hub?.hub_id != null) {
                for (let botId in hub?.bot_ids_in_radio_file)
                {
                    let commandForHub: CommandForHub = {
                        hub_id: hub?.hub_id,
                        type: HubCommandType.SCAN_FOR_BOTS,
                        scan_for_bot_id: hub?.bot_ids_in_radio_file[botId]
                    }
            
                    debug(JSON.stringify(commandForHub))
            
                    this.props.api.postCommandForHub(commandForHub);
                }
            }
        })
    }
}
