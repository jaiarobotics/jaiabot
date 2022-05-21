/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import $ from 'jquery'
import React from 'react'
import { error, success, warning, info, debug} from '../libs/notifications';

let pid_types = [ 'speed', 'heading', 'roll', 'pitch', 'depth']
let pid_gains = ['Kp', 'Ki', 'Kd']

export function PIDGainsPanel(bots) {
    if (bots == null) {
        return <div></div>
    }

    let pidGainsTable = <table>
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

                                return (
                                    <td key={pid_type_gain}><input style={{maxWidth: "80px"}} type="text" id={pid_type_gain} name={pid_type_gain} /></td>
                                )
                            })
                        }
                    </tr>
                )
            })
        }
        </tbody>
    </table>

    return (
        <div className="panel">
            <label style={{marginRight: "25px"}}>Bot</label>
            <select style={{width: "50px"}} name="bot" id="pid_gains_bot_selector">
                {
                    bots ? Object.keys(bots).map((botId) => (
                        <option key={botId} value={botId}>{botId}</option>
                    )) : ""
                }
            </select><br />
            {
                pidGainsTable
            }
            <button type="button" id="submit_gains" onClick={submitGains.bind(this)}>Change Gains</button>
        </div>
    )
}

function submitGains() {
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
