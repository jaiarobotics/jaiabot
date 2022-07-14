/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react'
import { formatLatitude, formatLongitude, formatAttitudeAngle } from './Utilities'

let prec = 2

export function BotDetailsComponent(bot) {
    if (bot == null) {
        return (<div></div>)
    }

    // Get the status age
    let statusTime = bot.time
    let statusAge = Math.max(0.0, (Date.now() * 1e3 - bot.time) / 1e6).toFixed(0)

    var statusAgeClassName = ''
    if (statusAge > 30) {
        statusAgeClassName = 'red'
    }
    else if (statusAge > 10) {
        statusAgeClassName = 'yellow'
    }

    // Active Goal
    let activeGoal = bot.activeGoal ?? "None"
    var activeGoalRow = (
        <tr>
            <td>Active Goal</td>
            <td style={{whiteSpace: "pre-line"}}>{activeGoal}</td>
        </tr>
    )

    let healthClassName = {
        "HEALTH__OK": "healthOK",
        "HEALTH__DEGRADED": "healthDegraded",
        "HEALTH__FAILED": "healthFailed"
    }[bot.healthState] ?? "healthOK"

    return (
    <div>
        <h2 className="name">{`Bot ${bot?.botId}`}</h2>
        <table>
            <tbody>
                <tr>
                    <td>Health</td>
                    <td className={healthClassName}>{bot.healthState}</td>
                </tr>
                <tr>
                    <td>Status</td>
                    <td style={{whiteSpace: "pre-line"}}>{bot.missionState?.replaceAll('__', '\n')}</td>
                </tr>
                {activeGoalRow}
                <tr className={statusAgeClassName}>
                    <td>Status Age</td>
                    <td>{statusAge} sec</td>
                </tr>
                <tr>
                    <td>Latitude</td>
                    <td>{formatLatitude(bot.location?.lat)}</td>
                </tr>
                <tr>
                    <td>Longitude</td>
                    <td>{formatLongitude(bot.location?.lon)}</td>
                </tr>
                <tr>
                    <td>Depth</td>
                    <td>{bot.depth?.toFixed(prec)} m</td>
                </tr>
                <tr>
                    <td>Ground Speed</td>
                    <td>{bot.speed?.overGround?.toFixed(prec)} m/s</td>
                </tr>
                <tr>
                    <td>Heading</td>
                    <td>{formatAttitudeAngle(bot.attitude?.heading)}</td>
                </tr>
                <tr>
                    <td>Roll</td>
                    <td>{formatAttitudeAngle(bot.attitude?.roll)}</td>
                </tr>
                <tr>
                    <td>Pitch</td>
                    <td>{formatAttitudeAngle(bot.attitude?.pitch)}</td>
                </tr>
                <tr>
                    <td>Salinity</td>
                    <td>{bot.salinity?.toFixed(prec)}</td>
                </tr>
                <tr>
                    <td>Temperature</td>
                    <td>{bot.temperature?.toFixed(prec)}°C</td>
                </tr>
                <tr>
                    <td>Thermocouple</td>
                    <td>{bot.thermocoupleTemperature?.toFixed(prec)}°C</td>
                </tr>
            </tbody>
        </table>
    </div>
    )
}
