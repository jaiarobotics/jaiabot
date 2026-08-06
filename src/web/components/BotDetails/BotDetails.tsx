import React, { useContext, useEffect } from "react";

// Jaia Imports
import HealthRow from "./HealthRow/HealthRow";
import DeleteMissionButton from "../../components/__buttons__/DeleteMissionButton/DeleteMissionButton";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaContextType, JaiaAction } from "../../types/context-types";
import { JaiaActions } from "../../context/jaia-actions";

import StopButton from "../../components/__buttons__/StopButton/StopButton";
import SystemButton from "../../components/__buttons__/SystemButton/SystemButton";
import ActivateButton from "../../components/__buttons__/ActivateButton/ActivateButton";
import NextTaskButton from "../../components/__buttons__/NextTaskButton/NextTaskButton";
import DataOffloadButton from "../../components/__buttons__/DataOffloadButton/DataOffloadButton";
import StartMissionButton from "../../components/__buttons__/StartMissionButton/StartMissionButton";
import RemoteControlButton from "../../components/__buttons__/RemoteControlButton/RemoteControlButton";

import { MissionStatus, SystemButtonTypes } from "../../types/jaia-system-types";
import { BotAccordionNames } from "../../types/context-types";
import { DETAILS_DECIMALS, UNASSIGNED_ID } from "../../utils/constants";

import BotSensors from "../../data/bots/bot-sensors";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import {
    getDistanceToHub,
    getStatusAgeClassName,
    getBotOffloadPercent,
    getRepeatProgress,
    getDistToWaypoint,
    isBotLogging,
    searchGhostMissions,
    getConstantHeadingTimeRemaining,
} from "./bot-details";

import { accordionTheme, addDropdownListener } from "../../utils/style";
import {
    formatLatitude,
    formatLongitude,
    formatAttitudeAngle,
    convertMicrosecondsToSeconds,
} from "../../shared/Utilities";

// MDI and MUI
import { ThemeProvider } from "@mui/material";
import Accordion from "@mui/material/Accordion";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";

import "./BotDetails.less";

export default function BotDetails() {
    const jaiaContext: JaiaContextType = useContext(JaiaContext);
    const jaiaDispatch: React.Dispatch<JaiaAction> = useContext(JaiaDispatchContext);

    useEffect(() => {
        addDropdownListener("accordion-container", "bot-details-accordions-container");
    });

    const hub = jaiaContext.hubs.getHubs().values().next()?.value;
    const botID = jaiaContext.jaiaGlobal.getSelectedNode().id;
    const bot = jaiaContext.bots.getBot(botID);
    if (!bot || !hub) {
        return;
    }

    const missionID = missionsManager.getMissionID(botID);
    let mission = jaiaContext.missionSet.getMission(missionID);
    if (!mission) {
        // Mission can still be undefined if ghost mission does not exist
        mission = searchGhostMissions(botID);
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

    function formatLinkName(link: string) {
        return link.replace("LINK_", "").replaceAll("_", " ");
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
                    <div className="details-toolbar">
                        <StopButton bot={bot} />
                        <StartMissionButton
                            bot={bot}
                            mission={mission}
                            missionSetName={jaiaContext.missionSet.getName()}
                        />
                        <DeleteMissionButton
                            deleteAll={false}
                            missionID={mission?.getMissionID()}
                        />
                    </div>
                </div>
                <div className="accordions-container" id="bot-details-accordions-container">
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
                                        <tr
                                            className={getStatusAgeClassName(
                                                bot.getStatusAge(),
                                                bot.isCommsDropped(),
                                            )}
                                        >
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
                                            <td>Battery</td>
                                            <td>
                                                {bot
                                                    .getBatteryPercent()
                                                    ?.toFixed(DETAILS_DECIMALS) + "%"}
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
                                            <td>Target Waypoint</td>
                                            <td style={{ whiteSpace: "pre-line" }}>
                                                {missionStatus.targetWaypoint ?? "N/A"}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Waypoint Distance</td>
                                            <td style={{ whiteSpace: "pre-line" }}>
                                                {getDistToWaypoint(missionStatus)}
                                            </td>
                                        </tr>
                                        {missionStatus?.missionState ===
                                            "IN_MISSION__UNDERWAY__TASK__CONSTANT_HEADING" && (
                                            <tr>
                                                <td>Constant Heading Time</td>
                                                <td>
                                                    {getConstantHeadingTimeRemaining(missionStatus)}
                                                </td>
                                            </tr>
                                        )}
                                        <tr>
                                            <td>Hub Distance</td>
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
                                            <td>{bot.getWifiLinkQuality() ?? ""}</td>
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
                                    <ActivateButton bot={bot} />
                                    <DataOffloadButton bot={bot} />
                                    <RemoteControlButton bot={bot} />
                                    <NextTaskButton bot={bot} />
                                </div>
                                <Accordion
                                    expanded={jaiaContext.botAccordionStates.advancedCommands}
                                    onChange={() => {
                                        handleAccordionClick(BotAccordionNames.ADVANCED_COMMANDS);
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
                                        <SystemButton
                                            node={bot}
                                            type={SystemButtonTypes.SHUTDOWN}
                                        />
                                        <SystemButton node={bot} type={SystemButtonTypes.REBOOT} />
                                        <SystemButton
                                            node={bot}
                                            type={SystemButtonTypes.RESTART_SERVICES}
                                        />
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
                            <AccordionDetails>
                                <HealthRow />
                            </AccordionDetails>
                        </Accordion>
                    </ThemeProvider>

                    <ThemeProvider theme={accordionTheme}>
                        <Accordion
                            expanded={jaiaContext.botAccordionStates.commLinks}
                            onChange={() => {
                                handleAccordionClick(BotAccordionNames.COMM_LINKS);
                            }}
                            className="accordion-container"
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                className="accordion-summary"
                            >
                                <Typography>Comm Links</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <table>
                                    <tbody>
                                        {Object.entries(bot.getActiveLinkStatusAges()).length >
                                        0 ? (
                                            Object.entries(bot.getActiveLinkStatusAges()).map(
                                                ([link, statusAge]) => (
                                                    <tr
                                                        key={link}
                                                        className={getStatusAgeClassName(
                                                            statusAge,
                                                            bot.isCommsDropped(),
                                                        )}
                                                    >
                                                        <td>{formatLinkName(link)}</td>
                                                        <td>{`${convertMicrosecondsToSeconds(statusAge).toFixed(0)} s`}</td>
                                                    </tr>
                                                ),
                                            )
                                        ) : (
                                            <tr>
                                                <td>No active links</td>
                                                <td>N/A</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </AccordionDetails>
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
