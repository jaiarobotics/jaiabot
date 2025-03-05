import React, { useContext, useState } from "react";

// Jaia Imports
import {
    JaiaContext,
    JaiaContextType,
    JaiaDispatchContext,
    JaiaAction,
} from "../../context/Jaia/JaiaContext";
import { JaiaActions } from "../../context/Jaia/jaia-actions";
import { NodeTypes } from "../../types/jaia-system-types";
import { DETAILS_DECIMALS, UNASSIGNED_ID } from "../../utils/constants";
import { BotAccordionNames } from "../../types/context-types";

import BotSensors from "../../data/bots/bot-sensors";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import {
    getDistanceToHub,
    getStatusAgeClassName,
    getWaypontHelperText,
    getBotOffloadPercent,
    getRepeatProgress,
    getDistToWaypoint,
    isBotLogging,
} from "./bot-details";
import { MissionStatus } from "../../types/jaia-system-types";
import {
    formatLatitude,
    formatLongitude,
    formatAttitudeAngle,
    convertMicrosecondsToSeconds,
} from "../../shared/Utilities";
import { DEFAULT_HUB_ID } from "../../utils/constants";

// MDI and MUI
import {
    mdiPlay,
    mdiStop,
    mdiPower,
    mdiDelete,
    mdiRestart,
    mdiSkipNext,
    mdiRestartAlert,
    mdiCheckboxMarkedCirclePlusOutline,
} from "@mdi/js";
import { Icon } from "@mdi/react";
import { ThemeProvider, createTheme } from "@mui/material";
import Button from "@mui/material/Button";
import Accordion from "@mui/material/Accordion";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";

import rcModeIcon from "../../style/icons/controller.svg";
import "./BotDetails.less";

