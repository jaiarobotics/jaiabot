/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react'
import { formatLatitude, formatLongitude, formatAttitudeAngle } from './Utilities'

let prec = 2

let commandDescriptions = {
    RESTART_ALL_SERVICES: "Restart Services",
    REBOOT_COMPUTER: "Reboot Bot",
    RECOVERED: "Recover Bot",
    SHUTDOWN: "Shutdown Bot"
}

function commandOptionElement(command) {
    return <option value={command} key={command}>{commandDescriptions[command]}</option>
}

function issueCommand(api, botId, commandType) {
    if (confirm("Are you sure you'd like to " + commandDescriptions[commandType] + " (" + commandType + ")?")) {
        let command = {
            botId: botId,
            type: commandType
        }

        api.postCommand(command)
    }
}

function commandOptions(missionState) {
    var commands = [
        "",
        "RESTART_ALL_SERVICES",
        "REBOOT_COMPUTER",
        "RECOVERED"
    ]

    switch(missionState) {
        case "POST_DEPLOYMENT__IDLE":
            commands = commands.concat([
                "SHUTDOWN",
            ])
            break;
    }

    let commandOptionElements = commands.map((command) => {
        return commandOptionElement(command)
    })

    return commandOptionElements
}

// Get the table row for the health of the vehicle
function healthRow(bot) {
    let healthClassName = {
        "HEALTH__OK": "healthOK",
        "HEALTH__DEGRADED": "healthDegraded",
        "HEALTH__FAILED": "healthFailed"
    }[bot.healthState] ?? "healthOK"

    let healthStateElement = <div className={healthClassName}>{bot.healthState}</div>

    let errors = bot.error ?? ['TestError', 'TestError2']
    let errorElements = errors.map((error) => {
        return <div className='healthFailed'>{error}</div>
    })
    
    let warnings = bot.warning ?? ['TestWarning', 'TestWarning2']
    let warningElements = warnings.map((warning) => {
        return <div className='healthDegraded'>{warning}</div>
    })

    return (
        <tr>
            <td>Health</td>
            <td>
                {healthStateElement}
                {errorElements}
                {warningElements}
            </td>
        </tr>
    )
}

export function BotDetailsComponent(bot, api) {
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


    return (
    <div id="botDetailsComponent">
        <h2 className="name">{`Bot ${bot?.botId}`}</h2>
        <div className='horizontal flexbox'>
        <table id="botDetailsTable">
            <tbody>
                <tr>
                    <td>Command</td>
                    <td>
                        <select onChange={(evt) => { issueCommand(api, bot.botId, evt.target.value); evt.target.selectedIndex = 0 }} value={-1}>
                            {commandOptions(bot.missionState)}
                        </select>
                    </td>
                </tr>
                {healthRow(bot)}
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
    </div>
    )
}
