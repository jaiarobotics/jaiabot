/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react'
import { formatLatitude, formatLongitude, formatAttitudeAngle } from './Utilities'
import SoundEffects from './SoundEffects'
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Icon from '@mdi/react'
import { mdiPlay, mdiCheckboxMarkedCirclePlusOutline, 
	     mdiSkipNext, mdiDownload, mdiStop, mdiPause,
         mdiPower, mdiRestart, mdiRestartAlert } from '@mdi/js'
import rcMode from '../icons/controller.svg'
import goToRallyGreen from '../icons/go-to-rally-point-green.png'
import goToRallyRed from '../icons/go-to-rally-point-red.png'
import Button from '@mui/material/Button';
import { Settings } from './Settings'
import { Missions } from './Missions'
import { error, success, warning, info} from '../libs/notifications';

// TurfJS
import * as turf from '@turf/turf';

let prec = 2

let commands = {
    active: {
        enumString: 'ACTIVATE',
        description: 'Activate Bot',
        statesAvailable: [
            /^.+__IDLE$/
        ]
    },
    nextTask: {
        enumString: 'NEXT_TASK',
        description: 'Next Task',
        statesAvailable: [
            /^IN_MISSION__.+$/
        ]
    },
    goHome: {
        enumString: 'RETURN_TO_HOME',
        description: 'Return to Home',
        statesAvailable: [
            /^IN_MISSION__.+$/
        ]
    },
    stop: {
        enumString: 'STOP',
        description: 'Stop',
        statesAvailable: [
            /^IN_MISSION__.+$/
        ]
    },
    play: {
        enumString: 'START_MISSION',
        description: 'Play mission',
        statesNotAvailable: [
            /^.+__IDLE$/
        ]
    },
    rcMode: {
        enumString: 'RC_MISSION',
        description: 'RC mission',
        statesNotAvailable: [
            /^.+__IDLE$/
        ]
    },
    recover: {
        enumString: 'RECOVERED',
        description: 'Recover Bot',
        statesAvailable: [
            /^IN_MISSION__.+$/
        ]
    },
    shutdown: {
        enumString: 'SHUTDOWN',
        description: 'Shutdown Bot',
    },
    restartServices: {
        enumString: 'RESTART_ALL_SERVICES',
        description: 'Restart Services'
    },
    reboot: {
        enumString: 'REBOOT_COMPUTER',
        description: 'Reboot Bot'
    }
}

let takeControlFunction = null;

function issueCommand(api, bot_id, command) {
    if (!takeControlFunction()) return;

    if (confirm("Are you sure you'd like to " + command.description + " (" + command.enumString + ")?")) {
        let c = {
            bot_id: bot_id,
            type: command.enumString
        }

        console.log(c)
        api.postCommand(c)
    }
}

function issueMissionCommand(api, bot_mission, bot_id) {

    if (!takeControlFunction()) return;

    if (bot_mission != ""
            && confirm("Are you sure you'd like to run mission for bot: " + bot_id + "?")) {
        // Set the speed values
        let speeds = Settings.missionPlanSpeeds.get()
        if (speeds != null && bot_mission.plan != null) {
            bot_mission.plan.speeds = speeds
        }

        console.debug('Running Mission:')
        console.debug(bot_mission)

        api.postCommand(bot_mission).then(response => {
            if (response.message) {
                error(response.message)
            }
        })
    }   
}

function runRCMode(bot) {
    let bot_id = bot.bot_id;
    if (bot_id == null) {
        warning("No bots selected")
        return ""
    }

    var datum_location = bot?.location 

    if (datum_location == null) {
        const warning_string = 'RC mode issued, but bot has no location.  Should I use (0, 0) as the datum, which may result in unexpected waypoint behavior?'

        if (!confirm(warning_string)) {
            return ""
        }

        datum_location = {lat: 0, lon: 0}
    }

    return Missions.RCMode(bot_id, datum_location)[bot_id];
}

