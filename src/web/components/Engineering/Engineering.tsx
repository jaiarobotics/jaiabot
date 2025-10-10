import { useContext, useState } from "react";
import { FormControl, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import Bot from "../../data/bots/bot";
import { JaiaContext } from "../../context/JaiaContext";
import { BotStatusRate, Engineering } from "../../types/protobuf-types";
import { jaiaAPI } from "../../utils/jaia-api";
import "../../style/stylesheets/engineering.less";

interface BotRequirementsSectionProps {
    visibleBotRequirements: number[];
    bots: Map<Number, Bot>;
}

interface BotRequirmentsTableProps {
    engineering: Engineering;
}

enum EngineeringInputs {
    BOT_STATUS_RATE = "update-status-rate",
    TRANSIT_HDOP_REQ = "update-transit-hdop",
    TRANSIT_PDOP_REQ = "update-transit-pdop",
    AFTER_DIVE_HDOP_REQ = "update-after-dive-hdop",
    AFTER_DIVE_PDOP_REQ = "update-after-dive-pdop",
    TRANSIT_GPS_FIX_CHECKS = "update-transit-gps-fix-checks",
    TRANSIT_GPS_DEGRADED_FIX_CHECKS = "update-transit-gps-degraded-fix-checks",
    AFTER_DIVE_GPS_FIX_CHECKS = "update-after-dive-gps-fix-checks",
    RF_DISABLE_TIMEOUT = "update-rf-disable-time",
}

export default function Engineering() {
    const jaiaContext = useContext(JaiaContext);
    const [selectedBotID, setSelectedBotID] = useState("");
    const [visibleBotRequirements, setVisibleBotRequirements] = useState([]);

    /**
     * Updates state with the selected Bot ID
     *
     * @param {SelectChangeEvent} evt Contains the selected Bot ID
     * @returns {void}
     */
    const handleMenuSelection = (evt: SelectChangeEvent) => {
        setSelectedBotID(evt.target.value);
    };

    const handleQuerySelectedStatusClick = async (botID: number) => {
        const engineeringCommand: Engineering = {
            bot_id: botID,
            query_engineering_status: true,
        };
        const res = await jaiaAPI.postEngineering(engineeringCommand);
        if (res && res.status === "ok") {
            if (!visibleBotRequirements.includes(botID)) {
                const updatedVisibleBotRequirements = visibleBotRequirements.concat(botID);
                updatedVisibleBotRequirements.sort((a, b) => a - b);
                setVisibleBotRequirements(updatedVisibleBotRequirements);
            }
        }
    };

    const handleQueryAllStatusesClick = async () => {
        for (const botID of jaiaContext.bots.keys()) {
            const res = await handleQuerySelectedStatusClick(botID);
        }
    };

    const handleUpdateSelectedBotClick = (botID: number) => {
        const engineeringUpdate: Engineering = {
            bot_id: botID,
            bot_status_rate:
                `BotStatusRate_${document.getElementById(EngineeringInputs.BOT_STATUS_RATE)}` as BotStatusRate,
            gps_requirements: {
                transit_hdop_req: Number(
                    document.getElementById(EngineeringInputs.TRANSIT_HDOP_REQ),
                ),
                transit_pdop_req: Number(
                    document.getElementById(EngineeringInputs.TRANSIT_PDOP_REQ),
                ),
                after_dive_hdop_req: Number(
                    document.getElementById(EngineeringInputs.AFTER_DIVE_HDOP_REQ),
                ),
                after_dive_pdop_req: Number(
                    document.getElementById(EngineeringInputs.AFTER_DIVE_PDOP_REQ),
                ),
                transit_gps_fix_checks: Number(
                    document.getElementById(EngineeringInputs.TRANSIT_GPS_FIX_CHECKS),
                ),
                transit_gps_degraded_fix_checks: Number(
                    document.getElementById(EngineeringInputs.TRANSIT_GPS_DEGRADED_FIX_CHECKS),
                ),
                after_dive_gps_fix_checks: Number(
                    document.getElementById(EngineeringInputs.AFTER_DIVE_GPS_FIX_CHECKS),
                ),
            },
            rf_disable_options: {
                rf_disable_timeout_mins: Number(
                    document.getElementById(EngineeringInputs.RF_DISABLE_TIMEOUT),
                ),
            },
        };
        jaiaAPI.postEngineeringPanel(engineeringUpdate);
    };

    const handleUpdateAllBotsClick = () => {
        for (const botID of jaiaContext.bots.keys()) {
            handleUpdateSelectedBotClick(botID);
        }
    };

    return (
        <div className="engineering-container">
            <div className="bot-select-container">
                <div>Bot:</div>
                <FormControl size="small">
                    <Select
                        onChange={(evt: SelectChangeEvent) => handleMenuSelection(evt)}
                        value={selectedBotID}
                    >
                        {Array.from(jaiaContext.bots.values()).map((bot) => {
                            const botID = bot.getBotID();
                            return (
                                <MenuItem key={botID} value={botID}>
                                    {botID}
                                </MenuItem>
                            );
                        })}
                    </Select>
                </FormControl>
            </div>
            <BotRequirementsSection
                visibleBotRequirements={visibleBotRequirements}
                bots={jaiaContext.bots}
            />
            <button
                className="engineering-button"
                onClick={() => handleQuerySelectedStatusClick(Number(selectedBotID))}
            >
                Query Selected Status
            </button>
            <BotRequirementsTable
                engineering={jaiaContext.bots.get(Number(selectedBotID)).getEngineering()}
            />
            <button className="engineering-button" onClick={() => handleQueryAllStatusesClick()}>
                Query All Statuses
            </button>
            <button className="engineering-button" onClick={() => console.log("")}>
                Chain Gains
            </button>
            <button
                className="engineering-button"
                onClick={() => handleUpdateSelectedBotClick(Number(selectedBotID))}
            >
                Updated Selected Bot
            </button>
            <button className="engineering-button" onClick={() => handleUpdateAllBotsClick()}>
                Updated All Bots
            </button>
        </div>
    );
}

function BotRequirementsSection(props: BotRequirementsSectionProps) {
    if (props.visibleBotRequirements.length === 0) {
        return;
    }

    return (
        <div>
            {props.visibleBotRequirements.map((botID) => {
                return (
                    <BotRequirementsTable engineering={props.bots.get(botID).getEngineering()} />
                );
            })}
        </div>
    );
}

function BotRequirementsTable(props: BotRequirmentsTableProps) {
    const formatBotStatusRates = () => {
        return Object.keys(BotStatusRate).map((rate, index) => {
            const splitRate = rate.split("_");
            const displayRate = splitRate[1] + "_" + splitRate[2];
            return (
                <option value={index} key={index}>
                    {displayRate}
                </option>
            );
        });
    };

    if (!props.engineering) {
        return;
    }

    return (
        <div>
            <h3>Requirments</h3>
            <table>
                <tbody>
                    <tr>
                        <td>Current Status Rate</td>
                        <td>{props.engineering.bot_status_rate ?? "-"}</td>
                    </tr>
                    <tr>
                        <td>Current RF Disable Time Mins</td>
                        <td>
                            {props.engineering.rf_disable_options.rf_disable_timeout_mins ?? "-"}
                        </td>
                    </tr>
                    <tr>
                        <td>Current Transit HDOP</td>
                        <td>{props.engineering.gps_requirements.transit_hdop_req ?? "-"}</td>
                    </tr>
                    <tr>
                        <td>Current Transit PDOP</td>
                        <td>{props.engineering.gps_requirements.transit_pdop_req ?? "-"}</td>
                    </tr>
                    <tr>
                        <td>Current After Dive HDOP</td>
                        <td>{props.engineering.gps_requirements.after_dive_hdop_req ?? "-"}</td>
                    </tr>
                    <tr>
                        <td>Current After Dive PDOP</td>
                        <td>{props.engineering.gps_requirements.after_dive_pdop_req ?? "-"}</td>
                    </tr>
                    <tr>
                        <td>Current Transit GPS Checks</td>
                        <td>{props.engineering.gps_requirements.transit_gps_fix_checks ?? "-"}</td>
                    </tr>
                    <tr>
                        <td>Current Degraded GPS Checks</td>
                        <td>
                            {props.engineering.gps_requirements.transit_gps_degraded_fix_checks ??
                                "-"}
                        </td>
                    </tr>
                    <tr>
                        <td>Current After Dive GPS Checks</td>
                        <td>
                            {props.engineering.gps_requirements.after_dive_gps_fix_checks ?? "-"}
                        </td>
                    </tr>
                    <tr>
                        <td>Update Status Rate</td>
                        <td>
                            <select id={EngineeringInputs.BOT_STATUS_RATE}>
                                {formatBotStatusRates()}
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <td>Update RF Disable Time Mins</td>
                        <td>
                            <input
                                id={EngineeringInputs.RF_DISABLE_TIMEOUT}
                                type="number"
                                defaultValue={
                                    props.engineering.rf_disable_options.rf_disable_timeout_mins ??
                                    "-"
                                }
                            />
                        </td>
                    </tr>
                    <tr>
                        <td>Update Transit HDOP</td>
                        <td>
                            <input
                                id={EngineeringInputs.TRANSIT_HDOP_REQ}
                                type="number"
                                defaultValue={
                                    props.engineering.gps_requirements.transit_hdop_req ?? "-"
                                }
                            />
                        </td>
                    </tr>
                    <tr>
                        <td>Update Transit PDOP</td>
                        <td>
                            <input
                                id={EngineeringInputs.TRANSIT_PDOP_REQ}
                                type="number"
                                defaultValue={
                                    props.engineering.gps_requirements.transit_pdop_req ?? "-"
                                }
                            />
                        </td>
                    </tr>
                    <tr>
                        <td>Update After Dive HDOP</td>
                        <td>
                            <input
                                id={EngineeringInputs.AFTER_DIVE_HDOP_REQ}
                                type="number"
                                defaultValue={
                                    props.engineering.gps_requirements.after_dive_hdop_req ?? "-"
                                }
                            />
                        </td>
                    </tr>
                    <tr>
                        <td>Update After Dive PDOP</td>
                        <td>
                            <input
                                id={EngineeringInputs.AFTER_DIVE_PDOP_REQ}
                                type="number"
                                defaultValue={
                                    props.engineering.gps_requirements.after_dive_pdop_req ?? "-"
                                }
                            />
                        </td>
                    </tr>
                    <tr>
                        <td>Update Transit GPS Checks</td>
                        <td>
                            <input
                                id={EngineeringInputs.TRANSIT_GPS_FIX_CHECKS}
                                type="number"
                                defaultValue={
                                    props.engineering.gps_requirements.transit_gps_fix_checks ?? "-"
                                }
                            />
                        </td>
                    </tr>
                    <tr>
                        <td>Update Degraded GPS Checks</td>
                        <td>
                            <input
                                id={EngineeringInputs.TRANSIT_GPS_DEGRADED_FIX_CHECKS}
                                type="number"
                                defaultValue={
                                    props.engineering.gps_requirements
                                        .transit_gps_degraded_fix_checks ?? "-"
                                }
                            />
                        </td>
                    </tr>
                    <tr>
                        <td>Update After Dive GPS Checks</td>
                        <td>
                            <input
                                id={EngineeringInputs.AFTER_DIVE_GPS_FIX_CHECKS}
                                type="number"
                                defaultValue={
                                    props.engineering.gps_requirements.after_dive_gps_fix_checks ??
                                    "-"
                                }
                            />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
