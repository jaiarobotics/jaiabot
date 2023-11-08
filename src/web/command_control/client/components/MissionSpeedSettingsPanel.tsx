import React from 'react'
import { GlobalSettings, Save } from './Settings'
import Slider, { SliderClassKey } from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import {Speeds} from './shared/JAIAProtobuf'
import { CustomAlert } from './shared/CustomAlert';


interface Props {

}


interface State {
    go_over_max_value: boolean
    safe_speed_watch: number
    speeds: Speeds
    speed_max: number
}


export default class MissionSpeedSettingsPanel extends React.Component {

    speeds: Speeds

    state: State

    constructor(props: Props) {
        super(props)

        this.speeds = GlobalSettings.missionPlanSpeeds

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
                                <Typography className="mission-speeds-label">
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
                                    min={0.5}
                                    max={this.state.speed_max}
                                    onChange={
                                        async (evt) => 
                                        {
                                            let target = evt.target as any
                                            this.state.speeds.transit = target.value; 

                                            if(this.state.speed_max <= this.state.safe_speed_watch || this.state.go_over_max_value)
                                            {
                                                //console.log("Less than max: " + evt.target.value);
                                            } else if(await CustomAlert.confirmAsync("Are you sure you'd like to run above the safe speed level for the bot? (This may result in hardware failure)", 'Run Above Safe Speed'))
                                            {
                                                this.setState({ go_over_max_value: true });
                                                //console.log("more than max: " + evt.target.value);
                                            } else
                                            {
                                                this.state.speeds.transit = this.state.safe_speed_watch; 
                                                //console.log("did not confirm: " + this.state.safe_speed_watch);
                                            }

                                            Object.assign(GlobalSettings.missionPlanSpeeds, this.state.speeds)
                                            Save(GlobalSettings.missionPlanSpeeds)
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
                                <Typography className="mission-speeds-label">
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
                                    min={0.5}
                                    max={this.state.speed_max}
                                    onChange={
                                        async (evt) => 
                                        { 
                                            this.state.speeds.stationkeep_outer = (evt.target as any).value; 

                                            if(this.state.speed_max <= this.state.safe_speed_watch || this.state.go_over_max_value)
                                            {
                                                //console.log("Less than max: " + evt.target.value);
                                            } else if(await CustomAlert.confirmAsync("Are you sure you'd like to run above the safe speed level for the bot? (This may result in hardware failure)", 'Run Above Safe Speed'))
                                            {
                                                this.setState({ go_over_max_value: true });
                                                //console.log("more than max: " + evt.target.value);
                                            } else
                                            {
                                                this.state.speeds.stationkeep_outer = this.state.safe_speed_watch; 
                                                //console.log("did not confirm: " + this.state.safe_speed_watch);
                                            }

                                            Object.assign(GlobalSettings.missionPlanSpeeds, this.state.speeds)
                                            Save(GlobalSettings.missionPlanSpeeds)
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
