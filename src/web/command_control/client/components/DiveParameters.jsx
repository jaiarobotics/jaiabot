/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react'
import { Settings } from './Settings'

export var currentDiveParameters = Settings.read('diveParameters') || {
    maxDepth: 1,
    depthInterval: 1,
    holdTime: 0
}

export var currentDriftParameters = Settings.read('driftParameters') || {
    driftTime: 0
}

function setDiveParameter(parameterName, event) {
    currentDiveParameters[parameterName] = Number(event.target.value)
    Settings.write('diveParameters', currentDiveParameters)
}

function setDriftParameter(parameterName, event) {
    currentDriftParameters[parameterName] = Number(event.target.value)
    Settings.write('driftParameters', currentDriftParameters)
}

export function panel() {
    return (
        <div className="panel">
            <label>RC Dive Parameters</label>
            <table>
                <tbody>
                    <tr key="max_depth">
                        <td>Max Depth</td>
                        <td><input type="text" id="dive_max_depth" defaultValue={currentDiveParameters.maxDepth} onChange={setDiveParameter.bind(null, 'maxDepth')} /></td>
                    </tr>
                    <tr key="dive_depth_interval">
                        <td>Depth Interval</td>
                        <td><input type="text" id="dive_depth_interval" defaultValue={currentDiveParameters.depthInterval} onChange={setDiveParameter.bind(null, 'depthInterval')} /></td>
                    </tr>
                    <tr key="hold_time">
                        <td>Hold Time</td>
                        <td><input type="text" id="dive_hold_time" defaultValue={currentDiveParameters.holdTime} onChange={setDiveParameter.bind(null, 'holdTime')} /></td>
                    </tr>
                    <tr key="drift_time">
                        <td>Drift Time</td>
                        <td><input type="text" id="drift_time" defaultValue={currentDriftParameters.driftTime} onChange={setDriftParameter.bind(null, 'driftTime')} /></td>
                    </tr>
                </tbody>
            </table>
        </div>
    )
}
