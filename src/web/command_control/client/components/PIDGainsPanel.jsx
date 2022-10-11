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
                <label style={{marginRight: "25px"}}>Bot</label>
                <select style={{width: "50px"}} name="bot" id="pid_gains_bot_selector" defaultValue={self.botId} onChange={self.didSelectBot.bind(self)}>
                    {
                        bots ? Object.keys(bots).map((botId) => (
                            <option key={botId} value={botId}>{botId}</option>
                        )) : ""
                    }
                </select>
            </div>

        let engineering = bots[self.botId]?.engineering

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
                                                <td key={botId_pid_type_gain}><input style={{maxWidth: "80px"}} type="text" id={pid_type_gain} name={pid_type_gain} defaultValue={engineering?.pidControl?.[pid_type]?.[pid_gain] ?? "-"} /></td>
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
    
        return (
            <div className="panel">
                {
                    botSelector
                }
                {
                    pidGainsTable(engineering)
                }
                <button type="button" id="submit_gains" onClick={this.submitGains.bind(this)}>Change Gains</button>
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

}
