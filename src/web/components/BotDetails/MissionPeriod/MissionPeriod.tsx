import { useState } from "react";

import Bot from "../../../data/bots/bot";
import { Command, CommandType } from "../../../types/protobuf-types";
import { sendBotCommand } from "../../../utils/commands";

import { FormControl, MenuItem, Select, SelectChangeEvent } from "@mui/material";

interface Props {
    bot: Bot;
}

const MISSION_PERIOD_OPTIONS_SECONDS = [
    { label: "3 Hours", value: 10800 },
    { label: "6 Hours", value: 21600 },
    { label: "12 Hours", value: 43200 },
    { label: "24 Hours", value: 86400 },
    { label: "48 Hours", value: 172800 },
];

/**
 * Lets the operator set the time from one wake to the next; the bot sleeps for
 * whatever is left after each mission.
 * This is a bot-level setting (not tied to a mission), since bots can
 * be driven entirely by their own state machine without ever being
 * assigned a mission from JCC.
 */
export default function MissionPeriod(props: Props) {
    const [missionPeriodSeconds, setMissionPeriodSeconds] = useState(
        MISSION_PERIOD_OPTIONS_SECONDS[0].value,
    );

    const handleChange = (event: SelectChangeEvent) => {
        const seconds = Number(event.target.value);
        setMissionPeriodSeconds(seconds);

        const command: Command = {
            bot_id: props.bot.getBotID(),
            type: CommandType.SET_MISSION_PERIOD,
            mission_period_seconds: seconds,
        };
        sendBotCommand(command);
    };

    return (
        <FormControl size="small" fullWidth className="bot-mission-period">
            <Select value={missionPeriodSeconds.toString()} onChange={handleChange}>
                {MISSION_PERIOD_OPTIONS_SECONDS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                        {option.label}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}
