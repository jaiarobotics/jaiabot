/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import $ from 'jquery'
import React from 'react'
import { error, success, warning, info, debug} from '../libs/notifications';

let pid_types = [ 'speed', 'heading', 'roll', 'pitch', 'depth']
let pid_gains = ['Kp', 'Ki', 'Kd']

export class PIDGainsPanel extends React.Component {

    constructor(props) {
        super(props)

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
        let botStatusRate = [
            'BotStatusRate_2_Hz',
            'BotStatusRate_1_Hz',
            'BotStatusRate_2_SECONDS',
            'BotStatusRate_5_SECONDS',
            'BotStatusRate_10_SECONDS',
            'BotStatusRate_20_SECONDS',
            'BotStatusRate_40_SECONDS',
            'BotStatusRate_60_SECONDS',
        ]

        let bots = this.state.bots

        // No bots in list
        if (bots == null || Object.keys(bots).length == 0) {
            return <div></div>
        }

        // If we haven't selected a bot yet, and there are bots available, then select the lowest indexed bot
        if (this.botId == null) {
            this.botId = Object.keys(bots)[0]
        }

        let self = this

        let botSelector = <div>
                <label style={{fontSize: "32px", marginRight: "25px", color: "#0bc9cd"}}>Bot</label>
                <select style={{width: "50px", marginBottom: "10px", color: "#0bc9cd"}} name="bot" id="pid_gains_bot_selector" defaultValue={self.botId} onChange={self.didSelectBot.bind(self)}>
                    {
                        bots ? Object.keys(bots).map((botId) => (
                            <option key={botId} value={botId}>{botId}</option>
                        )) : ""
                    }
                </select>
            </div>

        let engineering = bots[self.botId]?.engineering
        let bot_status_rate = engineering?.sendBotStatusRate ?? 'BotStatusRate_2_Hz';
        let show_rate = "N/A";

        if (engineering) {
            if(bot_status_rate != null
                || bot_status_rate != undefined)
            {
                let split_rate = bot_status_rate.split("_");
                show_rate = split_rate[1] + "_" + split_rate[2];
            }
        }

        function pidGainsTable(engineering) {
            if (engineering) {
                return <table>
                    <thead>
                        <tr key="header">
                            <th key=""></th><th key="Kp">Kp</th><th key="Ki">Ki</th><th key="Kd">Kd</th>
                        </tr>
                    </thead>
                    <tbody>
                    {
                        pid_types.map(function(pid_type) {
                            return (
                                <tr key={pid_type}>
                                    <td key="pid_type_name">{pid_type}</td>
                                    {
                                        pid_gains.map(function(pid_gain) {
                                            let pid_type_gain = pid_type + "_" + pid_gain
                                            let botId_pid_type_gain = self.botId + "_" + pid_type_gain
            
                                            return (
                                                <td key={botId_pid_type_gain}>
                                                    <input style={{maxWidth: "80px"}} type="text" id={pid_type_gain} name={pid_type_gain} defaultValue={engineering?.pidControl?.[pid_type]?.[pid_gain] ?? "-"} />
                                                </td>
                                            )
                                        })
                                    }
                                </tr>
                            )
                        })
                    }
                    </tbody>
                </table>
            }
            else {
                return <div></div>
            }
        }

        function botStatusRateTable(engineering) {
            if (engineering) {
                return  <table>
                            <tbody>
                                <tr>
                                    <td key="current_status_rate_label">Current Status Rate</td>
                                    <td key="current_status_rate">
                                        {show_rate}
                                    </td>
                                </tr>
                                <tr>
                                    <td key="status_rate_label">Update Status Rate</td>
                                    <td key="status_rate_input">
                                        <select 
                                            id="status_rate_input"
                                        >

                                            <option value="-1" key="-1">...</option>

                                            {
                                                botStatusRate.map((rate, index) => {
                                                    let split_rate = rate.split("_");
                                                    let show_rate = split_rate[1] +"_"+ split_rate[2];
                                                    return <option value={index} key={index}>{show_rate}</option>
                                                })            
                                            }

                                        </select>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
            }
            else {
                return <div></div>
            }
        }
    
        return (
            <div className="panel">
                {
                    botSelector
                }
                {
                    pidGainsTable(engineering)
                }
                <button type="button" id="submit_gains" onClick={this.submitGains.bind(this)}>Change Gains</button>
                {
                    botStatusRateTable(engineering)
                }
                <button type="button" id="submit_bot_status_rate" onClick={this.submitBotStatusRate.bind(this)}>Change Selected Bot Status Rate</button>
                <button type="button" id="submit_all_bot_status_rate" onClick={this.submitAllBotStatusRate.bind(this)}>Change All Bot Status Rate</button>
            </div>
        )
    
    }

    didSelectBot(evt) {
        this.botId = evt.target.value
        this.forceUpdate()
    }

    submitGains() {
        let botId = $("#pid_gains_bot_selector").val()
        info("Submit gains for botId: " + botId)
        let engineering_command = {
            botId: botId,
            pid_control: {}
        }

        for (let pid_type of pid_types) {
            engineering_command.pid_control[pid_type] = {}
            for (let pid_gain of pid_gains) {
                engineering_command.pid_control[pid_type][pid_gain] = Number($("#" + pid_type + "_" + pid_gain).val())
            }
        }

        debug(JSON.stringify(engineering_command))

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/jaia/pid-command", true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(engineering_command));
    }

    submitBotStatusRate()
    {
        let botId = $("#pid_gains_bot_selector").val()
        info("Submit BotStatusRate for botId: " + botId)

        let engineering_command = {
            botId: botId,
            send_bot_status_rate:  $("#status_rate_input").val()
        }

        debug(JSON.stringify(engineering_command))
        console.log(engineering_command );

        if($("#status_rate_input").val() != -1)
        {
            var xhr = new XMLHttpRequest();
            xhr.open("POST", "/jaia/pid-command", true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify(engineering_command));
        }
    }

    submitAllBotStatusRate()
    {
        info("Submit BotStatusRate for All Bots: ")
        for(let bot in this.state.bots)
        {
            let engineering_command = {
                botId: bot,
                send_bot_status_rate:  $("#status_rate_input").val()
            }
    
            debug(JSON.stringify(engineering_command))
    
            if($("#status_rate_input").val() != -1)
            {
                var xhr = new XMLHttpRequest();
                xhr.open("POST", "/jaia/pid-command", true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.send(JSON.stringify(engineering_command));
            }
        }
    }

}
