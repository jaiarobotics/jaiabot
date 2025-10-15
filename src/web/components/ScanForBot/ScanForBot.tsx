import { useContext, useState } from "react";
import { FormControl, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { JaiaContext } from "../../context/JaiaContext";
import { DEFAULT_HUB_ID } from "../../utils/constants";
import { sendHubCommand } from "../../utils/commands";
import { CommandForHub, HubCommandType } from "../../types/protobuf-types";
import { success } from "../../utils/notifications";
import "../../style/stylesheets/engineering.less";

/**
 * Allows operators to manually send a subscription command to Bots
 */
export default function ScanForBot() {
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
     * Forms the scan for Bot command to be issued by the Hub
     *
     * @param {number} botID Which Bot to scan for
     * @returns {void}
     */
    const sendScanForBot = async (botID: number) => {
        const hub = jaiaContext.hubs.get(DEFAULT_HUB_ID);

        if (!hub || botID === 0) {
            return;
        }

        const command: CommandForHub = {
            hub_id: hub.getHubID(),
            type: HubCommandType.SCAN_FOR_BOTS,
            scan_for_bot_id: botID,
        };

        const res = await sendHubCommand(command);
        if (res && res.status === "ok") {
            success(`Scanning for Bot ${botID}`);
        }
    };

    /**
     * Loops through the connected Bots and creates dropdown options
     *
     * @returns {<MenuItem />[]} Array of dropdown option for the select menu
     */
    const generateBotMenuItems = () => {
        return Array.from(jaiaContext.bots.values()).map((bot) => {
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
            <div className="heading">Scan For Bot</div>
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
            <button
                className="engineering-button"
                onClick={() => sendScanForBot(Number(selectedBotID))}
            >
                Scan For Bot
            </button>
        </div>
    );
}
