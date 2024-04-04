import React, { useEffect } from 'react'

// Jaia Imports
import EditModeToggle from './EditModeToggle'
import { JaiaAPI } from '../../common/JaiaAPI';
import { Missions } from './Missions'
import { GlobalSettings } from './Settings';
import { error, warning, info} from '../libs/notifications';
import { MissionInterface, RunInterface } from './CommandControl';
import { PortalHubStatus, PortalBotStatus } from './shared/PortalStatus'
import { Command, CommandType, HubCommandType, BotStatus, MissionState, HubStatus } from './shared/JAIAProtobuf';
import { formatLatitude, formatLongitude, formatAttitudeAngle, addDropdownListener } from './shared/Utilities'

// Style Imports
import '../style/components/Details.less'
import { 
    mdiPlay,
    mdiStop,
    mdiPower,
    mdiDelete,
    mdiRestart,
    mdiSkipNext,
    mdiDownload,
    mdiRestartAlert,
    mdiWrenchCog,
    mdiChartLine,
    mdiWifiCog,
    mdiCheckboxMarkedCirclePlusOutline
} from '@mdi/js'

import { Icon } from '@mdi/react'
import { ThemeProvider, createTheme } from '@mui/material';
import Button from '@mui/material/Button';
import Accordion from '@mui/material/Accordion';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';

// Utility Imports
import * as turf from '@turf/turf';
import { CustomAlert } from './shared/CustomAlert';

const rcMode = require('../icons/controller.svg') as string

let prec = 2

interface CommandInfo {
    commandType: CommandType | HubCommandType,
    description: string,
    confirmationButtonText: string,
    statesAvailable?: RegExp[],
    statesNotAvailable?: RegExp[],
    humanReadableAvailable?: string,
    humanReadableNotAvailable?: string
}

