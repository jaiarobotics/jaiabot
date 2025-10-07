import { useState } from "react";
import { FormControl, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import "./ScanForBot.less";

export default function ScanForBot() {
    const [selectedBotID, setSelectedBotID] = useState("");

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
                        <MenuItem value={"1"}>1</MenuItem>
                    </Select>
                </FormControl>
            </div>
            <button>Scan For Bot</button>
            <button>Scan For All Bots</button>
        </div>
    );
}
