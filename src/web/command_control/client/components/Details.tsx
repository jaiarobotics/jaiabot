/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react'
import { formatLatitude, formatLongitude, formatAttitudeAngle } from './Utilities'
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Icon } from '@mdi/react'
import { mdiPlay, mdiCheckboxMarkedCirclePlusOutline, 
	     mdiSkipNext, mdiDownload, mdiStop, mdiPause,
         mdiPower, mdiRestart, mdiRestartAlert, mdiDelete } from '@mdi/js'
const rcMode = require('../icons/controller.svg') as string
const goToRallyGreen = require('../icons/go-to-rally-point-green.png') as string
const goToRallyRed = require('../icons/go-to-rally-point-red.png') as string
import Button from '@mui/material/Button';
import { error, warning, info} from '../libs/notifications';
import { GlobalSettings } from './Settings';

// TurfJS
import * as turf from '@turf/turf';
import { JaiaAPI } from '../../common/JaiaAPI';
import { Command, CommandType, HubCommandType, BotStatus, HubStatus, MissionState, Engineering } from './shared/JAIAProtobuf';
import { PortalHubStatus, PortalBotStatus } from './shared/PortalStatus'
import { MissionInterface } from './CommandControl';
import RCControllerPanel from './RCControllerPanel'
import { Missions } from './Missions'

let prec = 2


interface CommandInfo {
    commandType: CommandType | HubCommandType,
    description: string,
    statesAvailable?: RegExp[],
    statesNotAvailable?: RegExp[],
}

let commands: {[key: string]: CommandInfo} = {
    active: {
        commandType: CommandType.ACTIVATE,
        description: 'system check',
        statesAvailable: [
            /^.+__IDLE$/,
            /^PRE_DEPLOYMENT__FAILED$/
        ]
    },
    nextTask: {
        commandType: CommandType.NEXT_TASK,
        description: 'go to the Next Task for',
        statesAvailable: [
            /^IN_MISSION__.+$/
        ]
    },
    goHome: {
        commandType: CommandType.RETURN_TO_HOME,
        description: 'Return Home',
        statesAvailable: [
            /^IN_MISSION__.+$/
        ]
    },
    stop: {
        commandType: CommandType.STOP,
        description: 'Stop',
        statesAvailable: [
            /^IN_MISSION__.+$/
        ],
        statesNotAvailable: [
            /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/
        ]
    },
    play: {
        commandType: CommandType.START_MISSION,
        description: 'Play mission',
        statesAvailable: [
            /^IN_MISSION__.+$/,
            /^PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN$/
        ]
    },
    rcMode: {
        commandType: CommandType.REMOTE_CONTROL_TASK,
        description: 'RC mission',
        statesAvailable: [
            /^IN_MISSION__.+$/,
            /^PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN$/
        ]
    },
    recover: {
        commandType: CommandType.RECOVERED,
        description: 'Recover',
        statesAvailable: [
            /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/,
        ]
    },
    retryDataOffload: {
        commandType: CommandType.RETRY_DATA_OFFLOAD,
        description: 'Retry Data Offload for',
        statesAvailable: [
            /^POST_DEPLOYMENT__IDLE$/,
            /^POST_DEPLOYMENT__WAIT_FOR_MISSION_PLAN$/,
        ]
    },
    shutdown: {
        commandType: CommandType.SHUTDOWN,
        description: 'Shutdown',
        statesAvailable: [
            /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/,
            /^PRE_DEPLOYMENT.+$/,
            /^POST_DEPLOYMENT.+$/,
        ]
    },
    restartServices: {
        commandType: CommandType.RESTART_ALL_SERVICES,
        description: 'Restart Services for',
        statesAvailable: [
            /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/,
            /^PRE_DEPLOYMENT.+$/,
            /^POST_DEPLOYMENT.+$/,
        ]
    },
    reboot: {
        commandType: CommandType.REBOOT_COMPUTER,
        description: 'Reboot',
        statesAvailable: [
            /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/,
            /^PRE_DEPLOYMENT.+$/,
            /^POST_DEPLOYMENT.+$/,
        ]
    }
}

