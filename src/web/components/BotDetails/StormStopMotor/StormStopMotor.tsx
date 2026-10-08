import Bot from "../../../data/bots/bot";
import { Command, CommandType } from "../../../types/protobuf-types";
import { sendBotCommand } from "../../../utils/commands";

import { Button } from "@mui/material";

interface Props {
    bot: Bot;
}

/**
 * TEMPORARY (tube escape test): sends STOP regardless of mission state so the
 * STORM manager stops recovery thrust (e.g. during self test, where the
 * regular Stop button is disabled). Remove after the test.
 */
export default function StormStopMotor(props: Props) {
    const handleClick = () => {
        if (!window.confirm(`Stop motor on Bot ${props.bot.getBotID()}?`)) {
            return;
        }

        const command: Command = {
            bot_id: props.bot.getBotID(),
            type: CommandType.STOP,
        };
        sendBotCommand(command);
    };

    return (
        <Button variant="contained" color="error" size="small" fullWidth onClick={handleClick}>
            Stop Motor
        </Button>
    );
}
