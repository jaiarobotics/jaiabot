import { useContext, useState } from "react";
import { FormControl, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { JaiaContext } from "../../../context/JaiaContext";
import { Engineering } from "../../../shared/proto/jaiabot/messages/engineering";
import { success } from "../../../utils/notifications";
import { sendEngineeringCommand } from "../../../utils/commands";
import "../../../style/stylesheets/engineering.less";

/**
 * Allows operators to manually request a status message from a Bot
 */
export default function QueryBotStatus() {
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
     * Forms the query Bot status command to be issued by the Hub
     *
     * @returns {void}
     */
    const sendQueryBotStatusCommand = async () => {
        if (selectedBotID === "") {
            return;
        }

        const command: Engineering = {
            bot_id: Number(selectedBotID),
            query_bot_status: true,
        };

        const res = await sendEngineeringCommand(command);
        if (res && res.status === "ok") {
            success(`Querying status for Bot ${selectedBotID}`);
        }
    };

    /**
     * Loops through the connected Bots and creates dropdown options
     *
     * @returns {<MenuItem />[]} Array of dropdown options for the select menu
     */
    const generateBotMenuItems = () => {
        return Array.from(jaiaContext.bots.getBots().values()).map((bot) => {
            const botID = bot.getBotID();
            return (
                <MenuItem key={botID} value={botID}>
                    {botID}
                </MenuItem>
            );
        });
    };

    return (
        <div className="engineering-container">
            <div className="heading">Query Bot Status</div>
            <div className="bot-select-container">
                <div>Bot:</div>
                <FormControl size="small">
                    <Select
                        onChange={(evt: SelectChangeEvent) => handleMenuSelection(evt)}
                        value={selectedBotID}
                    >
                        {generateBotMenuItems()}
                    </Select>
                </FormControl>
            </div>
            <button className="engineering-button" onClick={() => sendQueryBotStatusCommand()}>
                Query Bot Status
            </button>
        </div>
    );
}
