import React from 'react'
import { Settings } from './Settings.jsx'
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';

let SPEED_SETTING_KEY = 'mission.plan.speeds'

export default class MissionSpeedSettingsPanel extends React.Component {

    constructor(props) {
        super(props)

        const SPEED_DEFAULTS = {
            transit: 2.0,
            stationkeep_outer: 1.5
        }

        this.speeds = Settings.read(SPEED_SETTING_KEY) ?? SPEED_DEFAULTS

        this.state = {
            go_over_max_value: false,
            max_speed_value: 3 
        }
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
                                <Typography>
                                    Transit
                                </Typography>        
                            </td>
                            <td>
                                {/****** Changing the max value will result in bot hardware failure ****** 
                                  ****** Please do not increase the max value unless you know the   ****** 
                                  ****** consequences                                               ******/}
                                <Slider
                                    sx={{ width: 175, backgroundColor: 'white', color: 'black'}}
                                    aria-label="Transit"
                                    key={`slider-${this.speeds.transit}`} 
                                    defaultValue={this.speeds.transit}
                                    getAriaValueText={this.valuetext}
                                    valueLabelDisplay="auto"
                                    step={0.5}
                                    marks
                                    min={0}
                                    max={3}
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
                            <td>
                                <Typography sx={{ width: 50 }}>
                                    {this.speeds.transit} m/s
                                </Typography>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <Typography>
                                    Station Keep
                                </Typography>
                            </td>
                            <td>
                                {/****** Changing the max value will result in bot hardware failure ****** 
                                  ****** Please do not increase the max value unless you know the   ****** 
                                  ****** consequences                                               ******/}
                                <Slider
                                    sx={{ width: 175, backgroundColor: 'white', color: 'black'}}
                                    aria-label="Station Keep"
                                    key={`slider-${this.speeds.stationkeep_outer}`}
                                    defaultValue={this.speeds.stationkeep_outer}
                                    getAriaValueText={this.valuetext}
                                    valueLabelDisplay="auto"
                                    step={0.5}
                                    marks
                                    min={0}
                                    max={3}
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
                            <td>
                                <Typography sx={{ width: 50 }}>
                                    {this.speeds.stationkeep_outer} m/s
                                </Typography>
                            </td>  
                        </tr>
                    </tbody>
                </table>
            </div>
        )        
    }

}
