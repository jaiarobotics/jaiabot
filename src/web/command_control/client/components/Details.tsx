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
    humanReadableAvailable?: string,
    humanReadableNotAvailable?: string
}

const commands: {[key: string]: CommandInfo} = {
    active: {
        commandType: CommandType.ACTIVATE,
        description: 'system check',
        statesAvailable: [
            /^.+__IDLE$/,
            /^PRE_DEPLOYMENT__FAILED$/
        ],
        humanReadableAvailable: "*__IDLE, PRE_DEPLOYMENT__FAILED",
        humanReadableNotAvailable: ""
    },
    nextTask: {
        commandType: CommandType.NEXT_TASK,
        description: 'go to the Next Task for',
        statesAvailable: [
            /^IN_MISSION__.+$/
        ],
        statesNotAvailable: [
            /REMOTE_CONTROL/
        ],
        humanReadableAvailable: "IN_MISSION__*",
        humanReadableNotAvailable: "*REMOTE_CONTROL*"
    },
    goHome: {
        commandType: CommandType.RETURN_TO_HOME,
        description: 'Return Home',
        statesAvailable: [
            /^IN_MISSION__.+$/
        ],
        humanReadableAvailable: "IN_MISSION__*",
        humanReadableNotAvailable: ""
    },
    stop: {
        commandType: CommandType.STOP,
        description: 'Stop',
        statesAvailable: [
            /^IN_MISSION__.+$/
        ],
        statesNotAvailable: [
            /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/
        ],
        humanReadableAvailable: "IN_MISSION__*",
        humanReadableNotAvailable: "IN_MISSION__UNDERWAY__RECOVERY__STOPPED"
    },
    play: {
        commandType: CommandType.START_MISSION,
        description: 'Play mission',
        statesAvailable: [
            /^IN_MISSION__.+$/,
            /^PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN$/
        ],
        humanReadableAvailable: "IN_MISSION__*, PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN",
        humanReadableNotAvailable: ""
    },
    rcMode: {
        commandType: CommandType.REMOTE_CONTROL_TASK,
        description: 'RC mission',
        statesAvailable: [
            /^IN_MISSION__.+$/,
            /^PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN$/,
            /^.+__FAILED$/
        ],
        humanReadableAvailable: "IN_MISSION__*, PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN, *__FAILED",
        humanReadableNotAvailable: ""
    },
    recover: {
        commandType: CommandType.RECOVERED,
        description: 'Recover',
        statesAvailable: [
            /^PRE_DEPLOYMENT.+$/,
            /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/,
        ],
        humanReadableAvailable: "PRE_DEPLOYMENT*, IN_MISSION__UNDERWAY__RECOVERY__STOPPED",
        humanReadableNotAvailable: ""
    },
    retryDataOffload: {
        commandType: CommandType.RETRY_DATA_OFFLOAD,
        description: 'Retry Data Offload for',
        statesAvailable: [
            /^POST_DEPLOYMENT__IDLE$/,
            /^POST_DEPLOYMENT__WAIT_FOR_MISSION_PLAN$/,
        ],
        humanReadableAvailable: "POST_DEPLOYMENT__IDLE, POST_DEPLOYMENT__WAIT_FOR_MISSION_PLAN",
        humanReadableNotAvailable: ""
    },
    shutdown: {
        commandType: CommandType.SHUTDOWN,
        description: 'Shutdown',
        statesAvailable: [
            /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/,
            /^PRE_DEPLOYMENT.+$/,
            /^POST_DEPLOYMENT.+$/,
        ],
        humanReadableAvailable: "IN_MISSION__UNDERWAY__RECOVERY__STOPPED, PRE_DEPLOYMENT*, POST_DEPLOYMENT*",
        humanReadableNotAvailable: ""
    },
    restartServices: {
        commandType: CommandType.RESTART_ALL_SERVICES,
        description: 'Restart Services for',
        statesAvailable: [
            /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/,
            /^PRE_DEPLOYMENT.+$/,
            /^POST_DEPLOYMENT.+$/,
        ],
        humanReadableAvailable: "IN_MISSION__UNDERWAY__RECOVERY__STOPPED, PRE_DEPLOYMENT*, POST_DEPLOYMENT*",
        humanReadableNotAvailable: ""
    },
    reboot: {
        commandType: CommandType.REBOOT_COMPUTER,
        description: 'Reboot',
        statesAvailable: [
            /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/,
            /^PRE_DEPLOYMENT.+$/,
            /^POST_DEPLOYMENT.+$/,
        ],
        humanReadableAvailable: "IN_MISSION__UNDERWAY__RECOVERY__STOPPED, PRE_DEPLOYMENT*, POST_DEPLOYMENT*",
        humanReadableNotAvailable: ""
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
    links: boolean
}

interface DisableInfo {
    isDisabled: boolean
    disableMessage: string
}


var takeControlFunction: () => boolean

function issueCommand(api: JaiaAPI, botId: number, command: CommandInfo, disableMessage: string, setRcMode?: (botId: number, rcMode: boolean) => void) {
    if (!takeControlFunction()) return false

    // Exit if we have a disableMessage
    if (disableMessage !== "") {
        alert(disableMessage)
        return
    }

    if (confirm(`Are you sure you'd like to ${command.description} bot: ${botId}?`)) {
        let c = {
            bot_id: botId,
            type: command.commandType as CommandType
        }

        api.postCommand(c).then(response => {
            if (response.message) {
                error(response.message)
            }
            if (setRcMode) {
                setRcMode(botId, false)
            }
        })

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

function issueRunCommand(api: JaiaAPI, bot: PortalBotStatus, botRun: Command, setRcMode: (botId: number, rcMode: boolean) => void, disableMessage: string) {

    if (!takeControlFunction()) return;

    // Exit if we have a disableMessage
    if (disableMessage !== "") {
        alert(disableMessage)
        return
    }

    if (confirm("Are you sure you'd like to play this run for Bot: " + bot.bot_id + '?')) {
        // Set the speed values
        botRun.plan.speeds = GlobalSettings.missionPlanSpeeds

        info('Submitted for Bot: ' + bot.bot_id);

        api.postCommand(botRun).then(response => {
            if (response.message) {
                error(response.message)
            }
            setRcMode(bot.bot_id, false)
        })
    }   

}

function issueRCCommand(
    api: JaiaAPI,
    bot: PortalBotStatus,
    botMission: Command,
    isRCModeActive: (botId: number) => boolean,
    setRcMode: (botId: number, rcMode: boolean) => void,
    disableMessage: string
) {

    if (!takeControlFunction()) return;

    // Exit if we have a disableMessage
    if (disableMessage !== "") {
        alert(disableMessage)
        return
    }

    const isRCActive = isRCModeActive(bot?.bot_id)

    if (!isRCActive) {

        let isCriticallyLowBattery = ""

        if (Array.isArray(bot?.error)) {
            for (let e of bot?.error) {
                if (e === 'ERROR__VEHICLE__CRITICALLY_LOW_BATTERY') {
                    isCriticallyLowBattery = "***Critically Low Battery in RC Mode coulde jeopardize your recovery!***\n"
                }
            }
        }

        if (confirm(isCriticallyLowBattery + "Are you sure you'd like to use remote control mode for Bot: " + bot?.bot_id + '?')) {

            console.debug('Running Remote Control:')
            console.debug(botMission)

            api.postCommand(botMission).then(response => {
                if (response.message) {
                    error(response.message)
                } 
                setRcMode(bot.bot_id, true)
            })
        }   
    } else {
        issueCommand(api, bot.bot_id, commands.stop, disableMessage)
        setRcMode(bot.bot_id, false)
    }
}

function runRCMode(bot: PortalBotStatus) {
    const botId = bot.bot_id;
    if (!botId) {
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

    return Missions.RCMode(botId, datumLocation);
}

// Check if there is a mission to run
function runMission(botId: number, mission: MissionInterface) {
    let runs = mission.runs;
    let runId = mission.botsAssignedToRuns[botId];
    let run = runs[runId];

    if (run) {
        if (mission.runIdInEditMode === run.id) {
            mission.runIdInEditMode = ''
        }
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
function disableButton(command: CommandInfo, missionState: MissionState, bot?: PortalBotStatus, downloadQueue?: PortalBotStatus[]) {
    let disableInfo: DisableInfo

    disableInfo = {
        isDisabled: true,
        disableMessage: ""
    }

    const statesAvailable = command.statesAvailable
    const statesNotAvailable = command.statesNotAvailable
    const humanReadableAvailable = command.humanReadableAvailable
    const humanReadableNotAvailable = command.humanReadableNotAvailable

    const disableMessage = "The command: " + command.commandType + " cannot be sent because the bot"
    const disableState = disableMessage + " is in the incorrect state." + 
        `${humanReadableAvailable !== "" ? '\nAvailable States: ' + humanReadableAvailable + '\n': ''}` +
        `${humanReadableNotAvailable !== "" ? '\States Not Available: ' + humanReadableNotAvailable + '\n': ''}`
    
    if (statesAvailable) {
        for (let stateAvailable of statesAvailable) {
            if (stateAvailable.test(missionState)) {
                disableInfo.isDisabled = false
                break
            }
        }
    }

    if (statesNotAvailable) {
        for (let stateNotAvailable of statesNotAvailable) {
            if (stateNotAvailable.test(missionState)) {
                disableInfo.isDisabled = true
                break
            }
        }
    }
    
    if (disableInfo.isDisabled) {
        disableInfo.disableMessage += disableState
    }

    if (bot && downloadQueue) {
        const downloadQueueBotIds = downloadQueue.map((bot) => bot.bot_id)
        if (downloadQueueBotIds.includes(bot.bot_id)) {
            disableInfo.isDisabled = true
            disableInfo.disableMessage += disableMessage + " currently preparing for data offload. Check the data offload queue panel. \n"
        }
    }
    return disableInfo
}

/**
 * Checks if clear run button should be disabled 
 * 
 * @param bot 
 * @returns boolean
 */
function disableClearRunButton(bot: PortalBotStatus, mission: MissionInterface) {
    let disableInfo: DisableInfo

    disableInfo = {
        isDisabled: false,
        disableMessage: ""
    }

    if (!mission?.botsAssignedToRuns[bot.bot_id])
    {
        disableInfo.disableMessage = "Cannot perform this action because there is no run to delete"
        disableInfo.isDisabled = true
    }

    return disableInfo
}

function disablePlayButton(bot: PortalBotStatus, mission: MissionInterface, command: CommandInfo, missionState: MissionState, downloadQueue: PortalBotStatus[]) {
    let disableInfo: DisableInfo

    disableInfo = {
        isDisabled: false,
        disableMessage: ""
    }


    if (!mission.botsAssignedToRuns[bot.bot_id]) {
        disableInfo.disableMessage += "The command: " + command.commandType + " cannot be sent because the bot because it does not have a run available\n" 
        disableInfo.isDisabled = true
    }

    if (disableButton(command, missionState).isDisabled) {
        disableInfo.disableMessage += disableButton(command, missionState).disableMessage 
        disableInfo.isDisabled = true
    }

    const downloadQueueBotIds = downloadQueue.map((bot) => bot.bot_id)
    if (downloadQueueBotIds.includes(bot.bot_id)) {
        disableInfo.disableMessage += "The command: " + command.commandType + " cannot be sent because the bot because it is in the data offload queue\n" 
        disableInfo.isDisabled = true
    }

    if (bot.health_state === 'HEALTH__FAILED') {
        disableInfo.disableMessage += "The command: " + command.commandType + ' cannot be sent because the bot because it has a health state of "HEALTH__OK" or "HEALTH__DEGRADED\n'
        disableInfo.isDisabled = true
    }

    return disableInfo
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
    downloadQueue: PortalBotStatus[],
    closeWindow: () => void,
    takeControl: () => boolean,
    deleteSingleMission: (runNumber?: number, disableMessage?: string) => void,
    setDetailsExpanded: (section: keyof DetailsExpandedState, expanded: boolean) => void,
    isRCModeActive: (botId: number) => boolean,
    setRcMode: (botId: number, rcMode: boolean) => void,
    toggleEditMode: (evt: React.ChangeEvent, run: RunInterface) => boolean,
    downloadIndividualBot: (bot: PortalBotStatus, disableMessage: string) => void
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
        <Button className={(disableButton(commands.recover, missionState).isDisabled || !linkQualityPercentage) ? 'inactive button-jcc' : 'button-jcc'} 
            onClick={() => { 
                let disableMessage = disableButton(commands.recover, missionState).disableMessage

                if (!linkQualityPercentage) {
                    disableMessage += 
                        "The command: " + commands.recover.commandType + " cannot be sent because the bot is not connected to Wifi (Check Link Quality in Quick Look)"
                }

                props.downloadIndividualBot(bot, disableMessage) 
            }}>
            <Icon path={mdiDownload} title='Data Offload'/>
        </Button>
    )

    if (disableButton(commands.recover, missionState).isDisabled) {
        dataOffloadButton = ( 
            <Button className={(disableButton(commands.retryDataOffload, missionState).isDisabled || !linkQualityPercentage) ? 'inactive button-jcc' : 'button-jcc'} 
                onClick={() => {
                    let disableMessage = disableButton(commands.retryDataOffload, missionState).disableMessage

                    if (!linkQualityPercentage) {
                        disableMessage += 
                            "The command: " + commands.retryDataOffload.commandType + " cannot be sent because the bot is not connected to Wifi (Check Link Quality in Quick Look)"
                    }

                    props.downloadIndividualBot(bot, disableMessage) 
                }}>
                <Icon path={mdiDownload} title='Retry Data Offload'/>
            </Button>
        )
    }

    let botOffloadPercentage = ''

    if (bot.data_offload_percentage) {
        botOffloadPercentage = ' ' + bot.data_offload_percentage + '%'
    }

    let clickOnMap = (
        <h3 className='name'>Click on the map to create waypoints</h3>
    )

    // Clear message for clicking on map if the bot has a run,
    // but it is not in edit mode
    if (!disableClearRunButton(bot, mission).isDisabled
            && !props?.mission?.runIdInEditMode[bot?.bot_id]) {
        clickOnMap = (
            <h3 className='name'>Click edit toggle to create waypoints</h3>
        )
    }

    return (
        <React.Fragment>
            <div id='botDetailsBox'>
                <div className='botDetailsHeading'>
                    <div className='HorizontalFlexbox'>
                        <h2 className='name'>{`Bot ${bot?.bot_id}`}</h2>
                        <div onClick={() => closeWindow()} className='closeButton'>⨯</div>
                    </div>
                    {clickOnMap}
                    <div className='botDetailsToolbar'>
                        <Button
                            className={disableButton(commands.stop, missionState).isDisabled ? 'inactive button-jcc' : ' button-jcc stopMission'} 
                            onClick={() => { issueCommand(api, bot.bot_id, commands.stop, disableButton(commands.stop, missionState).disableMessage, props.setRcMode) }}>
                            <Icon path={mdiStop} title='Stop Mission'/>
                        </Button>
                        <Button
                            className={disablePlayButton(bot, mission, commands.play, missionState, props.downloadQueue).isDisabled ? 'inactive button-jcc' : 'button-jcc'} 
                            onClick={() => { 
                                issueRunCommand(api, bot, runMission(bot.bot_id, mission), props.setRcMode, disablePlayButton(bot, mission, commands.play, missionState, props.downloadQueue).disableMessage) 
                            }}>
                            <Icon path={mdiPlay} title='Run Mission'/>
                        </Button>
                        <Button 
                            className={ disableClearRunButton(bot, mission).isDisabled ? 'inactive button-jcc' : 'button-jcc' }
                            onClick={() => { deleteSingleMission(undefined, disableClearRunButton(bot, mission).disableMessage) }}>
                            <Icon path={mdiDelete} title='Clear Mission'/>
                        </Button>

                        <EditModeToggle 
                            onClick={props.toggleEditMode}
                            mission={props.mission}
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

                            <Button className={disableButton(commands.active, missionState).isDisabled ? 'inactive button-jcc' : 'button-jcc'} 
                                    onClick={() => { issueCommand(api, bot.bot_id, commands.active, disableButton(commands.active, missionState).disableMessage) }}>
                                <Icon path={mdiCheckboxMarkedCirclePlusOutline} title='System Check'/>
                            </Button>

                            <Button
                                className={
                                    `
                                    ${disableButton(commands.rcMode, missionState, bot, props.downloadQueue).isDisabled ? 'inactive button-jcc' : 'button-jcc'} 
                                    ${props.isRCModeActive(bot?.bot_id) ? 'rc-active' : 'rc-inactive' }
                                    `
                                } 
                                onClick={() => { 
                                    issueRCCommand(api, bot, runRCMode(bot), props.isRCModeActive, props.setRcMode, disableButton(commands.rcMode, missionState, bot, props.downloadQueue).disableMessage) 
                                }}
                            >
                                <img src={rcMode} alt='Activate RC Mode' title='RC Mode'></img>
                            </Button>

                            <Button className={disableButton(commands.nextTask, missionState).isDisabled ? 'inactive button-jcc' : 'button-jcc'} 
                                    onClick={() => { issueCommand(api, bot.bot_id, commands.nextTask, disableButton(commands.nextTask, missionState).disableMessage) }}>
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
                                    <Button className={disableButton(commands.shutdown, missionState, bot, props.downloadQueue).isDisabled ? 'inactive button-jcc' : 'button-jcc'} 
                                            onClick={() => {
                                                if (bot.mission_state == 'IN_MISSION__UNDERWAY__RECOVERY__STOPPED') {
                                                    confirm(`Are you sure you'd like to shutdown bot: ${bot.bot_id} without doing a data offload?`) ?
                                                        issueCommand(api, bot.bot_id, commands.shutdown,  disableButton(commands.shutdown, missionState, bot, props.downloadQueue).disableMessage) : false;
                                                } else {
                                                    issueCommand(api, bot.bot_id, commands.shutdown,  disableButton(commands.shutdown, missionState, bot, props.downloadQueue).disableMessage);
                                                }}
                                            }
                                    >
                                        <Icon path={mdiPower} title='Shutdown'/>
                                    </Button>
                                    <Button className={disableButton(commands.reboot, missionState, bot, props.downloadQueue).isDisabled ? 'inactive button-jcc' : 'button-jcc'} 
                                            onClick={() => {
                                                if (bot.mission_state == 'IN_MISSION__UNDERWAY__RECOVERY__STOPPED') {
                                                    confirm(`Are you sure you'd like to reboot bot: ${bot.bot_id} without doing a data offload?`) ? 
                                                        issueCommand(api, bot.bot_id, commands.reboot,  disableButton(commands.reboot, missionState, bot, props.downloadQueue).disableMessage) : false;
                                                } else {
                                                    issueCommand(api, bot.bot_id, commands.reboot,  disableButton(commands.reboot, missionState, bot, props.downloadQueue).disableMessage);
                                                }}
                                            }
                                    >
                                        <Icon path={mdiRestartAlert} title='Reboot'/>
                                    </Button>
                                    <Button className={disableButton(commands.restartServices, missionState, bot, props.downloadQueue).isDisabled ? 'inactive button-jcc' : 'button-jcc'} 
                                            onClick={() => {
                                                if (bot.mission_state == 'IN_MISSION__UNDERWAY__RECOVERY__STOPPED') {
                                                    confirm(`Are you sure you'd like to restart bot: ${bot.bot_id} without doing a data offload?`) ? 
                                                        issueCommand(api, bot.bot_id, commands.restartServices, disableButton(commands.restartServices, missionState, bot, props.downloadQueue).disableMessage) : false;
                                                } else {
                                                    issueCommand(api, bot.bot_id, commands.restartServices,  disableButton(commands.restartServices, missionState, bot, props.downloadQueue).disableMessage);
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

    let loadAverageOneMin
    let loadAverageFiveMin
    let loadAverageFifteenMin

    if (hub.linux_hardware_status?.processor?.loads?.one_min != undefined) {
        loadAverageOneMin = hub.linux_hardware_status?.processor?.loads?.one_min.toFixed(2)
    } else {
        loadAverageOneMin = "N/A"
    }

    if (hub.linux_hardware_status?.processor?.loads?.five_min != undefined) {
        loadAverageFiveMin = hub.linux_hardware_status?.processor?.loads?.five_min.toFixed(2)
    } else {
        loadAverageFiveMin = "N/A"
    }

    if (hub.linux_hardware_status?.processor?.loads?.fifteen_min != undefined) {
        loadAverageFifteenMin = hub.linux_hardware_status?.processor?.loads?.fifteen_min.toFixed(2)
    } else {
        loadAverageFifteenMin = "N/A"
    }

    let linkQualityPercentage = 0;

    if (hub.linux_hardware_status?.wifi?.link_quality_percentage != undefined) {
        linkQualityPercentage = hub.linux_hardware_status?.wifi?.link_quality_percentage
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
                                        <td>CPU Load Average (1 min)</td>
                                        <td>{loadAverageOneMin}</td>
                                    </tr>
                                    <tr>
                                        <td>CPU Load Average (5 min)</td>
                                        <td>{loadAverageFiveMin}</td>
                                    </tr>
                                    <tr>
                                        <td>CPU Load Average (15 min)</td>
                                        <td>{loadAverageFifteenMin}</td>
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
