import React from 'react'
import $ from 'jquery'
import { error, success, warning, info, debug } from '../libs/notifications'
import Button from '@mui/material/Button'
import { CommandForHub, HubCommandType } from './shared/JAIAProtobuf'
import { JaiaAPI } from '../../common/JaiaAPI'
import { PortalHubStatus } from './PortalStatus'

interface Props {
    hubs: { [key: number]: PortalHubStatus }
    api: JaiaAPI
    control: () => boolean
}

export default class ScanForBotPanel extends React.Component {
    props: Props

    constructor(props: Props) {
        super(props)
    }

    render() {
        return (
            <div className='panel'>
                <label>Scan For Bot</label>
                <table>
                    <tbody>
                        <tr key='scan_for_bot'>
                            <td>Bot-ID</td>
                            <td>
                                <input
                                    style={{ maxWidth: '80px' }}
                                    type='number'
                                    id='scan_for_bot_input'
                                    name='scan_for_bot_input'
                                    defaultValue='1'
                                    min='0'
                                    max='30'
                                    step='1'
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
                <Button
                    className='button-jcc engineering-panel-btn'
                    type='button'
                    id='submit_scan_for_bot'
                    onClick={this.submitScanForBot.bind(this)}
                >
                    Scan For Bot
                </Button>
                <Button
                    className='button-jcc engineering-panel-btn'
                    type='button'
                    id='submit_scan_for_all_bots'
                    onClick={this.submitScanForAllBots.bind(this)}
                >
                    Scan For All Bot
                </Button>
            </div>
        )
    }

    submitScanForBot() {
        if (!this.props.control()) return

        const botId = Number($('#scan_for_bot_input').val())
        info('Scan for BOT-ID: ' + botId)

        const hubs = this.props.hubs
        const hubKey = Object.keys(hubs)[0]
        const hub = hubs[Number(hubKey)]

        console.log(hub)
        console.log(hub?.hub_id)

        if (hub?.hub_id != null) {
            const command_for_hub: CommandForHub = {
                hub_id: hub?.hub_id,
                type: HubCommandType.SCAN_FOR_BOTS,
                scan_for_bot_id: botId
            }

            debug(JSON.stringify(command_for_hub))

            this.props.api.postCommandForHub(command_for_hub)
        }
    }

    submitScanForAllBots() {
        if (!this.props.control()) return

        const hubs = this.props.hubs
        const hubKey = Object.keys(hubs)[0]
        const hub = hubs[Number(hubKey)]

        console.log(hub)
        console.log(hub?.hub_id)

        if (hub?.hub_id != null) {
            for (const botId in hub?.bot_ids_in_radio_file) {
                const command_for_hub: CommandForHub = {
                    hub_id: hub?.hub_id,
                    type: HubCommandType.SCAN_FOR_BOTS,
                    scan_for_bot_id: hub?.bot_ids_in_radio_file[botId]
                }

                debug(JSON.stringify(command_for_hub))

                this.props.api.postCommandForHub(command_for_hub)
            }
        }
    }
}