// Check if there is a mission to run
function runMission(bot_id, missions) {
    console.log(missions);
    if (missions[bot_id]) {
        info('Submitted mission for bot: ' + bot_id);
        return missions[bot_id];
    }
    else {
        error('No mission set for bot ' + bot_id);
        return "";
    }
}

// Check mission state for disabling button
function disableButton(command, mission_state)
{
    let disable = false;
    let statesAvailable = command.statesAvailable
    let statesNotAvailable = command.statesNotAvailable
    if (statesAvailable != null
            && statesAvailable != undefined) {

        for (let stateAvailable of statesAvailable) {
            if (!stateAvailable.test(mission_state)) disable = true; break;
        }
    }

    if (statesNotAvailable != null
        || statesNotAvailable != undefined) {
        for (let stateNotAvailable of statesNotAvailable) {
            if (stateNotAvailable.test(mission_state)) disable = true; break;
        }
    }

    let disableButton = {class: '', isDisabled: disable};
    if(disable)
    {
        disableButton.class = "inactive";
    }
    return disableButton;
}

// Get the table row for the health of the vehicle
function healthRow(bot, allInfo) {
    let healthClassName = {
        "HEALTH__OK": "healthOK",
        "HEALTH__DEGRADED": "healthDegraded",
        "HEALTH__FAILED": "healthFailed"
    }[bot.health_state] ?? "healthOK"

    let healthStateElement = <div className={healthClassName}>{bot.health_state}</div>

    let errors = bot.error ?? []
    let errorElements = errors.map((error) => {
        return <div key={error} className='healthFailed'>{error}</div>
    })
    
    let warnings = bot.warning ?? []
    let warningElements = warnings.map((warning) => {
        return <div key={warning} className='healthDegraded'>{warning}</div>
    })

    if(allInfo)
    {
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
    else
    {
        return (
            <tr>
                <td>Health</td>
                <td>
                    {healthStateElement}
                </td>
            </tr>
        )
    }

}

export function BotDetailsComponent(bot, hub, api, missions, closeWindow, takeControl) {
    if (bot == null) {
        return (<div></div>)
    }

    let statusAge = Math.max(0.0, bot.portalStatusAge / 1e6).toFixed(0)

    let statusAgeClassName = ''
    if (statusAge > 30) {
        statusAgeClassName = 'healthFailed'
    }
    else if (statusAge > 10) {
        statusAgeClassName = 'healthDegraded'
    }

    // Active Goal
    let activeGoal = bot.active_goal ?? "N/A"
    let distToGoal = bot.distance_to_active_goal ?? "N/A"

    if(activeGoal != "N/A"
        && distToGoal == "N/A")
    {
        distToGoal = "Distance To Goal > 1000"
    } 
    else if(activeGoal != "N/A"
            && distToGoal != "N/A")
    {
        distToGoal = distToGoal + " m"
    }
    else if(activeGoal == "N/A"
            && distToGoal != "N/A")
    {
        activeGoal = "Recovery"
        distToGoal = distToGoal + " m"
    }

    // Distance from hub
    let distToHub = "N/A"
    if (bot?.location != null
        && hub?.location != null)
    {
        let botloc = turf.point([bot.location.lon, bot.location.lat]); 
        let hubloc = turf.point([hub.location.lon, hub.location.lat]);
        var options = {units: 'meters'};

        distToHub = turf.rhumbDistance(botloc, hubloc, options).toFixed(prec);
    }

    let mission_state = bot.mission_state;
    takeControlFunction = takeControl;

    return (
        <div id='botDetailsBox'>
            <div id="botDetailsComponent">
                <div className='HorizontalFlexbox'>
                    <h2 className="name">{`Bot ${bot?.bot_id}`}</h2>
                    <div onClick={closeWindow} className="closeButton">⨯</div>
                </div>
                <Accordion defaultExpanded className="accordion">
                    <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1a-content"
                    id="panel1a-header"
                    >
                        <Typography>Quick Look</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <table>
                            <tbody>
                                <tr className={statusAgeClassName}>
                                    <td>Status Age</td>
                                    <td>{statusAge} s</td>
                                </tr>
                                {healthRow(bot, false)}
                                <tr>
                                    <td>Distance from Hub</td>
                                    <td>{distToHub} m</td>
                                </tr>
                                <tr>
                                    <td>Mission State</td>
                                    <td style={{whiteSpace: "pre-line"}}>{bot.mission_state?.replaceAll('__', '\n')}</td>
                                </tr>
                                <tr>
                                    <td>Active Goal</td>
                                    <td style={{whiteSpace: "pre-line"}}>{activeGoal}</td>
                                </tr>
                                <tr>
                                    <td>Distance to Goal</td>
                                    <td style={{whiteSpace: "pre-line"}}>{(distToGoal)}</td>
                                </tr>
                                <tr>
                                    <td>Vcc Voltage</td>
                                    <td>{bot.vcc_voltage?.toFixed(prec)} V</td>
                                </tr>
                                <tr>
                                    <td>Battery Percentage</td>
                                    <td>{bot.battery_percent?.toFixed(prec)} %</td>
                                </tr>
                            </tbody>
                        </table>
                    </AccordionDetails>
                </Accordion>
                <Accordion className="accordion">
                    <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1a-content"
                    id="panel1a-header"
                    >
                        <Typography>Commands</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Button className={disableButton(commands.stop, mission_state).class + " button-jcc stopMission"} 
                                disabled={disableButton(commands.stop, mission_state).isDisabled} 
                                onClick={() => { issueCommand(api, bot.bot_id, commands.stop) }}>
                            <Icon path={mdiStop} title="Stop Mission"/>
                        </Button>

                        <Button className={disableButton(commands.play, mission_state).class + " button-jcc"} 
                                disabled={disableButton(commands.play, mission_state).isDisabled} 
                                onClick={() => { issueMissionCommand(api, runMission(bot.bot_id, missions), bot.bot_id) }}>
                            <Icon path={mdiPlay} title="Run Mission"/>
                        </Button>

                        <Button className={disableButton(commands.nextTask, mission_state).class + " button-jcc"} 
                                disabled={disableButton(commands.nextTask, mission_state).isDisabled} 
                                onClick={() => { issueCommand(api, bot.bot_id, commands.nextTask) }}>
                            <Icon path={mdiSkipNext} title="Next Task"/>
                        </Button>

                        {/*<Button className="button-jcc inactive" disabled>
                            <Icon path={mdiPause} title="Pause Mission"/>
                        </Button>*/}

                        <Button className={disableButton(commands.active, mission_state).class + " button-jcc"} 
                                disabled={disableButton(commands.active, mission_state).isDisabled} 
                                onClick={() => { issueCommand(api, bot.bot_id, commands.active) }}>
                            <Icon path={mdiCheckboxMarkedCirclePlusOutline} title="System Check"/>
                        </Button>

                        <Button className={disableButton(commands.rcMode, mission_state).class + " button-jcc"} 
                                disabled={disableButton(commands.rcMode, mission_state).isDisabled}  
                                onClick={() => { issueMissionCommand(api, runRCMode(bot), bot.bot_id) }}>
                            <img src={rcMode} alt="Activate RC Mode" title="RC Mode"></img>
                        </Button>

                        <Button className={disableButton(commands.recover, mission_state).class + " button-jcc"} 
                                disabled={disableButton(commands.recover, mission_state).isDisabled} 
                                onClick={() => { issueCommand(api, bot.bot_id, commands.recover) }}>
                            <Icon path={mdiDownload} title="Recover"/>
                        </Button>
                        
                        <Button className={disableButton(commands.shutdown, mission_state).class + " button-jcc"} 
                                disabled={disableButton(commands.shutdown, mission_state).isDisabled} 
                                onClick={() => { issueCommand(api, bot.bot_id, commands.shutdown) }}>
                            <Icon path={mdiPower} title="Shutdown"/>
                        </Button>
                        
                        <Button className={disableButton(commands.reboot, mission_state).class + " button-jcc"} 
                                disabled={disableButton(commands.reboot, mission_state).isDisabled} 
                                onClick={() => { issueCommand(api, bot.bot_id, commands.reboot) }}>
                            <Icon path={mdiRestartAlert} title="Reboot"/>
                        </Button>
                        <Button className={disableButton(commands.restartServices, mission_state).class + " button-jcc"} 
                                disabled={disableButton(commands.restartServices, mission_state).isDisabled} 
                                onClick={() => { issueCommand(api, bot.bot_id, commands.restartServices) }}>
                            <Icon path={mdiRestart} title="Restart Services"/>
                        </Button>
                    </AccordionDetails>
                </Accordion>
                <Accordion className="accordion">
                    <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1a-content"
                    id="panel1a-header"
                    >
                        <Typography>Health Details</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <table>
                            <tbody>
                                {healthRow(bot, true)}
                            </tbody>
                        </table>
                    </AccordionDetails>
                </Accordion>
                <Accordion className="accordion">
                    <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1a-content"
                    id="panel1a-header"
                    >
                        <Typography>GPS</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <table>
                            <tbody>
                                <tr>
                                    <td>Latitude</td>
                                    <td>{formatLatitude(bot.location?.lat)}</td>
                                </tr>
                                <tr>
                                    <td>Longitude</td>
                                    <td>{formatLongitude(bot.location?.lon)}</td>
                                </tr>
                                <tr>
                                    <td>HDOP</td>
                                    <td>{bot.hdop?.toFixed(prec)}</td>
                                </tr>
                                <tr>
                                    <td>PDOP</td>
                                    <td>{bot.pdop?.toFixed(prec)}</td>
                                </tr>
                                <tr>
                                    <td>Ground Speed</td>
                                    <td>{bot.speed?.over_ground?.toFixed(prec)} m/s</td>
                                </tr>
                                <tr>
                                    <td>Course Over Ground</td>
                                    <td>{bot.attitude?.course_over_ground?.toFixed(prec)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </AccordionDetails>
                </Accordion>
                <Accordion className="accordion">
                    <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1a-content"
                    id="panel1a-header"
                    >
                        <Typography>IMU</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <table>
                            <tbody>
                                <tr>
                                    <td>Heading</td>
                                    <td>{formatAttitudeAngle(bot.attitude?.heading)}</td>
                                </tr>
                                <tr>
                                    <td>Pitch</td>
                                    <td>{formatAttitudeAngle(bot.attitude?.pitch)}</td>
                                </tr>
                                {/* <tr>
                                    <td>Roll</td>
                                    <td>{formatAttitudeAngle(bot.attitude?.roll)}</td>
                                </tr> */}
                                <tr>
                                    <td>Sys_Cal</td>
                                    <td>{bot.calibration_status?.sys.toFixed(0)}</td>
                                </tr>
                                <tr>
                                    <td>Gyro_Cal</td>
                                    <td>{bot.calibration_status?.gyro.toFixed(0)}</td>
                                </tr>
                                <tr>
                                    <td>Accel_Cal</td>
                                    <td>{bot.calibration_status?.accel.toFixed(0)}</td>
                                </tr>
                                <tr>
                                    <td>Mag_Cal</td>
                                    <td>{bot.calibration_status?.mag.toFixed(0)}</td>
                                </tr>
                            </tbody>
                        </table>              
                    </AccordionDetails>
                </Accordion>
                <Accordion className="accordion">
                    <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1a-content"
                    id="panel1a-header"
                    >
                        <Typography>Sensor Data</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <table>
                            <tbody>
                                <tr>
                                    <td>Temperature</td>
                                    <td>{bot.temperature?.toFixed(prec)} °C</td>
                                </tr>
                                <tr>
                                    <td>Depth</td>
                                    <td>{bot.depth?.toFixed(prec)} m</td>
                                </tr>
                                <tr>
                                    <td>Salinity</td>
                                    <td>{bot.salinity?.toFixed(prec)} PSU(ppt)</td>
                                </tr>
                            </tbody>
                        </table>   
                    </AccordionDetails>
                </Accordion>
                <Accordion className="accordion">
                    <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1a-content"
                    id="panel1a-header"
                    >
                        <Typography>Power</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <table>
                            <tbody>
                                <tr>
                                    <td>Battery Percentage</td>
                                    <td>{bot.battery_percent?.toFixed(prec)} %</td>
                                </tr>
                                <tr>
                                    <td>Vcc Voltage</td>
                                    <td>{bot.vcc_voltage?.toFixed(prec)} V</td>
                                </tr>
                                <tr>
                                    <td>Vcc Current</td>
                                    <td>{bot.vcc_current?.toFixed(prec)} A</td>
                                </tr>
                                <tr>
                                    <td>5v Current</td>
                                    <td>{bot.vv_current?.toFixed(prec)} A</td>
                                </tr>
                            </tbody>
                        </table>   
                    </AccordionDetails>
                </Accordion>  
            </div>
        </div>
    )
}

export function HubDetailsComponent(hub, api, closeWindow) {
    if (hub == null) {
        return (<div></div>)
    }

    let statusAge = Math.max(0.0, hub.portalStatusAge / 1e6).toFixed(0)

    var statusAgeClassName = ''
    if (statusAge > 30) {
        statusAgeClassName = 'healthFailed'
    }
    else if (statusAge > 10) {
        statusAgeClassName = 'healthDegraded'
    }

    let mission_state = hub.mission_state;

    return (
        <div id='botDetailsBox'>
            <div id="botDetailsComponent">
                <div className='HorizontalFlexbox'>
                    <h2 className="name">{`Hub ${hub?.hubId}`}</h2>
                    <div onClick={closeWindow} className="closeButton">⨯</div>
                </div>

                <Accordion defaultExpanded className="accordion">
                    <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1a-content"
                    id="panel1a-header"
                    >
                        <Typography>Quick Look</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <table>
                            <tbody>
                                {healthRow(hub)}
                                <tr>
                                    <td>Latitude</td>
                                    <td>{formatLatitude(hub.location?.lat)}</td>
                                </tr>
                                <tr>
                                    <td>Longitude</td>
                                    <td>{formatLongitude(hub.location?.lon)}</td>
                                </tr>
                                <tr className={statusAgeClassName}>
                                    <td>Status Age</td>
                                    <td>{statusAge} s</td>
                                </tr>

                            </tbody>
                        </table>
                    </AccordionDetails>
                </Accordion>
                <Accordion className="accordion">
                    <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1a-content"
                    id="panel1a-header"
                    >
                        <Typography>Commands</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Button className={disableButton(commands.shutdown, mission_state).class + " button-jcc"} 
                                disabled={disableButton(commands.shutdown, mission_state).isDisabled} 
                                onClick={() => { issueCommand(api, hub.hubId, commands.shutdown) }}>
                            <Icon path={mdiPower} title="Shutdown"/>
                        </Button>
                        <Button className={disableButton(commands.reboot, mission_state).class + " button-jcc"} 
                                disabled={disableButton(commands.reboot, mission_state).isDisabled} 
                                onClick={() => { issueCommand(api, hub.hubId, commands.reboot) }}>
                            <Icon path={mdiRestartAlert} title="Reboot"/>
                        </Button>
                        <Button className={disableButton(commands.restartServices, mission_state).class + " button-jcc"} 
                                disabled={disableButton(commands.restartServices, mission_state).isDisabled} 
                                onClick={() => { issueCommand(api, hub.hubId, commands.restartServices) }}>
                            <Icon path={mdiRestart} title="Restart Services"/>
                        </Button>
                    </AccordionDetails>
                </Accordion>
            </div>
        </div>
    )
}
