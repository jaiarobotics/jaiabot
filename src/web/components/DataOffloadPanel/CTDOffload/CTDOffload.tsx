import Icon from "@mdi/react";
import { mdiClose } from "@mdi/js";
import { success } from "toastr";
import { useContext, useMemo } from "react";

import Hub from "../../../data/hubs/hub";
import { JaiaContext } from "../../../context/JaiaContext";
import { jaiaAPI } from "../../../utils/jaia-api";
import { sendHubCommand } from "../../../utils/commands";
import { CommandForHub, HubCommandType } from "../../../types/protobuf-types";
import "./CTDOffload.less";

interface Props {
    isVisible: boolean;
}

const LOOKUP_DELAY = 5_000;

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
                const hub = jaiaContext.hubs.getHubs().values().next()?.value as Hub;
                const command: CommandForHub = {
                    hub_id: hub.getHubID() ?? 0,
                    type: HubCommandType.CTD_DATA_OFFLOAD,
                    scan_for_bot_id: botID,
                };
                sendHubCommand(command).then(() => getCTDFiles(botID));
            }
        }
        success("Starting CTD download");
    };

    const getCTDFiles = (botID: number) => {
        setTimeout(async () => {
            const res = await jaiaAPI.getCTDProfiles(botID);
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ctd-bot-${botID}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        }, LOOKUP_DELAY);
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
                <div className="header">
                    <div>CTD Download</div>
                    <button className="close-button">
                        <Icon path={mdiClose} size={1} />
                    </button>
                </div>
                <div>Bots in WiFi Range:</div>
                <ul>{getConnectedBots()}</ul>
                <button className="download-button" onClick={() => handleDownloadCTDClick()}>
                    Download
                </button>
            </div>
        );
    }
}
