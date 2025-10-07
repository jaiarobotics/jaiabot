import { useContext, useState } from "react";
import { FormControl, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { JaiaContext } from "../../context/JaiaContext";
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
            <button>Scan For Bot</button>
            <button>Scan For All Bots</button>
        </div>
    );
}
