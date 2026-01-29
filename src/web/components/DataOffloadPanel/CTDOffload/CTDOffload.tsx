import Icon from "@mdi/react";
import { mdiClose } from "@mdi/js";
import { success } from "toastr";
import { useContext, useMemo, useState } from "react";

import Hub from "../../../data/hubs/hub";
import { JaiaContext } from "../../../context/JaiaContext";
import { jaiaAPI } from "../../../utils/jaia-api";
import { sendHubCommand } from "../../../utils/commands";
import { CommandForHub, HubCommandType } from "../../../types/protobuf-types";
import "./CTDOffload.less";

interface Props {
    isVisible: boolean;
    closeCTDPanel?: () => void;
    deleteDialogClick?: (action: DialogAction) => void;
}

enum DialogAction {
    DEFAULT = 1,
    DELETE = 2,
}

const LOOKUP_DELAY = 5_000;

export default function CTDOffload(props: Props) {
    const jaiaContext = useContext(JaiaContext);
    const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState(false);
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
        setIsDeleteDialogVisible(true);
    };

    const startCTDDownload = (deleteCTDFiles: boolean) => {
        for (const [botID, checkedState] of botCheckedStates.entries()) {
            if (checkedState) {
                const hub = jaiaContext.hubs.getHubs().values().next()?.value as Hub;
                const command: CommandForHub = {
                    hub_id: hub.getHubID() ?? 0,
                    type: HubCommandType.CTD_DATA_OFFLOAD,
                    scan_for_bot_id: botID,
                };
                sendHubCommand(command).then(() => getCTDFiles(botID, deleteCTDFiles));
            }
        }
        success("Starting CTD download");
    };

    const handleDeleteDialogClick = (action: DialogAction) => {
        setIsDeleteDialogVisible(false);
        let deleteCTDFiles = false;
        if (action === DialogAction.DELETE) {
            deleteCTDFiles = true;
        }
        startCTDDownload(deleteCTDFiles);
    };

    const getCTDFiles = (botID: number, deleteCTDFiles: boolean) => {
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

            if (deleteCTDFiles) {
                jaiaAPI.deleteCTDProfiles(botID);
            }
        }, LOOKUP_DELAY);
    };

    const getConnectedBots = () => {
        const bots = jaiaContext.bots.getBots();
        return Array.from(bots.values()).map((bot) => {
            if (bot.getBatteryPercent() > 0) {
                return (
                    <li key={bot.getBotID()}>
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
                    <button className="close-button" onClick={() => props.closeCTDPanel()}>
                        <Icon path={mdiClose} size={1} />
                    </button>
                </div>
                <div>Bots in WiFi Range:</div>
                <ul>{getConnectedBots()}</ul>
                <button className="download-button" onClick={() => handleDownloadCTDClick()}>
                    Download
                </button>
                <CTDDialog
                    isVisible={isDeleteDialogVisible}
                    deleteDialogClick={handleDeleteDialogClick}
                />
            </div>
        );
    }
}

function CTDDialog(props: Props) {
    if (props.isVisible) {
        return (
            <div className="ctd-dialog">
                <div className="ctd-text">
                    Would you like to remove the CTD files from the Hub after this download?
                </div>
                <div className="ctd-button-row">
                    <button onClick={() => props.deleteDialogClick(DialogAction.DEFAULT)}>
                        No
                    </button>
                    <button onClick={() => props.deleteDialogClick(DialogAction.DELETE)}>
                        Yes
                    </button>
                </div>
            </div>
        );
    }
}
