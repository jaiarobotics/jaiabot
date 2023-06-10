import React from 'react'
import { GlobalSettings, Save } from './Settings'

export function RCDiveParametersPanel(): JSX.Element {
    const diveParameters = GlobalSettings.diveParameters
    const driftParameters = GlobalSettings.driftParameters

    return (
        <div className='panel'>
            <label>RC Dive Parameters</label>
            <table>
                <tbody>
                    <tr key='max_depth'>
                        <td>Max Depth</td>
                        <td>
                            <input
                                type='text'
                                id='dive_max_depth'
                                defaultValue={diveParameters.max_depth}
                                onChange={(evt) => {
                                    diveParameters.max_depth = Number(evt.target.value)
                                    Save(diveParameters)
                                }}
                            />
                        </td>
                    </tr>
                    <tr key='dive_depth_interval'>
                        <td>Depth Interval</td>
                        <td>
                            <input
                                type='text'
                                id='dive_depth_interval'
                                defaultValue={diveParameters.depth_interval}
                                onChange={(evt) => {
                                    diveParameters.depth_interval = Number(evt.target.value)
                                    Save(diveParameters)
                                }}
                            />
                        </td>
                    </tr>
                    <tr key='hold_time'>
                        <td>Hold Time</td>
                        <td>
                            <input
                                type='text'
                                id='dive_hold_time'
                                defaultValue={diveParameters.hold_time}
                                onChange={(evt) => {
                                    diveParameters.hold_time = Number(evt.target.value)
                                    Save(diveParameters)
                                }}
                            />
                        </td>
                    </tr>
                    <tr key='drift_time'>
                        <td>Drift Time</td>
                        <td>
                            <input
                                type='text'
                                id='drift_time'
                                defaultValue={driftParameters.drift_time}
                                onChange={(evt) => {
                                    driftParameters.drift_time = Number(evt.target.value)
                                    Save(driftParameters)
                                }}
                            />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    )
}
