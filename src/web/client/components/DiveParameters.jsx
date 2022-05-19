/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import $ from "jquery"
import React from 'react'
import { debug } from "../libs/notifications"

export function currentParameters() {
    return {
        maxDepth: $("#dive_max_depth").val(),
        depthInterval: $("#dive_depth_interval").val(),
        holdTime: $("#dive_hold_time").val(),
    }
}

export function panel() {
    return (
        <div className="panel">
            <label>Dive Parameters</label>
            <table>
                <tbody>
                    <tr key="max_depth">
                        <td>Max Depth</td>
                        <td><input type="text" id="dive_max_depth" defaultValue="1" /></td>
                    </tr>
                    <tr key="dive_depth_interval">
                        <td>Depth Interval</td>
                        <td><input type="text" id="dive_depth_interval" defaultValue="1" /></td>
                    </tr>
                    <tr key="hold_time">
                        <td>Hold Time</td>
                        <td><input type="text" id="dive_hold_time" defaultValue="0" /></td>
                    </tr>
                </tbody>
            </table>
        </div>
    )
}
