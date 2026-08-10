import { useContext, useState } from "react";
import { FormControl, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { JaiaContext } from "../../../context/JaiaContext";
import { jaiaAPI } from "../../../utils/jaia-api";
import { success } from "../../../utils/notifications";
import { BotStatusRate, Engineering, PIDControl, PIDSettings } from "../../../types/protobuf-types";
import MotorRPMTest from "./MotorRPMTest";
import "../../../style/stylesheets/engineering.less";

interface Props {
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

const pidTypes: (keyof PIDControl)[] = [
    "speed",
    "heading",
    "roll",
    "pitch",
    "depth",
    "heading_constant",
];

const pidGains: (keyof PIDSettings)[] = ["Kp", "Ki", "Kd"];

/**
 * Produces the engineering section in the JCC Settings to update low-level controls
 */
export default function Engineering() {
    const jaiaContext = useContext(JaiaContext);
    const [selectedBotID, setSelectedBotID] = useState("");

    /**
     * Updates state with the selected Bot ID
     *
     * @param {SelectChangeEvent} evt Contains the selected Bot ID
     * @returns {void}
     */
    const handleMenuSelection = (evt: SelectChangeEvent) => {
        setSelectedBotID(evt.target.value);
    };

    /**
     * Submits command to query engineering status
     *
     * @param {number} botID Bot of interest
     * @returns {void}
     */
    const handleQuerySelectedStatusClick = async (botID: number) => {
        const takeControl = await jaiaAPI.takeControl();
        if (!takeControl) {
            return;
        }

        const engineeringCommand: Engineering = {
            bot_id: botID,
            query_engineering_status: true,
        };

        const res = await jaiaAPI.postEngineering(engineeringCommand);
        if (res && res.status === "ok") {
            success(`Querying status for Bot ${botID}`);
        }
    };

    /**
     * Submits an updated engineering configuration for the provided Bot
     *
     * @param {number} botID Which Bot to configure
     * @returns {void}
     */
    const handleUpdateSelectedBotClick = async (botID: number) => {
        // Prevents new configs from being sent without input elements visible
        if (!botID || !document.getElementById(EngineeringInputs.BOT_STATUS_RATE)) {
            return;
        }

        const engineeringUpdate: Engineering = {
            bot_id: botID,
            bot_status_rate:
                `BotStatusRate_${getEngineeringInputValue(EngineeringInputs.BOT_STATUS_RATE)}` as BotStatusRate,
            gps_requirements: {
                transit_hdop_req: Number(
                    getEngineeringInputValue(EngineeringInputs.TRANSIT_HDOP_REQ),
                ),
                transit_pdop_req: Number(
                    getEngineeringInputValue(EngineeringInputs.TRANSIT_PDOP_REQ),
                ),
                after_dive_hdop_req: Number(
                    getEngineeringInputValue(EngineeringInputs.AFTER_DIVE_HDOP_REQ),
                ),
                after_dive_pdop_req: Number(
                    getEngineeringInputValue(EngineeringInputs.AFTER_DIVE_PDOP_REQ),
                ),
                transit_gps_fix_checks: Number(
                    getEngineeringInputValue(EngineeringInputs.TRANSIT_GPS_FIX_CHECKS),
                ),
                transit_gps_degraded_fix_checks: Number(
                    getEngineeringInputValue(EngineeringInputs.TRANSIT_GPS_DEGRADED_FIX_CHECKS),
                ),
                after_dive_gps_fix_checks: Number(
                    getEngineeringInputValue(EngineeringInputs.AFTER_DIVE_GPS_FIX_CHECKS),
                ),
            },
            rf_disable_options: {
                rf_disable_timeout_mins: Number(
                    getEngineeringInputValue(EngineeringInputs.RF_DISABLE_TIMEOUT),
                ),
            },
            pid_control: packagePIDValues(),
        };

        const takeControlRes = await jaiaAPI.takeControl();
        if (takeControlRes && takeControlRes.status === "ok") {
            const commandRes = await jaiaAPI.postEngineeringPanel(engineeringUpdate);
            if (commandRes && commandRes.status === "ok") {
                success(`Submitted update for Bot ${botID}`);
            }
        }
    };

    /**
     * Loops through all connected Bots submitting engineering configuration
     *
     * @returns {void}
     */
    const handleUpdateAllBotsClick = () => {
        for (const botID of jaiaContext.bots.getBots().keys()) {
            handleUpdateSelectedBotClick(botID);
        }
    };

    /**
     * Takes the PID input values and formats them into the PIDControl message
     *
     * @returns {PIDControl} PID values formatted for the engineering command message
     */
    const packagePIDValues = () => {
        const pidControl: PIDControl = {};
        for (const pidType of pidTypes) {
            const pidSettings: PIDSettings = {};
            for (const pidGain of pidGains) {
                const input = document.getElementById(`${pidType}-${pidGain}`) as HTMLInputElement;
                pidSettings[pidGain] = Number(input.value);
            }
            (pidControl[pidType] as PIDSettings) = pidSettings;
        }
        return pidControl;
    };

    /**
     * Looks up an input element by ID and returns its value
     *
     * @param {EngineeringInputs} inputID Which input element to retrieve
     * @returns {string} The value of the input element
     */
    const getEngineeringInputValue = (inputID: EngineeringInputs) => {
        const input = document.getElementById(inputID) as HTMLInputElement;

        if (!input) {
            return "";
        }

        return input.value;
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
                        {Array.from(jaiaContext.bots.getBots().values()).map((bot) => {
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
            <button
                className="engineering-button"
                onClick={() => handleQuerySelectedStatusClick(Number(selectedBotID))}
            >
                Query Selected Status
            </button>
            <BotRequirementsTable
                engineering={jaiaContext.bots.getBot(Number(selectedBotID))?.getEngineering()}
            />
            <PIDGainsTable
                engineering={jaiaContext.bots.getBot(Number(selectedBotID))?.getEngineering()}
            />
            <button
                className="engineering-button"
                onClick={() => handleUpdateSelectedBotClick(Number(selectedBotID))}
            >
                Updated Selected Bot
            </button>
            <button className="engineering-button" onClick={() => handleUpdateAllBotsClick()}>
                Updated All Bots
            </button>
            <MotorRPMTest botID={Number(selectedBotID)} />
        </div>
    );
}

/**
 * Generates the table to allow an operator to update low-level engineering configs
 */
function BotRequirementsTable(props: Props) {
    /**
     * Creates a map of option elements for the menu of BotStatus update rates
     *
     * @returns {HTMLElement[]} Dropdown options for the BotStatus update rate
     */
    const generateBotStatusRateOptions = () => {
        return Object.keys(BotStatusRate).map((rate, index) => {
            const displayRate = formatBotStatusRate(rate);
            return (
                <option value={displayRate} key={index}>
                    {displayRate}
                </option>
            );
        });
    };

    /**
     * Parses the BotStatusRate into its numerical value and units
     *
     * @param {string} rate BotStatusRate value
     * @returns {string} The numerical value and units of the status rate
     */
    const formatBotStatusRate = (rate: string) => {
        if (!rate) {
            return "-";
        }

        const splitRate = rate.split("_");
        return splitRate[1] + "_" + splitRate[2];
    };

    if (!props.engineering) {
        return;
    }

    return (
        <table>
            <tbody>
                <tr>
                    <td>Current Status Rate</td>
                    <td>{formatBotStatusRate(props.engineering.bot_status_rate)}</td>
                </tr>
                <tr>
                    <td>Current RF Disable Time Mins</td>
                    <td>{props.engineering.rf_disable_options.rf_disable_timeout_mins ?? "-"}</td>
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
                        {props.engineering.gps_requirements.transit_gps_degraded_fix_checks ?? "-"}
                    </td>
                </tr>
                <tr>
                    <td>Current After Dive GPS Checks</td>
                    <td>{props.engineering.gps_requirements.after_dive_gps_fix_checks ?? "-"}</td>
                </tr>
                <tr>
                    <td>Update Status Rate</td>
                    <td>
                        <select id={EngineeringInputs.BOT_STATUS_RATE}>
                            {generateBotStatusRateOptions()}
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
                                props.engineering.rf_disable_options.rf_disable_timeout_mins ?? "-"
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
                                props.engineering.gps_requirements.after_dive_gps_fix_checks ?? "-"
                            }
                        />
                    </td>
                </tr>
            </tbody>
        </table>
    );
}

/**
 * Generates the table to allow an operator to update PID values
 */
function PIDGainsTable(props: Props) {
    if (!props.engineering) {
        return;
    }

    return (
        <table>
            <thead>
                <tr>
                    <th></th>
                    <th>Kp</th>
                    <th>Ki</th>
                    <th>Kd</th>
                </tr>
            </thead>
            <tbody>
                {pidTypes.map((pidType) => {
                    return (
                        <tr key={pidType}>
                            <td>{pidType}</td>
                            {pidGains.map((pidGain) => {
                                const pidTypeGain = pidType + "-" + pidGain;
                                const pidSettings = props.engineering.pid_control?.[
                                    pidType
                                ] as PIDSettings;
                                return (
                                    <td key={pidGain}>
                                        <input
                                            id={pidTypeGain}
                                            defaultValue={pidSettings?.[pidGain] ?? "-"}
                                        />
                                    </td>
                                );
                            })}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
