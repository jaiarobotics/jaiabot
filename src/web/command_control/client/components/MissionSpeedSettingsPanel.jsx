import React from 'react'
import { Settings } from './Settings.jsx'

let SPEED_SETTING_KEY = 'mission.plan.speeds'

export default class MissionSpeedSettingsPanel extends React.Component {

    constructor(props) {
        super(props)

        const SPEED_DEFAULTS = {
            transit: 5.0,
            stationkeep_outer: 2.0
        }

        this.speeds = Settings.read(SPEED_SETTING_KEY) ?? SPEED_DEFAULTS
    }

    render() {
        return (
            <div className='panel'>
                Speeds
                <table>
                    <tbody>
                    <tr>
                            <td>
                                Transit
                            </td>
                            <td>
                                <input type="text" defaultValue={this.speeds.transit} onChange={(evt) => { this.speeds.transit = evt.target.value; Settings.write(SPEED_SETTING_KEY, this.speeds) }} />
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Station Keep
                            </td>
                            <td>
                                <input type="text" defaultValue={this.speeds.stationkeep_outer} onChange={(evt) => { this.speeds.stationkeep_outer = evt.target.value; Settings.write(SPEED_SETTING_KEY, this.speeds) }} />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        )        
    }

}
