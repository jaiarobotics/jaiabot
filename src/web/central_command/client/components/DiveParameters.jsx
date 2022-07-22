/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react'
import { Settings } from './Settings'

export var currentParameters = Settings.read('diveParameters') || {
    maxDepth: 1,
    depthInterval: 1,
    holdTime: 0,
}

function setParameter(parameterName, event) {
    currentParameters[parameterName] = Number(event.target.value)
    Settings.write('diveParameters', currentParameters)
}

export function panel() {
    return (
        <div className="panel">
            <label>RC Dive Parameters</label>
            <table>
                <tbody>
                    <tr key="max_depth">
                        <td>Max Depth</td>
                        <td><input type="text" id="dive_max_depth" defaultValue={currentParameters.maxDepth} onChange={setParameter.bind(null, 'maxDepth')} /></td>
                    </tr>
                    <tr key="dive_depth_interval">
                        <td>Depth Interval</td>
                        <td><input type="text" id="dive_depth_interval" defaultValue={currentParameters.depthInterval} onChange={setParameter.bind(null, 'depthInterval')} /></td>
                    </tr>
                    <tr key="hold_time">
                        <td>Hold Time</td>
                        <td><input type="text" id="dive_hold_time" defaultValue={currentParameters.holdTime} onChange={setParameter.bind(null, 'holdTime')} /></td>
                    </tr>
                </tbody>
            </table>
        </div>
    )
}
