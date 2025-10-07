import { useContext, useState } from "react";
import { FormControl, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { JaiaContext } from "../../context/JaiaContext";
import { DEFAULT_HUB_ID } from "../../utils/constants";
import { sendHubCommand } from "../../utils/commands";
import { CommandForHub, HubCommandType } from "../../types/protobuf-types";
import { success } from "../../utils/notifications";
import "./ScanForBot.less";

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

        if (!hub) {
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
     * Sends the scan for Bot command for each Bot in the Hub's radio file
     *
     * @returns {void}
     */
    const sendScanForBots = () => {
        const hub = jaiaContext.hubs.get(DEFAULT_HUB_ID);

        if (!hub || !hub.getBotIDsInRadioFile()) {
            return;
        }

        for (const botID of hub.getBotIDsInRadioFile()) {
            sendScanForBot(botID);
        }
    };

    return (
        <div className="scan-for-bot-container">
            <div className="heading">Scan For Bot</div>
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
            <button
                className="engineering-button"
                onClick={() => sendScanForBot(Number(selectedBotID))}
            >
                Scan For Bot
            </button>
            <button className="engineering-button" onClick={() => sendScanForBots()}>
                Scan For All Bots
            </button>
        </div>
    );
}
