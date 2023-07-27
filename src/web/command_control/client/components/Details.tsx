import React, { useEffect } from 'react'
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditModeToggle from './EditModeToggle';
import { formatLatitude, formatLongitude, formatAttitudeAngle, addDropdownListener } from './shared/Utilities'
import { Icon } from '@mdi/react'
import { mdiPlay, mdiCheckboxMarkedCirclePlusOutline, 
	     mdiSkipNext, mdiDownload, mdiStop,
         mdiPower, mdiRestart, mdiRestartAlert, mdiDelete , mdiDatabaseEyeOutline} from '@mdi/js'
import Button from '@mui/material/Button';
import { error, warning, info} from '../libs/notifications';
import { GlobalSettings } from './Settings';
import { JaiaAPI } from '../../common/JaiaAPI';
import { Command, CommandType, HubCommandType, BotStatus, MissionState } from './shared/JAIAProtobuf';
import { PortalHubStatus, PortalBotStatus } from './shared/PortalStatus'
import { MissionInterface, RunInterface } from './CommandControl';
import { Missions } from './Missions'
import * as turf from '@turf/turf';

const rcMode = require('../icons/controller.svg') as string

let prec = 2

interface CommandInfo {
    commandType: CommandType | HubCommandType,
    description: string,
    statesAvailable?: RegExp[],
    statesNotAvailable?: RegExp[],
}

const commands: {[key: string]: CommandInfo} = {
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
        ],
        statesNotAvailable: [
            /REMOTE_CONTROL/
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
            /^PRE_DEPLOYMENT.+$/,
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

const enabledEditStates = ['PRE_DEPLOYMENT', 'RECOVERY', 'STOPPED', 'POST_DEPLOYMENT']

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
    links: boolean
}


var takeControlFunction: () => boolean

function issueCommand(api: JaiaAPI, botId: number, command: CommandInfo) {
    if (!takeControlFunction()) return false

    if (confirm(`Are you sure you'd like to ${command.description} bot: ${botId}?`)) {
        let c = {
            bot_id: botId,
            type: command.commandType as CommandType
        }

        console.log(c)
        api.postCommand(c)
        return true
    }
    return false
}

function issueCommandForHub(api: JaiaAPI, hub_id: number, commandForHub: CommandInfo) {
    console.log('Hub Command');

    if (!takeControlFunction()) return;

    if (confirm("Are you sure you'd like to " + commandForHub.description + '?')) {
        let c = {
            hub_id: hub_id,
            type: commandForHub.commandType as HubCommandType
        }

        console.log(c)
        api.postCommandForHub(c)
    }
}

function issueRunCommand(api: JaiaAPI, bot: PortalBotStatus, botRun: Command, botId: number) {

    if (!takeControlFunction()) return;

    if (botRun) {
        if (bot.health_state !== 'HEALTH__OK') {
            alert('Cannot perform this run without a health state of "HEALTH__OK"')
            return
        }

        if (confirm("Are you sure you'd like to play this run for Bot: " + botId + '?')) {
            // Set the speed values
            botRun.plan.speeds = GlobalSettings.missionPlanSpeeds
           
            console.debug('playing run:')
            console.debug(botRun)

            info('Submitted for Bot: ' + botId);

            api.postCommand(botRun).then(response => {
                if (response.message) {
                    error(response.message)
                }
            })
        }   
    } else {
        warning('No run is available for Bot: ' + botId);
    }
}

function issueRCCommand(api: JaiaAPI, botMission: Command, botId: number, isRCModeActive: (botId: number) => boolean) {

    if (!takeControlFunction() || !botMission) return;

    const isRCActive = isRCModeActive(botId)

    if (!isRCActive) {
        if (confirm("Are you sure you'd like to use remote control mode for Bot: " + botId + '?')) {

            console.debug('Running Remote Control:')
            console.debug(botMission)

            info('Submitted request for RC Mode for: ' + botId);

            api.postCommand(botMission).then(response => {
                if (response.message) {
                    error(response.message)
                }
            })
        }   
    } else {
        issueCommand(api, botId, commands.stop)
    }
}

