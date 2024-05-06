import React from 'react'

import { Speeds } from './shared/JAIAProtobuf'
import { GlobalSettings, Save } from './Settings'

import Slider from '@mui/material/Slider'
import { amber } from '@mui/material/colors'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import '../style/components/MissionSpeedSettings.less'

interface Props {}

interface State {
    speeds: Speeds
}

enum SpeedType {
    TRANSIT = 1,
    STATION_KEEP = 2
}

export default class MissionSpeedSettings extends React.Component {
    /**
     * Changing the MAX_SPEED may result in bot hardware failure. 
     * Please do not increase the MAX_SPEED unless you know the 
     * consequences.
     */
    readonly MAX_SPEED = 3
    readonly MIN_SPEED = 0.5
    readonly STEP = 0.5

    // MUI type resulting from createTheme
    theme: any
    state: State

    constructor(props: Props) {
        super(props)

        this.theme = createTheme({
            palette: {
                primary: amber
            }
        })

        this.state = {
            speeds: {
                transit: GlobalSettings.missionPlanSpeeds.transit,
                stationkeep_outer: GlobalSettings.missionPlanSpeeds.stationkeep_outer
            }
        }
    }

    /**
     * Updates state when the user interacts with the slider and saves changes to 
     * local storage
     * 
     * @param {SpeedType} speedType Signals which property of the speeds obj to update
     * @param {number} speed Holds the updated speed value set on the slider 
     * @returns {void}
     */
    handleSpeedSliderChange(speedType: SpeedType, speed: number) {
        let mutableSpeeds =  {...this.state.speeds }
        switch (speedType) {
            case SpeedType.TRANSIT: {
                mutableSpeeds.transit = speed
                break
            }
            case SpeedType.STATION_KEEP: {
                mutableSpeeds.stationkeep_outer = speed
                break
            }
        }
        this.setState({ speeds: mutableSpeeds })
        Object.assign(GlobalSettings.missionPlanSpeeds, mutableSpeeds)
        Save(GlobalSettings.missionPlanSpeeds)
    }

    render() {
        return (
            <section className='mission-speed-section'>
                
                <div>Transit</div>
                <ThemeProvider theme={this.theme}>
                    <Slider
                        aria-label="Transit"
                        defaultValue={this.state.speeds.transit}
                        step={this.STEP}
                        marks
                        min={this.MIN_SPEED}
                        max={this.MAX_SPEED}
                        onChange={ (evt: any) => { this.handleSpeedSliderChange(SpeedType.TRANSIT, Number(evt.target.value)) }
                        }
                    />
                </ThemeProvider>
                <div>{this.state.speeds.transit}</div>
                
                <div>Station Keep</div>
                <ThemeProvider theme={this.theme}>
                    <Slider
                        aria-label="Station Keep"
                        defaultValue={this.state.speeds.stationkeep_outer}
                        step={this.STEP}
                        marks
                        min={this.MIN_SPEED}
                        max={this.MAX_SPEED}
                        onChange={ (evt: any) => { this.handleSpeedSliderChange(SpeedType.STATION_KEEP, Number(evt.target.value)) }
                        }   
                    />
                </ThemeProvider>
                <div>{this.state.speeds.stationkeep_outer}</div>
            
            </section>
        )        
    }
}
