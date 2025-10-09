import { useContext, useState } from "react";
import { FormControl, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { JaiaContext } from "../../context/JaiaContext";
import "../../style/stylesheets/engineering.less";

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
            <button className="engineering-button" onClick={() => console.log("")}>
                Query Selected Status
            </button>
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