function runRCMode(bot: PortalBotStatus) {
    const bot_id = bot.bot_id;
    if (!bot_id) {
        warning('No bots selected')
        return null
    }

    let datumLocation = bot?.location 

    if (!datumLocation) {
        const warningString = 'RC mode issued, but bot has no location. Should I use (0, 0) as the datum, which may result in unexpected waypoint behavior?'

        if (!confirm(warningString)) {
            return null
        }

        datumLocation = {lat: 0, lon: 0}
    }

    return Missions.RCMode(bot_id, datumLocation);
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

/**
 * Checks if a details button should be disabled 
 * 
 * @param bot 
 * @returns boolean
 */
function disableButton(command: CommandInfo, missionState: MissionState) {
    let disable = true
    const statesAvailable = command.statesAvailable
    const statesNotAvailable = command.statesNotAvailable
    
    if (statesAvailable) {
        for (let stateAvailable of statesAvailable) {
            if (stateAvailable.test(missionState)) {
                disable = false
                break
            }
        }
    }

    if (statesNotAvailable) {
        for (let stateNotAvailable of statesNotAvailable) {
            if (stateNotAvailable.test(missionState)) {
                disable = true
                break
            }
        }
    }

    if (disable) { return true }
    return false
}

/**
 * Checks if clear run button should be disabled 
 * 
 * @param bot 
 * @returns boolean
 */
function disableClearRunButton(bot: PortalBotStatus, mission: MissionInterface) {
    const missionState = bot?.mission_state
    let disable = true

    // Basic error handling
    if (!missionState) {
        return true
    }

    // The bot doesn't have an assigned run to delete
    if (!mission.botsAssignedToRuns[bot.bot_id]) {
        return true
    }

    enabledEditStates.forEach((enabledState) => {
        if (missionState.includes(enabledState)) {
            disable = false
        }
    })

    if (!disable) { return false }
    return true
}

function disablePlayButton(bot: PortalBotStatus, mission: MissionInterface, command: CommandInfo, missionState: MissionState) {
    if (!mission.botsAssignedToRuns[bot.bot_id]) {
        return true
    }

    if (disableButton(command, missionState)) {
        return true
    }

    let inMission = true
    for (const enabledState of enabledEditStates) {
        if (missionState.includes(enabledState)) {
            inMission = false
        }
    }
    return inMission
}

function toggleRCModeButton(missionState: MissionState) {
    if (missionState.includes('REMOTE_CONTROL')) {
        return true
    }
    return false
}

// Get the table row for the health of the vehicle
function healthRow(bot: BotStatus, allInfo: boolean) {
    let healthClassName = {
        'HEALTH__OK': 'healthOK',
        'HEALTH__DEGRADED': 'healthDegraded',
        'HEALTH__FAILED': 'healthFailed'
    }[bot.health_state] ?? 'healthOK'

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

export interface BotDetailsProps {
    bot: PortalBotStatus,
    hub: PortalHubStatus,
    api: JaiaAPI,
    mission: MissionInterface,
    run: RunInterface,
    isExpanded: DetailsExpandedState,
    closeWindow: () => void,
    takeControl: () => boolean,
    deleteSingleMission: () => void,
    setDetailsExpanded: (section: keyof DetailsExpandedState, expanded: boolean) => void,
    isRCModeActive: (botId: number) => boolean,
    updateEditModeToggle: (run: RunInterface) => boolean,
    isEditModeToggleDisabled: (run: RunInterface) => boolean,
    toggleEditMode: (run: RunInterface) => boolean
}

export function BotDetailsComponent(props: BotDetailsProps) {
    const bot = props.bot
    const hub = props.hub
    const api = props.api
    const mission = props.mission
    const closeWindow = props.closeWindow
    const takeControl = props.takeControl
    const isExpanded = props.isExpanded
    const deleteSingleMission = props.deleteSingleMission
    const setDetailsExpanded = props.setDetailsExpanded
    const isRCModeActive = props.isRCModeActive

    if (!bot) {
        return (<div></div>)
    }

    useEffect(() => {
        addDropdownListener('accordionContainer', 'botDetailsAccordionContainer', 400)
    }, [])

    const statusAge = Math.max(0.0, bot.portalStatusAge / 1e6)
    let statusAgeClassName: string

    if (statusAge > 30) {
        statusAgeClassName = 'healthFailed'
    } else if (statusAge > 10) {
        statusAgeClassName = 'healthDegraded'
    }

    // Active Goal
    let activeGoal = bot.active_goal ?? 'N/A'
    let distToGoal = bot.distance_to_active_goal ?? 'N/A'
    let goalTimeout = bot.active_goal_timeout ?? 'N/A'

    if (activeGoal !== 'N/A' && distToGoal === 'N/A') {
        distToGoal = 'Distance To Goal > 1000'
    } else if (activeGoal !== 'N/A' && distToGoal !== 'N/A') {
        distToGoal = distToGoal + ' m'
    } else if (activeGoal === 'N/A' && distToGoal !== 'N/A') {
        activeGoal = 'Recovery'
        distToGoal = distToGoal + ' m'
    }

    if (activeGoal !== 'N/A') {
        goalTimeout = goalTimeout + ' s'
    }

    // Distance from hub
    let distToHub = 'N/A'
    if (bot?.location && hub?.location) {
        const botloc = turf.point([bot.location.lon, bot.location.lat])
        const hubloc = turf.point([hub.location.lon, hub.location.lat])
        const options = {units: 'meters' as turf.Units}
        distToHub = turf.rhumbDistance(botloc, hubloc, options).toFixed(1)
    }

    const missionState = bot.mission_state
    takeControlFunction = takeControl

    let linkQualityPercentage = 0;

    if (bot?.wifi_link_quality_percentage != undefined) {
        linkQualityPercentage = bot?.wifi_link_quality_percentage
    } 

    let dataOffloadButton = (
        <Button className={disableButton(commands.recover, missionState) || !linkQualityPercentage ? 'inactive button-jcc' : 'button-jcc'} 
            disabled={disableButton(commands.recover, missionState) || !linkQualityPercentage ? true : false} 
            onClick={() => { issueCommand(api, bot.bot_id, commands.recover) }}>
            <Icon path={mdiDownload} title='Data Offload'/>
        </Button>
    )

    if (disableButton(commands.recover, missionState)) {
        dataOffloadButton = ( 
            <Button className={disableButton(commands.retryDataOffload, missionState) || !linkQualityPercentage ? 'inactive button-jcc' : 'button-jcc'} 
                disabled={disableButton(commands.retryDataOffload, missionState) || !linkQualityPercentage ? true : false} 
                onClick={() => { issueCommand(api, bot.bot_id, commands.retryDataOffload) }}>
                <Icon path={mdiDownload} title='Retry Data Offload'/>
            </Button>
        )
    }

    let botOffloadPercentage = ''

    if (bot.data_offload_percentage) {
        botOffloadPercentage = ' ' + bot.data_offload_percentage + '%'
    }

    return (
        <React.Fragment>
            <div id='botDetailsBox'>
                <div className='botDetailsHeading'>
                    <div className='HorizontalFlexbox'>
                        <h2 className='name'>{`Bot ${bot?.bot_id}`}</h2>
                        <div onClick={() => closeWindow()} className='closeButton'>⨯</div>
                    </div>
                    <h3 className='name'>Click on the map to create goals</h3>
                    <div className='botDetailsToolbar'>
                        <Button
                            className={disableButton(commands.stop, missionState) ? 'inactive button-jcc' : ' button-jcc stopMission'} 
                            disabled={disableButton(commands.stop, missionState)} 
                            onClick={() => { issueCommand(api, bot.bot_id, commands.stop) }}>
                            <Icon path={mdiStop} title='Stop Mission'/>
                        </Button>
                        <Button
                            className={disablePlayButton(bot, mission, commands.play, missionState) ? 'inactive button-jcc' : 'button-jcc'} 
                            disabled={disablePlayButton(bot, mission, commands.play, missionState)} 
                            onClick={() => { issueRunCommand(api, bot, runMission(bot.bot_id, mission), bot.bot_id) }}>
                            <Icon path={mdiPlay} title='Run Mission'/>
                        </Button>
                        <Button 
                            className={ disableClearRunButton(bot, mission) ? 'inactive button-jcc' : 'button-jcc' }
                            disabled={ disableClearRunButton(bot, mission) }
                            onClick={() => { deleteSingleMission() }}>
                            <Icon path={mdiDelete} title='Clear Mission'/>
                        </Button>

                        <EditModeToggle 
                            checked={props.updateEditModeToggle} 
                            disabled={props.isEditModeToggleDisabled} 
                            onClick={props.toggleEditMode}
                            run={props.run}
                            label='Edit'
                            title='ToggleEditMode'
                        />
                    </div>
                </div>
                <div id='botDetailsAccordionContainer' className='accordionParentContainer'>
                    <Accordion 
                        expanded={isExpanded.quickLook} 
                        onChange={(event, expanded) => {setDetailsExpanded('quickLook', expanded)}}
                        className='accordionContainer'
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            aria-controls='panel1a-content'
                            id='panel1a-header'
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
                                        <td style={{whiteSpace: 'pre-line'}}>{bot.mission_state?.replaceAll('__', '\n') + botOffloadPercentage}</td>
                                    </tr>
                                    <tr>
                                        <td>Battery Percentage</td>
                                        <td>{bot.battery_percent?.toFixed(prec)} %</td>
                                    </tr>
                                    <tr>
                                        <td>Active Goal</td>
                                        <td style={{whiteSpace: 'pre-line'}}>{activeGoal}</td>
                                    </tr>
                                    <tr>
                                        <td>Active Goal Timeout</td>
                                        <td style={{whiteSpace: 'pre-line'}}>{goalTimeout}</td>
                                    </tr>
                                    <tr>
                                        <td>Distance to Goal</td>
                                        <td style={{whiteSpace: 'pre-line'}}>{(distToGoal)}</td>
                                    </tr>
                                    <tr>
                                        <td>Distance from Hub</td>
                                        <td>{distToHub} m</td>
                                    </tr>
                                    <tr>
                                        <td>Wi-Fi Link Quality</td>
                                        <td>{linkQualityPercentage + " %"}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </AccordionDetails>
                    </Accordion>
                    <Accordion 
                        expanded={isExpanded.commands} 
                        onChange={(event, expanded) => {setDetailsExpanded('commands', expanded)}}
                        className='accordionContainer'
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            aria-controls='panel1a-content'
                            id='panel1a-header'
                        >
                            <Typography>Commands</Typography>
                        </AccordionSummary>
                        <AccordionDetails className='botDetailsCommands'>

                            <Button className={disableButton(commands.active, missionState) ? 'inactive button-jcc' : 'button-jcc'} 
                                    disabled={disableButton(commands.active, missionState)} 
                                    onClick={() => { issueCommand(api, bot.bot_id, commands.active) }}>
                                <Icon path={mdiCheckboxMarkedCirclePlusOutline} title='System Check'/>
                            </Button>

                            <Button
                                className={
                                    `
                                    ${disableButton(commands.rcMode, missionState) ? 'inactive button-jcc' : 'button-jcc'} 
                                    ${toggleRCModeButton(missionState) ? 'rc-active' : 'rc-inactive' }
                                    `
                                } 
                                disabled={disableButton(commands.rcMode, missionState)}  
                                onClick={() => { issueRCCommand(api, runRCMode(bot), bot.bot_id, isRCModeActive) }}
                            >
                                <img src={rcMode} alt='Activate RC Mode' title='RC Mode'></img>
                            </Button>

                            <Button className={disableButton(commands.nextTask, missionState) ? 'inactive button-jcc' : 'button-jcc'} 
                                    disabled={disableButton(commands.nextTask, missionState)} 
                                    onClick={() => { issueCommand(api, bot.bot_id, commands.nextTask) }}>
                                <Icon path={mdiSkipNext} title='Next Task'/>
                            </Button>

                            {dataOffloadButton}

                            <Accordion 
                                expanded={isExpanded.advancedCommands} 
                                onChange={(event, expanded) => {setDetailsExpanded('advancedCommands', expanded)}}
                                className='nestedAccordionContainer accordionContainer botDetailsAdvancedCommands'
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    aria-controls='panel1a-content'
                                    id='panel1a-header'
                                >
                                    <Typography>Advanced Commands</Typography>
                                </AccordionSummary>

                                <AccordionDetails>
                                    <Button className={disableButton(commands.shutdown, missionState) ? 'inactive button-jcc' : 'button-jcc'} 
                                            disabled={disableButton(commands.shutdown, missionState)} 
                                            onClick={() => {
                                                if (bot.mission_state == 'IN_MISSION__UNDERWAY__RECOVERY__STOPPED') {
                                                    confirm(`Are you sure you'd like to shutdown bot: ${bot.bot_id} without doing a data offload?`) ? issueCommand(api, bot.bot_id, commands.shutdown) : false;
                                                } else {
                                                    issueCommand(api, bot.bot_id, commands.shutdown);
                                                }}
                                            }
                                    >
                                        <Icon path={mdiPower} title='Shutdown'/>
                                    </Button>
                                    <Button className={disableButton(commands.reboot, missionState) ? 'inactive button-jcc' : 'button-jcc'} 
                                            disabled={disableButton(commands.reboot, missionState)} 
                                            onClick={() => {
                                                if (bot.mission_state == 'IN_MISSION__UNDERWAY__RECOVERY__STOPPED') {
                                                    confirm(`Are you sure you'd like to reboot bot: ${bot.bot_id} without doing a data offload?`) ? issueCommand(api, bot.bot_id, commands.reboot) : false;
                                                } else {
                                                    issueCommand(api, bot.bot_id, commands.reboot);
                                                }}
                                            }
                                    >
                                        <Icon path={mdiRestartAlert} title='Reboot'/>
                                    </Button>
                                    <Button className={disableButton(commands.restartServices, missionState) ? 'inactive button-jcc' : 'button-jcc'} 
                                            disabled={disableButton(commands.restartServices, missionState)} 
                                            onClick={() => {
                                                if (bot.mission_state == 'IN_MISSION__UNDERWAY__RECOVERY__STOPPED') {
                                                    confirm(`Are you sure you'd like to restart bot: ${bot.bot_id} without doing a data offload?`) ? issueCommand(api, bot.bot_id, commands.restartServices) : false;
                                                } else {
                                                    issueCommand(api, bot.bot_id, commands.restartServices);
                                                }}
                                            }
                                            
                                    >
                                        <Icon path={mdiRestart} title='Restart Services'/>
                                    </Button>
                                </AccordionDetails>
                            </Accordion>

                        </AccordionDetails>
                    </Accordion>

                    <Accordion 
                        expanded={isExpanded.health} 
                        onChange={(event, expanded) => {setDetailsExpanded('health', expanded)}}
                        className='accordionContainer'
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            aria-controls='panel1a-content'
                            id='panel1a-header'
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
                        onChange={(event, expanded) => {setDetailsExpanded('data', expanded)}}
                        className='accordionContainer'
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            aria-controls='panel1a-content'
                            id='panel1a-header'
                        >
                            <Typography>Data</Typography>
                        </AccordionSummary>

                        <AccordionDetails>
                            <Accordion 
                                expanded={isExpanded.gps} 
                                onChange={(event, expanded) => {setDetailsExpanded('gps', expanded)}}
                                className='nestedAccordionContainer accordionContainer'
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    aria-controls='panel1a-content'
                                    id='panel1a-header'
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
                                onChange={(event, expanded) => {setDetailsExpanded('imu', expanded)}}
                                className='nestedAccordionContainer accordionContainer'
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    aria-controls='panel1a-content'
                                    id='panel1a-header'
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
                                onChange={(event, expanded) => {setDetailsExpanded('sensor', expanded)}}
                                className='nestedAccordionContainer accordionContainer'
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    aria-controls='panel1a-content'
                                    id='panel1a-header'
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
                                onChange={(event, expanded) => {setDetailsExpanded('power', expanded)}}
                                className='nestedAccordionContainer accordionContainer'
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    aria-controls='panel1a-content'
                                    id='panel1a-header'
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

export interface HubDetailsProps {
    hub: PortalHubStatus,
    api: JaiaAPI,
    isExpanded: DetailsExpandedState,
    setDetailsExpanded: (section: keyof DetailsExpandedState, expanded: boolean) => void,
    getFleetId: () => number
    closeWindow: () => void,
    takeControl: () => boolean,
}

export function HubDetailsComponent(props: HubDetailsProps) {
    const hub = props.hub
    const api = props.api
    const isExpanded = props.isExpanded
    const setDetailsExpanded = props.setDetailsExpanded
    const getFleetId = props.getFleetId
    const closeWindow = props.closeWindow
    const takeControl = props.takeControl

    useEffect(() => {
        addDropdownListener('accordionContainer', 'hubDetailsAccordionContainer', 400)
    }, [])

    if (!hub) {
        return (<div></div>)
    }

    let statusAge = Math.max(0.0, hub.portalStatusAge / 1e6)
    let statusAgeClassName: string
    
    if (statusAge > 30) {
        statusAgeClassName = 'healthFailed'
    } else if (statusAge > 10) {
        statusAgeClassName = 'healthDegraded'
    }

    takeControlFunction = takeControl;

    let link_quality_percentage = 0;

    if (hub.linux_hardware_status?.wifi?.link_quality_percentage != undefined) {
        link_quality_percentage = hub.linux_hardware_status?.wifi?.link_quality_percentage
    }

    return (
        <div id='hubDetailsBox'>
            <div id='hubDetailsAccordionContainer' className='accordionParentContainer'>
                <div className='HorizontalFlexbox'>
                    <h2 className='name'>{`Hub ${hub?.hub_id}`}</h2>
                    <div onClick={() => closeWindow()} className='closeButton'>⨯</div>
                </div>
                <div id='hubDetailsAccordionContainer'>
                    <Accordion 
                        expanded={isExpanded.quickLook} 
                        onChange={(event, expanded) => {setDetailsExpanded('quickLook', expanded)}}
                        className='accordionContainer'
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            aria-controls='panel1a-content'
                            id='panel1a-header'
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
                                    <tr>
                                        <td>Wi-Fi Link Quality</td>
                                        <td>{link_quality_percentage + " %"}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </AccordionDetails>
                    </Accordion>
                    <Accordion 
                        expanded={isExpanded.commands} 
                        onChange={(event, expanded) => {setDetailsExpanded('commands', expanded)}}
                        className='accordionContainer'
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            aria-controls='panel1a-content'
                            id='panel1a-header'
                        >
                            <Typography>Commands</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Button className={' button-jcc'} 
                                    onClick={() => { issueCommandForHub(api, hub.hub_id, commandsForHub.shutdown) }}>
                                <Icon path={mdiPower} title='Shutdown'/>
                            </Button>
                            <Button className={' button-jcc'} 
                                    onClick={() => { issueCommandForHub(api, hub.hub_id, commandsForHub.reboot) }}>
                                <Icon path={mdiRestartAlert} title='Reboot'/>
                            </Button>
                            <Button className={' button-jcc'}  
                                    onClick={() => { issueCommandForHub(api, hub.hub_id, commandsForHub.restartServices) }}>
                                <Icon path={mdiRestart} title='Restart Services'/>
                            </Button>
                        </AccordionDetails>
                    </Accordion>
                    <Accordion 
                        expanded={isExpanded.links} 
                        onChange={(event, expanded) => {setDetailsExpanded('links', expanded)}}
                        className='accordionContainer'
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            aria-controls='panel1a-content'
                            id='panel1a-header'
                        >
                            <Typography>Links</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Button
                                className={'button-jcc'} 
                                onClick={() => {							
                                    const hubId = 10 + hub?.hub_id
                                    const fleetId = getFleetId()

                                    if (fleetId != undefined
                                        && !Number.isNaN(hubId)) {
                                        // 40010 is the default port number set in jaiabot/src/web/jdv/server/jaiabot_data_vision.py
                                        const url = `http://10.23.${fleetId}.${hubId}:40010`
                                        window.open(url, '_blank')}}
                                    }  
                            >
                                <Icon path={mdiDatabaseEyeOutline} title='JDV'/>
                            </Button>
                        </AccordionDetails>
                    </Accordion>
                </div>
            </div>
        </div>
    )
}