let commandsForHub: {[key: string]: CommandInfo} = {
    shutdown: {
        commandType: CommandType.SHUTDOWN_COMPUTER,
        description: 'Shutdown Hub',
        statesNotAvailable: [
        ]
    },
    restartServices: {
        commandType: CommandType.RESTART_ALL_SERVICES,
        description: 'Restart Services',
        statesNotAvailable: [
        ]
    },
    reboot: {
        commandType: CommandType.REBOOT_COMPUTER,
        description: 'Reboot Hub',
        statesNotAvailable: [
        ]
    }
}

export interface DetailsExpandedState {
    quickLook: boolean
    commands: boolean
    advancedCommands: boolean
    health: boolean
    data: boolean
    gps: boolean
    imu: boolean
    sensor: boolean
    power: boolean
}


var takeControlFunction: () => boolean

function issueCommand(api: JaiaAPI, bot_id: number, command: CommandInfo) {
    if (!takeControlFunction()) return;

    if (confirm(`Are you sure you'd like to ${command.description} bot: ${bot_id}?`)) {
        let c = {
            bot_id: bot_id,
            type: command.commandType as CommandType
        }

        console.log(c)
        api.postCommand(c)
    }
}

function issueCommandForHub(api: JaiaAPI, hub_id: number, command_for_hub: CommandInfo) {
    console.log("Hub Command");

    if (!takeControlFunction()) return;

    if (confirm("Are you sure you'd like to " + command_for_hub.description + "?")) {
        let c = {
            hub_id: hub_id,
            type: command_for_hub.commandType as HubCommandType
        }

        console.log(c)
        api.postCommandForHub(c)
    }
}

function issueRunCommand(api: JaiaAPI, bot_mission: Command, bot_id: number) {

    if (!takeControlFunction()) return;

    if (bot_mission) {
        if (confirm("Are you sure you'd like to play this run for bot: " + bot_id + "?")) {
            // Set the speed values
            bot_mission.plan.speeds = GlobalSettings.missionPlanSpeeds
           
            console.debug('playing run:')
            console.debug(bot_mission)

            info('Submitted for bot: ' + bot_id);

            api.postCommand(bot_mission).then(response => {
                if (response.message) {
                    error(response.message)
                }
            })
        }   
    } else
    {
        warning('No run is available for bot: ' + bot_id);
    }
}

function issueRCCommand(api: JaiaAPI, bot_mission: Command, bot_id: number) {

    if (!takeControlFunction()) return;

    if (bot_mission) {
        if (confirm("Are you sure you'd like to use remote control mode for: " + bot_id + "?")) {

            console.debug('Running Remote Control:')
            console.debug(bot_mission)

            info('Submitted request for RC Mode for: ' + bot_id);

            api.postCommand(bot_mission).then(response => {
                if (response.message) {
                    error(response.message)
                }
            })
        }   
    }
}

function runRCMode(bot: PortalBotStatus) {
    let bot_id = bot.bot_id;
    if (bot_id == null) {
        warning("No bots selected")
        return null
    }

    var datum_location = bot?.location 

    if (datum_location == null) {
        const warning_string = 'RC mode issued, but bot has no location.  Should I use (0, 0) as the datum, which may result in unexpected waypoint behavior?'

        if (!confirm(warning_string)) {
            return null
        }

        datum_location = {lat: 0, lon: 0}
    }

    return Missions.RCMode(bot_id, datum_location);
}

// Check if there is a mission to run
function runMission(bot_id: number, mission: MissionInterface) {
    let runs = mission.runs;
    let runId = mission.botsAssignedToRuns[bot_id];
    let run = runs[runId];

    if (run) {
        return run.command;
    }
    else {
        return null;
    }
}

