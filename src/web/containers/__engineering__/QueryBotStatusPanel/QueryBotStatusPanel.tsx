import Button from "@mui/material/Button";
import { useState } from "react";
import { jaiaAPI } from "../../../utils/jaia-api";
import { Engineering } from "../../../types/protobuf-types";

export default function QueryBotStatusPanel() {
    const [botID, setBotID] = useState(0);
    const submitQueryBotStatus = () => {
        const engineeringCommand: Engineering = {
            bot_id: botID,
            query_bot_status: true,
        };

        jaiaAPI.postEngineeringPanel(engineeringCommand);
    };

    return (
        <div>
            <label>Query Bot Status</label>
            <div>
                <div>Bot ID</div>
                <input />
            </div>
            <button onClick={submitQueryBotStatus}>Query Bot Status</button>
        </div>
    );
}
