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
            safe_speed_watch: 3,
            speeds: {
                transit: this.speeds.transit,
                stationkeep_outer: this.speeds.stationkeep_outer
            },
            speed_max: 3 
        }
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
                                {/****** Changing the max value may result in bot hardware failure ****** 
                                  ****** Please do not increase the max value unless you know the   ****** 
                                  ****** consequences                                               ******/}
                                <Slider
                                    sx={{ width: 175, backgroundColor: 'white', color: 'black'}}
                                    aria-label="Transit"
                                    defaultValue={this.speeds.transit}
                                    valueLabelDisplay="auto"
                                    step={0.5}
                                    marks
                                    min={0}
                                    max={this.state.speed_max}
                                    onChange={
                                        (evt) => 
                                        {
                                            this.state.speeds.transit = evt.target.value; 

                                            if(this.state.speed_max <= this.state.safe_speed_watch || this.state.go_over_max_value)
                                            {
                                                //console.log("Less than max: " + evt.target.value);
                                            } else if(confirm("Are you sure you'd like to run above the safe speed level for the bot? (This may result in hardware failure)"))
                                            {
                                                this.setState({ go_over_max_value: true });
                                                //console.log("more than max: " + evt.target.value);
                                            } else
                                            {
                                                this.state.speeds.transit = this.state.safe_speed_watch; 
                                                //console.log("did not confirm: " + this.state.safe_speed_watch);
                                            }

                                            Settings.write(SPEED_SETTING_KEY, this.state.speeds)
                                        }
                                    }
                                />
                            </td>
                            <td>
                                <Typography sx={{ width: 50 }}>
                                    {this.state.speeds.transit} m/s
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
                                {/****** Changing the max value may result in bot hardware failure ****** 
                                  ****** Please do not increase the max value unless you know the   ****** 
                                  ****** consequences                                               ******/}
                                <Slider
                                    sx={{ width: 175, backgroundColor: 'white', color: 'black'}}
                                    aria-label="Station Keep"
                                    defaultValue={this.speeds.stationkeep_outer}
                                    valueLabelDisplay="auto"
                                    step={0.5}
                                    marks
                                    min={0}
                                    max={this.state.speed_max}
                                    onChange={
                                        (evt) => 
                                        { 
                                            this.state.speeds.stationkeep_outer = evt.target.value; 

                                            if(this.state.speed_max <= this.state.safe_speed_watch || this.state.go_over_max_value)
                                            {
                                                //console.log("Less than max: " + evt.target.value);
                                            } else if(confirm("Are you sure you'd like to run above the safe speed level for the bot? (This may result in hardware failure)"))
                                            {
                                                this.setState({ go_over_max_value: true });
                                                //console.log("more than max: " + evt.target.value);
                                            } else
                                            {
                                                this.state.speeds.stationkeep_outer = this.state.safe_speed_watch; 
                                                //console.log("did not confirm: " + this.state.safe_speed_watch);
                                            }

                                            Settings.write(SPEED_SETTING_KEY, this.state.speeds)
                                        }
                                    }
                                />
                            </td>
                            <td>
                                <Typography sx={{ width: 50 }}>
                                    {this.state.speeds.stationkeep_outer} m/s
                                </Typography>
                            </td>  
                        </tr>
                    </tbody>
                </table>
            </div>
        )        
    }

}
