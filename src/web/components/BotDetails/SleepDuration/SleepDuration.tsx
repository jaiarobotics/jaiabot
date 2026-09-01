import { useState } from "react";

import Bot from "../../../data/bots/bot";
import { Command, CommandType } from "../../../types/protobuf-types";
import { sendBotCommand } from "../../../utils/commands";

import { FormControl, MenuItem, Select, SelectChangeEvent } from "@mui/material";

interface Props {
    bot: Bot;
}

const SLEEP_DURATION_OPTIONS_SECONDS = [
    { label: "3 Hours", value: 10800 },
    { label: "6 Hours", value: 21600 },
    { label: "12 Hours", value: 43200 },
    { label: "24 Hours", value: 86400 },
    { label: "48 Hours", value: 172800 },
];

/**
 * Lets the operator set how long the bot sleeps between missions.
 * This is a bot-level setting (not tied to a mission), since bots can
 * be driven entirely by their own state machine without ever being
 * assigned a mission from JCC.
 */
export default function SleepDuration(props: Props) {
    const [sleepDurationSeconds, setSleepDurationSeconds] = useState(
        SLEEP_DURATION_OPTIONS_SECONDS[0].value,
    );

    const handleChange = (event: SelectChangeEvent) => {
        const seconds = Number(event.target.value);
        setSleepDurationSeconds(seconds);

        const command: Command = {
            bot_id: props.bot.getBotID(),
            type: CommandType.SET_SLEEP_DURATION,
            sleep_duration_seconds: seconds,
        };
        sendBotCommand(command);
    };

    return (
        <FormControl size="small" fullWidth className="bot-sleep-duration">
            <Select value={sleepDurationSeconds.toString()} onChange={handleChange}>
                {SLEEP_DURATION_OPTIONS_SECONDS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                        {option.label}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}
