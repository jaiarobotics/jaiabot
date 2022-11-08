import React from 'react'
import { Settings } from './Settings.jsx'
import Slider from '@mui/material/Slider';

let SPEED_SETTING_KEY = 'mission.plan.speeds'

export default class MissionSpeedSettingsPanel extends React.Component {

    constructor(props) {
        super(props)

        const SPEED_DEFAULTS = {
            transit: 5.0,
            stationkeep_outer: 2.0
        }

        this.state = {
            go_over_max_value: false,
            max_speed_value: 5
        }

        this.speeds = Settings.read(SPEED_SETTING_KEY) ?? SPEED_DEFAULTS
    }

    valuetext(value) {
        return `${value}`;
    }

    render() {
        return (
            <div className='panel'>
                Mission Speeds
                <table>
                    <tbody>
                        <tr>
                            <td>
                                Transit
                            </td>
                            <td>
                                {/****** Changing the max value will result in bot hardware failure ****** 
                                  ****** Please do not increase the max value unless you know the   ****** 
                                  ****** consequences                                               ******/}
                                <Slider
                                    sx={{ width: 200, backgroundColor: 'white', color: 'black'}}
                                    aria-label="Transit"
                                    defaultValue={this.speeds.transit}
                                    getAriaValueText={this.valuetext}
                                    valueLabelDisplay="auto"
                                    step={0.5}
                                    marks
                                    min={0}
                                    max={5}
                                    onChange={(evt) => 
                                    { 
                                        if(evt.target.value <= this.state.max_speed_value || this.state.go_over_max_value)
                                        {
                                            this.speeds.transit = evt.target.value; Settings.write(SPEED_SETTING_KEY, this.speeds) 
                                        } else if(confirm("Are you sure you'd like to run above the max speed level for the bot? (This could result in hardware failure)"))
                                        {
                                            this.setState({ go_over_max_value: true });
                                        }
                                    }}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Station Keep
                            </td>
                            <td>
                                {/****** Changing the max value will result in bot hardware failure ****** 
                                  ****** Please do not increase the max value unless you know the   ****** 
                                  ****** consequences                                               ******/}
                                <Slider
                                    sx={{ width: 200, backgroundColor: 'white', color: 'black'}}
                                    aria-label="Station Keep"
                                    defaultValue={this.speeds.stationkeep_outer}
                                    getAriaValueText={this.valuetext}
                                    valueLabelDisplay="auto"
                                    step={0.5}
                                    marks
                                    min={0}
                                    max={5}
                                    onChange={(evt) => 
                                    { 
                                        if(evt.target.value <= this.state.max_speed_value || this.state.go_over_max_value)
                                        {
                                            this.speeds.stationkeep_outer = evt.target.value; Settings.write(SPEED_SETTING_KEY, this.speeds)
                                        } else if(confirm("Are you sure you'd like to run above the max speed level for the bot? (This could result in hardware failure)"))
                                        {
                                            this.setState({ go_over_max_value: true });
                                        }
                                    }}
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        )        
    }

}
