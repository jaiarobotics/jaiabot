/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */



import React from 'react'
import $ from 'jquery'
import { error, success, warning, info, debug} from '../libs/notifications';
import Button from '@mui/material/Button';
import { BotStatus, Engineering, BotStatusRate, PIDControl, RFDisableOptions } from './shared/JAIAProtobuf';
import {JaiaAPI} from '../../common/JaiaAPI'

interface Props {
    api: JaiaAPI
	control: () => boolean
}

export default class QueryBotStatusPanel extends React.Component {
    props: Props

    constructor(props: Props) {
        super(props)
    }

    render() {

        return (
            <div className="panel">
                <label>Query Bot Status</label>
                <table>
                    <tbody>
                        <tr key="bot_to_query">
                            <td>Bot Id</td>
                            <td>
                                <input style={{maxWidth: "80px"}} 
                                    type="number" 
                                    id="query_bot_status_input" 
                                    name="query_bot_status_input" 
                                    defaultValue="0"
                                    min="0"
                                    max="30"
                                    step="1" 
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
                <Button className="button-jcc" type="button" id="submit_query_bot_status" onClick={this.submitQueryBotStatus.bind(this)}>Query Bot Status</Button>
            </div>
        )

    }

    submitQueryBotStatus()
    {
        if (!this.props.control()) return;

        let botId = Number($("#query_bot_status_input").val())
        info("Query Bot Status for botId: " + botId)

        let engineering_command: Engineering = {
            bot_id: botId,
            query_bot_status: true
        }

        debug(JSON.stringify(engineering_command))

        this.props.api.postEngineeringPanel(engineering_command);
    }
}