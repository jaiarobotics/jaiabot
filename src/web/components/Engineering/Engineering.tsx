import { useContext, useState } from "react";
import { FormControl, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { JaiaContext } from "../../context/JaiaContext";
import { BotStatusRate, Engineering } from "../../types/protobuf-types";
import "../../style/stylesheets/engineering.less";

interface BotRequirmentProps {
    engineering: Engineering;
    isVisible: boolean;
}

export default function Engineering() {
    const jaiaContext = useContext(JaiaContext);
    const [selectedBotID, setSelectedBotID] = useState("");
    const [showBotRequirements, setShowBotRequirments] = useState(true);

    /**
     * Updates state with the selected Bot ID
     *
     * @param {SelectChangeEvent} evt Contains the selected Bot ID
     * @returns {void}
     */
    const handleMenuSelection = (evt: SelectChangeEvent) => {
        setSelectedBotID(evt.target.value);
    };

    const handleQuerySelectedStatusClick = () => {
        setShowBotRequirments(!showBotRequirements);
    };

    const handleUpdateSelectedBotClick = (botID: number) => {
        const engineeringCommand: Engineering = {
            bot_id: botID,
        };
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
            <button className="engineering-button" onClick={() => handleQuerySelectedStatusClick()}>
                Query Selected Status
            </button>
            <BotRequirementsTable
                engineering={jaiaContext.bots.get(Number(selectedBotID)).getEngineering()}
                isVisible={showBotRequirements}
            />
            <button className="engineering-button" onClick={() => console.log("")}>
                Query All Statuses
            </button>
            <button className="engineering-button" onClick={() => console.log("")}>
                Chain Gains
            </button>
            <button className="engineering-button" onClick={() => console.log("")}>
                Updated Selected Bot
            </button>
            <button className="engineering-button" onClick={() => console.log("")}>
                Updated All Bots
            </button>
        </div>
    );
}

function BotRequirementsTable(props: BotRequirmentProps) {
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

    if (!props.engineering || !props.isVisible) {
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
                            <select id="update-status-rate">{formatBotStatusRates()}</select>
                        </td>
                    </tr>
                    <tr>
                        <td>Update RF Disable Time Mins</td>
                        <td>
                            <input
                                id="update-rf-disable-time"
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
                                id="update-transit-hdop"
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
                                id="update-transit-pdop"
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
                                id="update-after-dive-hdop"
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
                                id="update-after-dive-pdop"
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
                                id="update-transit-gps-checks"
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
                                id="update-degraded-gps-checks"
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
                                id="update-after-dive-gps-checks"
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