// Check mission state for disabling button
function disableButton(command: CommandInfo, mission_state: MissionState)
{
    let disable = false;
    let statesAvailable = command.statesAvailable
    let statesNotAvailable = command.statesNotAvailable
    if (statesAvailable != null
            && statesAvailable != undefined) {
        disable = true;
        for (let stateAvailable of statesAvailable) {
            if (stateAvailable.test(mission_state))
            {
                disable = false; 
                break;
            }
        }
    }

    if (statesNotAvailable != null
        || statesNotAvailable != undefined) {
        for (let stateNotAvailable of statesNotAvailable) {
            if (stateNotAvailable.test(mission_state))
            {
                disable = true;
                break;
            }
        }
    }

    let disableButton = {class: '', isDisabled: disable};
    if(disable)
    {
        disableButton.class = "inactive";
    }
    return disableButton;
}

// Check that bot has a mission for disabling button
function disableClearMissionButton(bot_id: number, mission: MissionInterface) {
    const hasAMission = mission.botsAssignedToRuns[bot_id] ? true : false
    let disableButton = {class: '', isDisabled: false};
    if (!hasAMission) {
        disableButton.class = "inactive";
        disableButton.isDisabled = true      
    }
    return disableButton
}

// Get the table row for the health of the vehicle
function healthRow(bot: BotStatus, allInfo: boolean) {
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

export function BotDetailsComponent(bot: PortalBotStatus, hub: PortalHubStatus, api: JaiaAPI, mission: MissionInterface,
        closeWindow: React.MouseEventHandler<HTMLDivElement>, takeControl: () => boolean, isExpanded: DetailsExpandedState,
        createRemoteControlInterval: () => void, clearRemoteControlInterval: () => void, remoteControlValues: Engineering,
        weAreInControl: () => boolean, weHaveRemoteControlInterval: () => boolean, deleteSingleMission: () => void,
        detailsDefaultExpanded: (accordian: keyof DetailsExpandedState) => void) {
    if (bot == null) {
        return (<div></div>)
    }

    let statusAge = Math.max(0.0, bot.portalStatusAge / 1e6)

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
    let goalTimeout = bot.active_goal_timeout ?? "N/A"

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

    if(activeGoal != "N/A")
    {
        goalTimeout = goalTimeout + " s"
    }

    // Distance from hub
    let distToHub = "N/A"
    if (bot?.location != null
        && hub?.location != null)
    {
        let botloc = turf.point([bot.location.lon, bot.location.lat]); 
        let hubloc = turf.point([hub.location.lon, hub.location.lat]);
        var options = {units: 'meters' as turf.Units};

        distToHub = turf.rhumbDistance(botloc, hubloc, options).toFixed(1);
    }

    let mission_state = bot.mission_state;
    takeControlFunction = takeControl;

    // Reuse data offload button icon for recover and retry data offload
    let dataOffloadStatesAvailable: RegExp = /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/;

    let dataOffloadButton = 
        <Button className={disableButton(commands.recover, mission_state).class + " button-jcc"} 
            disabled={disableButton(commands.recover, mission_state).isDisabled} 
            onClick={() => { issueCommand(api, bot.bot_id, commands.recover) }}>
            <Icon path={mdiDownload} title="Data Offload"/>
        </Button>

    if(!dataOffloadStatesAvailable.test(mission_state)) {
        dataOffloadButton = 
            <Button className={disableButton(commands.retryDataOffload, mission_state).class + " button-jcc"} 
                disabled={disableButton(commands.retryDataOffload, mission_state).isDisabled} 
                onClick={() => { issueCommand(api, bot.bot_id, commands.retryDataOffload) }}>
                <Icon path={mdiDownload} title="Retry Data Offload"/>
            </Button>
    }

    let bot_offload_percentage = "";

    if(bot.data_offload_percentage != undefined) {
        bot_offload_percentage = " " + bot.data_offload_percentage + "%";
    }

    return (
        <React.Fragment>
            <RCControllerPanel 
                api={api} 
                bot={bot}  
                createInterval={createRemoteControlInterval} 
                clearInterval={clearRemoteControlInterval} 
                remoteControlValues={remoteControlValues}
                weAreInControl={weAreInControl}
                weHaveInterval={weHaveRemoteControlInterval}
            />
            <div id='botDetailsBox'>
                <div className="botDetailsHeading">
                    <div className='HorizontalFlexbox'>
                        <h2 className="name">{`Bot ${bot?.bot_id}`}</h2>
                        <div onClick={closeWindow} className="closeButton">⨯</div>
                    </div>
                    <h3 className="name">Click on the map to create goals</h3>
                    <div className="botDetailsToolbar">
                        <Button className={disableButton(commands.stop, mission_state).class + " button-jcc stopMission"} 
                                disabled={disableButton(commands.stop, mission_state).isDisabled} 
                                onClick={() => { issueCommand(api, bot.bot_id, commands.stop) }}>
                            <Icon path={mdiStop} title="Stop Mission"/>
                        </Button>
                        <Button className={disableButton(commands.play, mission_state).class + " button-jcc"} 
                                    disabled={disableButton(commands.play, mission_state).isDisabled} 
                                    onClick={() => { issueRunCommand(api, runMission(bot.bot_id, mission), bot.bot_id) }}>
                                <Icon path={mdiPlay} title="Run Mission"/>
                        </Button>
                        <Button className={disableClearMissionButton(bot.bot_id, mission).class + " button-jcc"}
                                disabled={disableClearMissionButton(bot.bot_id, mission).isDisabled}
                                onClick={() => { deleteSingleMission() }}>
                            <Icon path={mdiDelete} title="Clear Mission"/>
                        </Button>
                    </div>
                </div>
                <div className="accordionContainer">
                    <Accordion 
                        expanded={isExpanded.quickLook} 
                        onChange={() => {detailsDefaultExpanded("quickLook")}}
                        className="accordion"
                    >
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
                                        <td>{statusAge.toFixed(0)} s</td>
                                    </tr>
                                    <tr>
                                        <td>Mission State</td>
                                        <td style={{whiteSpace: "pre-line"}}>{bot.mission_state?.replaceAll('__', '\n') + bot_offload_percentage}</td>
                                    </tr>
                                    <tr>
                                        <td>Battery Percentage</td>
                                        <td>{bot.battery_percent?.toFixed(prec)} %</td>
                                    </tr>
                                    <tr>
                                        <td>Active Goal</td>
                                        <td style={{whiteSpace: "pre-line"}}>{activeGoal}</td>
                                    </tr>
                                    <tr>
                                        <td>Active Goal Timeout</td>
                                        <td style={{whiteSpace: "pre-line"}}>{goalTimeout}</td>
                                    </tr>
                                    <tr>
                                        <td>Distance to Goal</td>
                                        <td style={{whiteSpace: "pre-line"}}>{(distToGoal)}</td>
                                    </tr>
                                    <tr>
                                        <td>Distance from Hub</td>
                                        <td>{distToHub} m</td>
                                    </tr>
                                </tbody>
                            </table>
                        </AccordionDetails>
                    </Accordion>
                    <Accordion 
                        expanded={isExpanded.commands} 
                        onChange={() => {detailsDefaultExpanded("commands")}}
                        className="accordion"
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            aria-controls="panel1a-content"
                            id="panel1a-header"
                        >
                            <Typography>Commands</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            {/*<Button className="button-jcc inactive" disabled>
                                <Icon path={mdiPause} title="Pause Mission"/>
                            </Button>*/}

                            <Button className={disableButton(commands.active, mission_state).class + " button-jcc"} 
                                    disabled={disableButton(commands.active, mission_state).isDisabled} 
                                    onClick={() => { issueCommand(api, bot.bot_id, commands.active) }}>
                                <Icon path={mdiCheckboxMarkedCirclePlusOutline} title="System Check"/>
                            </Button>

                            {<Button className={disableButton(commands.rcMode, mission_state).class + " button-jcc"} 
                                    disabled={disableButton(commands.rcMode, mission_state).isDisabled}  
                                    onClick={() => { issueRCCommand(api, runRCMode(bot), bot.bot_id); }}>
                                <img src={rcMode} alt="Activate RC Mode" title="RC Mode"></img>
                            </Button>}

                            <Button className={disableButton(commands.nextTask, mission_state).class + " button-jcc"} 
                                    disabled={disableButton(commands.nextTask, mission_state).isDisabled} 
                                    onClick={() => { issueCommand(api, bot.bot_id, commands.nextTask) }}>
                                <Icon path={mdiSkipNext} title="Next Task"/>
                            </Button>

                            {dataOffloadButton}

                            <Accordion 
                                expanded={isExpanded.advancedCommands} 
                                onChange={() => {detailsDefaultExpanded("advancedCommands")}}
                                className="accordion nestedAccordion"
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    aria-controls="panel1a-content"
                                    id="panel1a-header"
                                >
                                    <Typography>Advanced Commands</Typography>
                                </AccordionSummary>

                                <AccordionDetails>
                                    <Button className={disableButton(commands.shutdown, mission_state).class + " button-jcc"} 
                                            disabled={disableButton(commands.shutdown, mission_state).isDisabled} 
                                            onClick={() => {
                                                if (bot.mission_state == "IN_MISSION__UNDERWAY__RECOVERY__STOPPED") {
                                                    confirm(`Are you sure you'd like to shutdown bot: ${bot.bot_id} without doing a data offload?`) ? issueCommand(api, bot.bot_id, commands.shutdown) : false;
                                                } else {
                                                    issueCommand(api, bot.bot_id, commands.shutdown);
                                                }}
                                            }
                                    >
                                        <Icon path={mdiPower} title="Shutdown"/>
                                    </Button>
                                    <Button className={disableButton(commands.reboot, mission_state).class + " button-jcc"} 
                                            disabled={disableButton(commands.reboot, mission_state).isDisabled} 
                                            onClick={() => {
                                                if (bot.mission_state == "IN_MISSION__UNDERWAY__RECOVERY__STOPPED") {
                                                    confirm(`Are you sure you'd like to reboot bot: ${bot.bot_id} without doing a data offload?`) ? issueCommand(api, bot.bot_id, commands.reboot) : false;
                                                } else {
                                                    issueCommand(api, bot.bot_id, commands.reboot);
                                                }}
                                            }
                                    >
                                        <Icon path={mdiRestartAlert} title="Reboot"/>
                                    </Button>
                                    <Button className={disableButton(commands.restartServices, mission_state).class + " button-jcc"} 
                                            disabled={disableButton(commands.restartServices, mission_state).isDisabled} 
                                            onClick={() => {
                                                if (bot.mission_state == "IN_MISSION__UNDERWAY__RECOVERY__STOPPED") {
                                                    confirm(`Are you sure you'd like to restart bot: ${bot.bot_id} without doing a data offload?`) ? issueCommand(api, bot.bot_id, commands.restartServices) : false;
                                                } else {
                                                    issueCommand(api, bot.bot_id, commands.restartServices);
                                                }}
                                            }
                                            
                                    >
                                        <Icon path={mdiRestart} title="Restart Services"/>
                                    </Button>
                                </AccordionDetails>
                            </Accordion>

                        </AccordionDetails>
                    </Accordion>

                    <Accordion 
                        expanded={isExpanded.health} 
                        onChange={() => {detailsDefaultExpanded("health")}}
                        className="accordion"
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            aria-controls="panel1a-content"
                            id="panel1a-header"
                        >
                            <Typography>Health</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <table>
                                <tbody>
                                    {healthRow(bot, true)}
                                </tbody>
                            </table>
                        </AccordionDetails>
                    </Accordion>

                    <Accordion 
                        expanded={isExpanded.data} 
                        onChange={() => {detailsDefaultExpanded("data")}}
                        className="accordion"
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            aria-controls="panel1a-content"
                            id="panel1a-header"
                        >
                            <Typography>Data</Typography>
                        </AccordionSummary>

                        <AccordionDetails>
                            <Accordion 
                                expanded={isExpanded.gps} 
                                onChange={() => {detailsDefaultExpanded("gps")}}
                                className="accordion nestedAccordion"
                            >
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
                            <Accordion 
                                expanded={isExpanded.imu} 
                                onChange={() => {detailsDefaultExpanded("imu")}}
                                className="accordion nestedAccordion"
                            >
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
                            <Accordion 
                                expanded={isExpanded.sensor} 
                                onChange={() => {detailsDefaultExpanded("sensor")}}
                                className="accordion nestedAccordion"
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    aria-controls="panel1a-content"
                                    id="panel1a-header"
                                >
                                    <Typography>Sensors</Typography>
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
                            <Accordion 
                                expanded={isExpanded.power} 
                                onChange={() => {detailsDefaultExpanded("power")}}
                                className="accordion nestedAccordion"
                            >
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
                        </AccordionDetails>
                    </Accordion>
                </div>
            </div>
        </React.Fragment>
    )
}


export function HubDetailsComponent(hub: PortalHubStatus, api: JaiaAPI, 
    closeWindow: React.MouseEventHandler<HTMLDivElement>, isExpanded: DetailsExpandedState, takeControl: () => boolean,
    detailsDefaultExpanded: (accordian: keyof DetailsExpandedState) => void) {
    if (hub == null) {
        return (<div></div>)
    }

    let statusAge = Math.max(0.0, hub.portalStatusAge / 1e6)

    var statusAgeClassName = ''
    if (statusAge > 30) {
        statusAgeClassName = 'healthFailed'
    }
    else if (statusAge > 10) {
        statusAgeClassName = 'healthDegraded'
    }

    takeControlFunction = takeControl;

    return (
        <div id='botDetailsBox'>
            <div id="botDetailsComponent">
                <div className='HorizontalFlexbox'>
                    <h2 className="name">{`Hub ${hub?.hub_id}`}</h2>
                    <div onClick={closeWindow} className="closeButton">⨯</div>
                </div>

                <Accordion 
                    expanded={isExpanded.quickLook} 
                    onChange={() => {detailsDefaultExpanded("quickLook")}}
                    className="accordion"
                >
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
                                {healthRow(hub, false)}
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
                                    <td>{statusAge.toFixed(0)} s</td>
                                </tr>

                            </tbody>
                        </table>
                    </AccordionDetails>
                </Accordion>
                <Accordion 
                    expanded={isExpanded.commands} 
                    onChange={() => {detailsDefaultExpanded("commands")}}
                    className="accordion"
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls="panel1a-content"
                        id="panel1a-header"
                    >
                        <Typography>Commands</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Button className={" button-jcc"} 
                                onClick={() => { issueCommandForHub(api, hub.hub_id, commandsForHub.shutdown) }}>
                            <Icon path={mdiPower} title="Shutdown"/>
                        </Button>
                        <Button className={" button-jcc"} 
                                onClick={() => { issueCommandForHub(api, hub.hub_id, commandsForHub.reboot) }}>
                            <Icon path={mdiRestartAlert} title="Reboot"/>
                        </Button>
                        <Button className={" button-jcc"}  
                                onClick={() => { issueCommandForHub(api, hub.hub_id, commandsForHub.restartServices) }}>
                            <Icon path={mdiRestart} title="Restart Services"/>
                        </Button>
                    </AccordionDetails>
                </Accordion>
            </div>
        </div>
    )
}
