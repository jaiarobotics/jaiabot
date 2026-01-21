import Icon from "@mdi/react";
import { mdiClose } from "@mdi/js";

import "./CTDOffload.less";
import { useContext, useMemo } from "react";
import { JaiaContext } from "../../../context/JaiaContext";
import { sendBotCommand } from "../../../utils/commands";
import { Command, CommandType } from "../../../types/protobuf-types";

interface Props {
    isVisible: boolean;
}

export default function CTDOffload(props: Props) {
    const jaiaContext = useContext(JaiaContext);
    const botCheckedStates = useMemo(() => new Map<number, boolean>(), []);

    const handleCheckboxClick = (botID: number) => {
        const checkedState = botCheckedStates.get(botID);
        if (!checkedState) {
            botCheckedStates.set(botID, true);
        } else {
            botCheckedStates.set(botID, false);
        }
    };

    const handleDownloadCTDClick = () => {
        for (const [botID, checkedState] of botCheckedStates.entries()) {
            if (checkedState) {
                const command: Command = {
                    bot_id: botID,
                    type: CommandType.CTD_DATA_OFFLOAD,
                };
                sendBotCommand(command);
            }
        }
    };

    const getConnectedBots = () => {
        const bots = jaiaContext.bots.getBots();
        return Array.from(bots.values()).map((bot) => {
            if (bot.getBatteryPercent() > 0) {
                return (
                    <li>
                        <input
                            type="checkbox"
                            onClick={() => handleCheckboxClick(bot.getBotID())}
                        />
                        <label>Bot {bot.getBotID()}</label>
                    </li>
                );
            }
        });
    };

    if (props.isVisible) {
        return (
            <div className="ctd-offload">
                <button className="close-button">
                    <Icon path={mdiClose} size={1} />
                </button>
                <div>Bots in WiFi Range</div>
                <ul>{getConnectedBots()}</ul>
                <button onClick={() => handleDownloadCTDClick()}>Download CTD Data</button>
            </div>
        );
    }
}
