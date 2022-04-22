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

    return (
    <div>
        <h2 className="name">{`Bot ${bot?.botId}`}</h2>
        <table>
            <tbody>
                <tr>
                    <td>Status</td>
                    <td style={{whiteSpace: "pre-line"}}>{bot.missionState?.replaceAll('__', '\n')}</td>
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
                    <td>{bot.temperature?.toFixed(prec)}</td>
                </tr>
            </tbody>
        </table>
    </div>
    )
}
