/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react'
import { formatLatitude, formatLongitude, formatAttitudeAngle } from './Utilities'

let prec = 2
let previous_status_time = Date.now() * 1e3

let commandList = [
    {
        enumString: 'ACTIVATE',
        description: 'Activate Bot',
        statesAvailable: [
            /^.+__IDLE$/
        ]
    },
    {
        enumString: 'NEXT_TASK',
        description: 'Next Task',
        statesAvailable: [
            /^IN_MISSION__.+$/
        ]
    },
    {
        enumString: 'RETURN_TO_HOME',
        description: 'Return to Home',
        statesAvailable: [
            /^IN_MISSION__.+$/
        ]
    },
    {
        enumString: 'STOP',
        description: 'Stop',
        statesAvailable: [
            /^IN_MISSION__.+$/
        ]
    },
    {
        enumString: 'RECOVERED',
        description: 'Recover Bot',
        statesAvailable: [
            /^IN_MISSION__.+$/
        ]
    },
    {
        enumString: 'SHUTDOWN',
        description: 'Shutdown Bot',
        statesAvailable: [
            /^POST_DEPLOYMENT__IDLE$/,
            /^PRE_DEPLOYMENT__.+$/
        ]
    },
    {
        enumString: 'RESTART_ALL_SERVICES',
        description: 'Restart Services'
    },
    {
        enumString: 'REBOOT_COMPUTER',
        description: 'Reboot Bot'
    },
    {
        enumString: 'SHUTDOWN_COMPUTER',
        description: 'Force Shutdown'
    }
]

function getAvailableCommands(missionState) {
    return commandList.filter((command) => {
        let statesAvailable = command.statesAvailable
        if (statesAvailable == null) {
            return true
        }

        for (let stateAvailable of statesAvailable) {
            if (stateAvailable.test(missionState)) return true;
        }

        return false;
    })
}

function issueCommand(api, botId, command) {
    if (confirm("Are you sure you'd like to " + command.description + " (" + command.enumString + ")?")) {
        let c = {
            botId: botId,
            type: command.enumString
        }

        console.log(c)
        api.postCommand(c)
    }
}

function getCommandSelectElement(api, bot) {
    let availableCommands = getAvailableCommands(bot.missionState)

    return (
        <select onChange={(evt) => { 
            issueCommand(api, bot.botId, availableCommands[evt.target.value])
            evt.target.selectedIndex = -1
        }} value={-1}>

            <option value="-1" key="-1">...</option>

            {
                availableCommands.map((command, index) => {
                    return <option value={index} key={index}>{command.description}</option>
                })            
            }

        </select>
    )
}

// Get the table row for the health of the vehicle
function healthRow(bot) {
    let healthClassName = {
        "HEALTH__OK": "healthOK",
        "HEALTH__DEGRADED": "healthDegraded",
        "HEALTH__FAILED": "healthFailed"
    }[bot.healthState] ?? "healthOK"

    let healthStateElement = <div className={healthClassName}>{bot.healthState}</div>

    let errors = bot.error ?? []
    let errorElements = errors.map((error) => {
        return <div className='healthFailed'>{error}</div>
    })
    
    let warnings = bot.warning ?? []
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

    // Get the current status time
    let current_status_time = Date.now() * 1e3

    let statusAge = Math.max(0.0, (current_status_time - previous_status_time) / 1e6).toFixed(0)

    // Set the previous status time with current status time
    previous_status_time = current_status_time

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
                        { getCommandSelectElement(api, bot) }
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
                <tr>
                    <td>5v Current</td>
                    <td>{bot.vvCurrent?.toFixed(prec)} Amps</td>
                </tr>
                <tr>
                    <td>Vcc Current</td>
                    <td>{bot.vccCurrent?.toFixed(prec)} Amps</td>
                </tr>
                <tr>
                    <td>Vcc Voltage</td>
                    <td>{bot.vccVoltage?.toFixed(prec)} Volts</td>
                </tr>
            </tbody>
        </table>
        </div>
    </div>
    )
}