const commands: {[key: string]: CommandInfo} = {
    active: {
        commandType: CommandType.ACTIVATE,
        description: 'system check',
        confirmationButtonText: 'Run System Check',
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
        confirmationButtonText: 'Go To Next Task',
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
        confirmationButtonText: 'Return Home',
        statesAvailable: [
            /^IN_MISSION__.+$/
        ],
        humanReadableAvailable: "IN_MISSION__*",
        humanReadableNotAvailable: ""
    },
    stop: {
        commandType: CommandType.STOP,
        description: 'Stop',
        confirmationButtonText: 'Stop',
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
        confirmationButtonText: 'Play Mission',
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
        confirmationButtonText: 'RC Mission',
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
        confirmationButtonText: 'Recover',
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
        confirmationButtonText: 'Retry Data Offload',
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
        confirmationButtonText: 'Shutdown',
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
        confirmationButtonText: 'Restart Services',
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
        confirmationButtonText: 'Reboot',
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
        confirmationButtonText: 'Shutdown Hub',
        statesNotAvailable: [
        ]
    },
    restartServices: {
        commandType: CommandType.RESTART_ALL_SERVICES,
        description: 'Restart Services',
        confirmationButtonText: 'Restart Services',
        statesNotAvailable: [
        ]
    },
    reboot: {
        commandType: CommandType.REBOOT_COMPUTER,
        description: 'Reboot Hub',
        confirmationButtonText: 'Reboot Hub',
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


var takeControlFunction: (onSuccess: ()=>void) => void

function issueCommand(api: JaiaAPI, botId: number, command: CommandInfo, disableMessage: string, setRcMode?: (botId: number, rcMode: boolean) => void) {
    takeControlFunction(() => {

        // Exit if we have a disableMessage
        if (disableMessage !== "") {
            CustomAlert.presentAlert({text: disableMessage})
            return
        }

        CustomAlert.confirm(`Are you sure you'd like to ${command.description} bot: ${botId}?`, command.confirmationButtonText, () => {
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
        })
    })
}

function issueCommandForHub(api: JaiaAPI, hub_id: number, commandForHub: CommandInfo) {
    console.log('Hub Command');

    takeControlFunction(async () => {
        if (await CustomAlert.confirmAsync("Are you sure you'd like to " + commandForHub.description + '?', commandForHub.confirmationButtonText)) {
            let c = {
                hub_id: hub_id,
                type: commandForHub.commandType as HubCommandType
            }

            console.log(c)
            api.postCommandForHub(c)
        }
    })
}

function issueRunCommand(api: JaiaAPI, bot: PortalBotStatus, botRun: Command, setRcMode: (botId: number, rcMode: boolean) => void, disableMessage: string) {
    takeControlFunction(() => {
        // Exit if we have a disableMessage
        if (disableMessage !== "") {
            CustomAlert.alert(disableMessage)
            return
        }

        CustomAlert.confirmAsync("Are you sure you'd like to play this run for Bot: " + bot.bot_id + '?', 'Play Run').then((confirmed) => {
            if (confirmed) {
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
        })
    })
}

function issueRCCommand(
    api: JaiaAPI,
    bot: PortalBotStatus,
    botMission: Command,
    isRCModeActive: (botId: number) => boolean,
    setRcMode: (botId: number, rcMode: boolean) => void,
    disableMessage: string
) {

    takeControlFunction(() => {
        // Exit if we have a disableMessage
        if (disableMessage !== "") {
            CustomAlert.alert(disableMessage)
            return
        }

        const isRCActive = isRCModeActive(bot?.bot_id)

        if (!isRCActive) {

            let isCriticallyLowBattery = ""

            if (Array.isArray(bot?.error)) {
                for (let e of bot?.error) {
                    if (e === 'ERROR__VEHICLE__CRITICALLY_LOW_BATTERY') {
                        isCriticallyLowBattery = "***Critically Low Battery in RC Mode could jeopardize your recovery!***\n"
                    }
                }
            }

            CustomAlert.confirm(isCriticallyLowBattery + "Are you sure you'd like to use remote control mode for Bot: " + bot?.bot_id + '?', 'Use Remote Control Mode', () => {
                console.debug('Running Remote Control:')
                console.debug(botMission)

                api.postCommand(botMission).then(response => {
                    if (response.message) {
                        error(response.message)
                    } 
                    setRcMode(bot.bot_id, true)
                })
            })
        } else {
            issueCommand(api, bot.bot_id, commands.stop, disableMessage)
            setRcMode(bot.bot_id, false)
        }
    })
}

async function runRCMode(bot: PortalBotStatus) {
    const botId = bot.bot_id;
    if (!botId) {
        warning('No bots selected')
        return null
    }

    let datumLocation = bot?.location 

    if (!datumLocation) {
        const warningString = 'RC mode issued, but bot has no location. Should I use (0, 0) as the datum, which may result in unexpected waypoint behavior?'

        if (!(await CustomAlert.confirmAsync(warningString, 'Use (0, 0) Datum'))) {
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

function getBotRun(botId: number, runs: {[key: string]: RunInterface}) {
    try {
        for (const runId of Object.keys(runs)) {
            if (runs[runId].assigned === botId) {
                return runs[runId]
            }
        }
    } catch(error) {
        console.error('Cannot getBotRun:\n', error)
        console.log('Cannot getBotRun:\n', error)
    }
    return null
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
    takeControl: (onSuccess: () => void) => void,
    deleteSingleMission: (runId: string, disableMessage?: string) => void,
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
        addDropdownListener('accordionContainer', 'botDetailsAccordionContainer', 30)
    }, [])

    const makeAccordionTheme = () => {
        return createTheme({
            transitions: {
                create: () => 'none',
            }
        })
    }

    const statusAge = Math.max(0.0, bot.portalStatusAge / 1e6)
    let statusAgeClassName: string

    if (statusAge > 30) {
        statusAgeClassName = 'healthFailed'
    } else if (statusAge > 10) {
        statusAgeClassName = 'healthDegraded'
    }

    // Active Goal
    var repeatNumberString = 'N/A'
    if (bot.repeat_index != null) {
        repeatNumberString = `${bot.repeat_index + 1}`

        if (bot.active_mission_plan?.repeats != null) {
            repeatNumberString = repeatNumberString + ` of ${bot.active_mission_plan?.repeats}`
        }
    }

    let activeGoal = bot.active_goal ?? 'N/A'
    let distToGoal = bot.distance_to_active_goal ?? 'N/A'

    if (activeGoal !== 'N/A' && distToGoal === 'N/A') {
        distToGoal = 'Distance To Goal > 1000'
    } else if (activeGoal !== 'N/A' && distToGoal !== 'N/A') {
        distToGoal = distToGoal + ' m'
    } else if (activeGoal === 'N/A' && distToGoal !== 'N/A') {
        activeGoal = 'Recovery'
        distToGoal = distToGoal + ' m'
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

    // Change message for clicking on map if the bot has a run, but it is not in edit mode
    let clickOnMap = <h3 className='name'>Click on the map to create waypoints</h3>
    const botRun = getBotRun(bot.bot_id, mission.runs) ?? false
    
    if (!disableClearRunButton(bot, mission).isDisabled
        && (botRun && botRun.id !== mission.runIdInEditMode)) {
        clickOnMap = <h3 className='name'>Click edit toggle to create waypoints</h3>
    }

    function getBotString() {
        return `Bot ${bot.bot_id}`
    }

    function getRunString() {
        const run = getBotRun(bot.bot_id, mission.runs)
        return run?.name ?? 'No Run'
    }

  /**
   * Checks if bot is logging
   *
   * @returns {boolean} The bot logging status
   */
  function isBotLogging() {
    let botLogging = true
    if (
        missionState == "PRE_DEPLOYMENT__IDLE" ||
        missionState == "PRE_DEPLOYMENT__FAILED" ||
        missionState.startsWith("POST_DEPLOYMENT__")
    ) {
        botLogging = false
    } 
    return botLogging
  }

    return (
        <React.Fragment>
            <div id='botDetailsBox'>
                <div className='botDetailsHeading'>
                    <div className='titleBar'>
                        <h2 className='botName'>{getBotString()}</h2>
                        <h4 className='runName'>{getRunString()}</h4>
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
                            onClick={() => { deleteSingleMission(props.run?.id, disableClearRunButton(bot, mission).disableMessage)}}>
                            <Icon path={mdiDelete} title='Clear Mission'/>
                        </Button>

                        <EditModeToggle 
                            onClick={props.toggleEditMode}
                            runIdInEditMode={props.mission.runIdInEditMode}
                            run={props.run}
                            label='Edit'
                            title='ToggleEditMode'
                            isDisabled={getBotRun(bot.bot_id, mission.runs) ? false : true}
                        />
                    </div>
                </div>
                <div id='botDetailsAccordionContainer' className='accordionParentContainer'>
                    <ThemeProvider theme={makeAccordionTheme()}>
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
                                            <td>Repeat Number</td>
                                            <td style={{whiteSpace: 'pre-line'}}>{repeatNumberString}</td>
                                        </tr>
                                        <tr>
                                            <td>Active Goal</td>
                                            <td style={{whiteSpace: 'pre-line'}}>{activeGoal}</td>
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
                                        <tr>
                                          <td>Data Logging</td>
                                          <td>{isBotLogging().toString().toUpperCase()}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </AccordionDetails>
                        </Accordion>
                    </ThemeProvider>

                    <ThemeProvider theme={makeAccordionTheme()}>
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
                                    onClick={async () => { 
                                        issueRCCommand(api, bot, await runRCMode(bot), props.isRCModeActive, props.setRcMode, disableButton(commands.rcMode, missionState, bot, props.downloadQueue).disableMessage) 
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
                                    className='accordionContainer'
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
                                                onClick={async () => {
                                                    if (bot.mission_state == 'IN_MISSION__UNDERWAY__RECOVERY__STOPPED') {
                                                        (await CustomAlert.confirmAsync(`Are you sure you'd like to shutdown bot: ${bot.bot_id} without doing a data offload?`, 'Shutdown Bot')) ?
                                                            issueCommand(api, bot.bot_id, commands.shutdown,  disableButton(commands.shutdown, missionState, bot, props.downloadQueue).disableMessage) : false;
                                                    } else {
                                                        issueCommand(api, bot.bot_id, commands.shutdown,  disableButton(commands.shutdown, missionState, bot, props.downloadQueue).disableMessage);
                                                    }}
                                                }
                                        >
                                            <Icon path={mdiPower} title='Shutdown'/>
                                        </Button>
                                        <Button className={disableButton(commands.reboot, missionState, bot, props.downloadQueue).isDisabled ? 'inactive button-jcc' : 'button-jcc'} 
                                                onClick={async () => {
                                                    if (bot.mission_state == 'IN_MISSION__UNDERWAY__RECOVERY__STOPPED') {
                                                        (await CustomAlert.confirmAsync(`Are you sure you'd like to reboot bot: ${bot.bot_id} without doing a data offload?`, 'Reboot Bot')) ? 
                                                            issueCommand(api, bot.bot_id, commands.reboot,  disableButton(commands.reboot, missionState, bot, props.downloadQueue).disableMessage) : false;
                                                    } else {
                                                        issueCommand(api, bot.bot_id, commands.reboot,  disableButton(commands.reboot, missionState, bot, props.downloadQueue).disableMessage);
                                                    }}
                                                }
                                        >
                                            <Icon path={mdiRestartAlert} title='Reboot'/>
                                        </Button>
                                        <Button className={disableButton(commands.restartServices, missionState, bot, props.downloadQueue).isDisabled ? 'inactive button-jcc' : 'button-jcc'} 
                                                onClick={async () => {
                                                    if (bot.mission_state == 'IN_MISSION__UNDERWAY__RECOVERY__STOPPED') {
                                                        (await CustomAlert.confirmAsync(`Are you sure you'd like to restart bot: ${bot.bot_id} without doing a data offload?`, 'Restart Bot')) ? 
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
                    </ThemeProvider>

                    <ThemeProvider theme={makeAccordionTheme()}>
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
                    </ThemeProvider>

                    <ThemeProvider theme={makeAccordionTheme()}>
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

                                <ThemeProvider theme={makeAccordionTheme()}>
                                    <Accordion 
                                        expanded={isExpanded.gps} 
                                        onChange={(event, expanded) => {setDetailsExpanded('gps', expanded)}}
                                        className='nestedAccordionContainer'
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
                                </ThemeProvider>

                                <ThemeProvider theme={makeAccordionTheme()}>
                                    <Accordion 
                                        expanded={isExpanded.imu} 
                                        onChange={(event, expanded) => {setDetailsExpanded('imu', expanded)}}
                                        className='nestedAccordionContainer'
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
                                                    <tr>
                                                        <td>IMU Cal</td>
                                                        <td>{bot?.calibration_status}</td>
                                                    </tr>
                                                </tbody>
                                            </table>              
                                        </AccordionDetails>
                                    </Accordion>
                                </ThemeProvider>

                                <ThemeProvider theme={makeAccordionTheme()}>
                                    <Accordion 
                                        expanded={isExpanded.sensor} 
                                        onChange={(event, expanded) => {setDetailsExpanded('sensor', expanded)}}
                                        className='nestedAccordionContainer'
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
                                </ThemeProvider>

                                <ThemeProvider theme={makeAccordionTheme()}>
                                    <Accordion 
                                        expanded={isExpanded.power} 
                                        onChange={(event, expanded) => {setDetailsExpanded('power', expanded)}}
                                        className='nestedAccordionContainer'
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
                                </ThemeProvider>

                            </AccordionDetails>
                        </Accordion>
                    </ThemeProvider>
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
    takeControl: (onSuccess: () => void) => void,
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
        addDropdownListener('accordionContainer', 'hubDetailsAccordionContainer', 30)
    }, [])

    const makeAccordionTheme = () => {
        return createTheme({
            transitions: {
                create: () => 'none',
            }
        })
    }

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
            <div className='titleBar'>
                <h2 className='name'>{`Hub ${hub?.hub_id}`}</h2>
                <div onClick={() => closeWindow()} className='closeButton'>⨯</div>
            </div>
            <div id='hubDetailsAccordionContainer' className='accordionParentContainer'>
                <ThemeProvider theme={makeAccordionTheme()}>
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
                </ThemeProvider>

                <ThemeProvider theme={makeAccordionTheme()}>
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
                </ThemeProvider>

                <ThemeProvider theme={makeAccordionTheme()}>
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
                                <Icon path={mdiChartLine} title='JDV'/>
                            </Button>
                            <Button className="button-jcc" onClick={() => {
                                const fleetId = getFleetId()

                                if (fleetId != undefined) {
                                    const url = `http://10.23.${fleetId}.1`
                                    window.open(url, '_blank')}}
                                }
                            >
                                <Icon path={mdiWifiCog} title="Router"></Icon>
                            </Button>
                            <Button className="button-jcc" onClick={() => 
                                    {
                                        const hubId = 10 + hub?.hub_id
                                        const fleetId = getFleetId()

                                        if (fleetId != undefined) {
                                            const url = `http://10.23.${fleetId}.${hubId}:9091`
                                            window.open(url, '_blank')
                                        }
                                    }
                                }
                            >
                                <Icon path={mdiWrenchCog} title="Upgrade"></Icon>
                            </Button>
                        </AccordionDetails>
                    </Accordion>
                </ThemeProvider>
            </div>
        </div>
    )
}
