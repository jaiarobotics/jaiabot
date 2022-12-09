/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react'
import { Settings } from './Settings'

export function panel() {
    return (
        <div className="panel">
            <label>RC Dive Parameters</label>
            <table>
                <tbody>
                    <tr key="max_depth">
                        <td>Max Depth</td>
                        <td><input type="text" id="dive_max_depth" defaultValue={Settings.diveMaxDepth.get()} onChange={(evt) => { Settings.diveMaxDepth.set(Number(evt.target.value)) }} /></td>
                    </tr>
                    <tr key="dive_depth_interval">
                        <td>Depth Interval</td>
                        <td><input type="text" id="dive_depth_interval" defaultValue={Settings.diveDepthInterval.get()} onChange={(evt) => { Settings.diveDepthInterval.set(Number(evt.target.value)) }} /></td>
                    </tr>
                    <tr key="hold_time">
                        <td>Hold Time</td>
                        <td><input type="text" id="dive_hold_time" defaultValue={Settings.diveHoldTime.get()} onChange={(evt) => { Settings.diveHoldTime.set(Number(evt.target.value)) }} /></td>
                    </tr>
                    <tr key="drift_time">
                        <td>Drift Time</td>
                        <td><input type="text" id="drift_time" defaultValue={Settings.driftTime.get()} onChange={(evt) => { Settings.driftTime.set(Number(evt.target.value)) }} /></td>
                    </tr>
                </tbody>
            </table>
        </div>
    )
}