export default function BotDetails() {
    const jaiaContext: JaiaContextType = useContext(JaiaContext);
    const jaiaDispatch: React.Dispatch<JaiaAction> = useContext(JaiaDispatchContext);

    const [accordionTheme, setAccordionTheme] = useState(
        createTheme({
            transitions: {
                create: () => "none",
            },
        }),
    );

    if (jaiaContext === null || jaiaContext.visibleDetails !== NodeTypes.BOT) {
        return <div></div>;
    }

    const hub = jaiaContext.hubs.get(DEFAULT_HUB_ID);

    const botID = jaiaContext.selectedNode.id;
    const bot = jaiaContext.bots.get(botID);

    const missionID = missionsManager.getMissionID(botID);
    const mission = jaiaContext.missions.get(missionID);

    if (!bot) {
        return <div></div>;
    }

    const missionStatus: MissionStatus = bot.getMissionStatus();
    const botSensors: BotSensors = bot.getBotSensors();

    /**
     * Dispatches an action to close the Bot details panel
     *
     * @returns {void}
     */
    function handleCloseDetailsPanel() {
        jaiaDispatch({ type: JaiaActions.CLOSED_DETAILS });
    }

    /**
     * Dispatches an action to toggle accordion states
     *
     * @returns {void}
     */
    function handleAccordionClick(accordionName: BotAccordionNames) {
        jaiaDispatch({
            type: JaiaActions.CLICKED_BOT_ACCORDION,
            botAccordionName: accordionName,
        });
    }

    return (
        <React.Fragment>
            <div className="node-details">
                <div className="details-heading">
                    <div className="title-bar">
                        <h2>{`Bot ${botID}`}</h2>
                        <h4>
                            {missionID === UNASSIGNED_ID ? "No Mission" : `Mission ${missionID}`}
                        </h4>
                        <div
                            className="close-button"
                            onClick={() => {
                                handleCloseDetailsPanel();
                            }}
                        >
                            ⨯
                        </div>
                    </div>
                    <h3 className="details-help-text">{getWaypontHelperText(mission)}</h3>
                    <div className="details-toolbar">
                        <Button className="jaia-button">
                            <Icon path={mdiStop} title="Stop Mission" />
                        </Button>
                        <Button className="jaia-button">
                            <Icon path={mdiPlay} title="Run Mission" />
                        </Button>
                        <Button className="jaia-button">
                            <Icon path={mdiDelete} title="Clear Mission" />
                        </Button>
                    </div>
                </div>
                <div className="accordions-container">
                    <ThemeProvider theme={accordionTheme}>
                        <Accordion
                            expanded={jaiaContext.botAccordionStates.quickLook}
                            onChange={() => {
                                handleAccordionClick(BotAccordionNames.QUICKLOOK);
                            }}
                            className="accordion-container"
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                className="accordion-summary"
                            >
                                <Typography>Quick Look</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <table>
                                    <tbody>
                                        <tr className={getStatusAgeClassName(bot.getStatusAge())}>
                                            <td>Status Age</td>
                                            <td>
                                                {convertMicrosecondsToSeconds(
                                                    bot.getStatusAge(),
                                                ).toFixed(0)}{" "}
                                                s
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Mission State</td>
                                            <td style={{ whiteSpace: "pre-line" }}>
                                                {missionStatus?.missionState?.replaceAll(
                                                    "__",
                                                    "\n",
                                                ) + getBotOffloadPercent(botID, hub)}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Battery Percentage</td>
                                            <td>
                                                {bot.getBatteryPercent()?.toFixed(DETAILS_DECIMALS)}{" "}
                                                %
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Repeat Number</td>
                                            <td style={{ whiteSpace: "pre-line" }}>
                                                {getRepeatProgress(
                                                    mission?.getRepeats(),
                                                    missionStatus,
                                                )}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Active Goal</td>
                                            <td style={{ whiteSpace: "pre-line" }}>
                                                {missionStatus.activeGoal ?? "N/A"}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Distance to Goal</td>
                                            <td style={{ whiteSpace: "pre-line" }}>
                                                {getDistToWaypoint(missionStatus)}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Distance from Hub</td>
                                            <td>
                                                {getDistanceToHub(
                                                    bot.getBotSensors().getGPS(),
                                                    hub.getHubSensors().getGPS(),
                                                )}{" "}
                                                m
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Wi-Fi Link Quality</td>
                                            <td>{bot.getWifiLinkQuality() + " %"}</td>
                                        </tr>
                                        <tr>
                                            <td>Data Logging</td>
                                            <td>
                                                {isBotLogging(missionStatus?.missionState)
                                                    .toString()
                                                    .toUpperCase()}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </AccordionDetails>
                        </Accordion>
                    </ThemeProvider>

                    <ThemeProvider theme={accordionTheme}>
                        <Accordion
                            expanded={jaiaContext.botAccordionStates.commands}
                            onChange={() => {
                                handleAccordionClick(BotAccordionNames.COMMANDS);
                            }}
                            className="accordion-container"
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                className="accordion-summary"
                            >
                                <Typography>Commands</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <div className="accordion-details-buttons bot-commands">
                                    <Button className="jaia-button">
                                        <Icon
                                            path={mdiCheckboxMarkedCirclePlusOutline}
                                            title="System Check"
                                        />
                                    </Button>
                                    <Button className="jaia-button">
                                        <img
                                            src={rcModeIcon}
                                            alt="Activate RC Mode"
                                            title="RC Mode"
                                        ></img>
                                    </Button>
                                    <Button className="jaia-button">
                                        <Icon path={mdiSkipNext} title="Next Task" />
                                    </Button>
                                </div>
                                <Accordion
                                    expanded={jaiaContext.botAccordionStates.advancedCommands}
                                    onChange={() => {
                                        handleAccordionClick(BotAccordionNames.ADVANCEDCOMMANDS);
                                    }}
                                    className="accordion-container"
                                >
                                    <AccordionSummary
                                        expandIcon={<ExpandMoreIcon />}
                                        className="accordion-summary"
                                    >
                                        <Typography>Advanced Commands</Typography>
                                    </AccordionSummary>

                                    <AccordionDetails className="accordion-details-buttons advanced-commands">
                                        <Button className="jaia-button">
                                            <Icon path={mdiPower} title="Shutdown" />
                                        </Button>
                                        <Button className="jaia-button">
                                            <Icon path={mdiRestartAlert} title="Reboot" />
                                        </Button>
                                        <Button className="jaia-button">
                                            <Icon path={mdiRestart} title="Restart Services" />
                                        </Button>
                                    </AccordionDetails>
                                </Accordion>
                            </AccordionDetails>
                        </Accordion>
                    </ThemeProvider>

                    <ThemeProvider theme={accordionTheme}>
                        <Accordion
                            expanded={jaiaContext.botAccordionStates.health}
                            onChange={() => {
                                handleAccordionClick(BotAccordionNames.HEALTH);
                            }}
                            className="accordion-container"
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                className="accordion-summary"
                            >
                                <Typography>Health</Typography>
                            </AccordionSummary>
                            <AccordionDetails></AccordionDetails>
                        </Accordion>
                    </ThemeProvider>

                    <ThemeProvider theme={accordionTheme}>
                        <Accordion
                            expanded={jaiaContext.botAccordionStates.data}
                            onChange={() => {
                                handleAccordionClick(BotAccordionNames.DATA);
                            }}
                            className="accordion-container"
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                className="accordion-summary"
                            >
                                <Typography>Data</Typography>
                            </AccordionSummary>

                            <AccordionDetails>
                                <ThemeProvider theme={accordionTheme}>
                                    <Accordion
                                        expanded={jaiaContext.botAccordionStates.gps}
                                        onChange={() => {
                                            handleAccordionClick(BotAccordionNames.GPS);
                                        }}
                                        className="accordion-container"
                                    >
                                        <AccordionSummary
                                            expandIcon={<ExpandMoreIcon />}
                                            className="accordion-summary"
                                        >
                                            <Typography>GPS</Typography>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <table>
                                                <tbody>
                                                    <tr>
                                                        <td>Latitude</td>
                                                        <td>
                                                            {formatLatitude(
                                                                botSensors.getGPS().getLat(),
                                                            )}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>Longitude</td>
                                                        <td>
                                                            {formatLongitude(
                                                                botSensors.getGPS().getLon(),
                                                            )}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>HDOP</td>
                                                        <td>
                                                            {botSensors
                                                                .getGPS()
                                                                .getHDOP()
                                                                ?.toFixed(DETAILS_DECIMALS)}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>PDOP</td>
                                                        <td>
                                                            {botSensors
                                                                .getGPS()
                                                                .getPDOP()
                                                                ?.toFixed(DETAILS_DECIMALS)}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>Ground Speed</td>
                                                        <td>
                                                            {botSensors
                                                                .getGPS()
                                                                .getSpeedOverGround()
                                                                ?.toFixed(DETAILS_DECIMALS)}{" "}
                                                            m/s
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>Course Over Ground</td>
                                                        <td>
                                                            {botSensors
                                                                .getGPS()
                                                                .getCourseOverGround()
                                                                ?.toFixed(DETAILS_DECIMALS)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </AccordionDetails>
                                    </Accordion>
                                </ThemeProvider>

                                <ThemeProvider theme={accordionTheme}>
                                    <Accordion
                                        expanded={jaiaContext.botAccordionStates.imu}
                                        onChange={() => {
                                            handleAccordionClick(BotAccordionNames.IMU);
                                        }}
                                        className="accordion-container"
                                    >
                                        <AccordionSummary
                                            expandIcon={<ExpandMoreIcon />}
                                            className="accordion-summary"
                                        >
                                            <Typography>IMU</Typography>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <table>
                                                <tbody>
                                                    <tr>
                                                        <td>Heading</td>
                                                        <td>
                                                            {formatAttitudeAngle(
                                                                botSensors.getIMU().getHeading(),
                                                            )}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>Pitch</td>
                                                        <td>
                                                            {formatAttitudeAngle(
                                                                botSensors.getIMU().getPitch(),
                                                            )}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>IMU Cal</td>
                                                        <td>
                                                            {botSensors
                                                                .getIMU()
                                                                .getCalibrationStatus()}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </AccordionDetails>
                                    </Accordion>
                                </ThemeProvider>

                                <ThemeProvider theme={accordionTheme}>
                                    <Accordion
                                        expanded={jaiaContext.botAccordionStates.sensor}
                                        onChange={() => {
                                            handleAccordionClick(BotAccordionNames.SENSOR);
                                        }}
                                        className="accordion-container"
                                    >
                                        <AccordionSummary
                                            expandIcon={<ExpandMoreIcon />}
                                            className="accordion-summary"
                                        >
                                            <Typography>Sensors</Typography>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <table>
                                                <tbody>
                                                    <tr>
                                                        <td>Temperature</td>
                                                        <td>
                                                            {botSensors
                                                                .getTemperatureSensor()
                                                                .getTemperature()
                                                                ?.toFixed(DETAILS_DECIMALS)}{" "}
                                                            °C
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>Depth</td>
                                                        <td>
                                                            {botSensors
                                                                .getPressureSensor()
                                                                .getDepth()
                                                                ?.toFixed(DETAILS_DECIMALS)}{" "}
                                                            m
                                                        </td>
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
    );
}
