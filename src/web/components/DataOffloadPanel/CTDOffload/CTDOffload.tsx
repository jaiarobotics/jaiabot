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

const LOOKUP_DELAY = 5_000; // ms;

/**
 * Allows an operator to download CTD data via WiFi
 */
export default function CTDOffload(props: Props) {
    const jaiaContext = useContext(JaiaContext);
    const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState(false);
    const botCheckedStates = useMemo(() => new Map<number, boolean>(), []);

    /**
     * Updates the checkbox state of a Bot when clicked
     *
     * @param {number} botID Identifies Bot clicked
     * @returns {void}
     */
    const handleCheckboxClick = (botID: number) => {
        const checkedState = botCheckedStates.get(botID);
        if (!checkedState) {
            botCheckedStates.set(botID, true);
        } else {
            botCheckedStates.set(botID, false);
        }
    };

    /**
     * Opens a dialog to inquire about deleting the
     * downloaded data from the Hub
     *
     * @returns {void}
     */
    const handleDownloadCTDClick = () => {
        setIsDeleteDialogVisible(true);
    };

    /**
     * Sends the command to the Hub to transfer CTD files from a Bot to the Hub.
     * Once the command has been sent, a call is made to transfer the files from the
     * Hub to the client computer.
     *
     * @param {boolean} deleteCTDFiles Clear the files from the Hub after download
     * @returns {void}
     */
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

    /**
     * Makes the call to start the CTD download. Passes the delete information
     * to the download function.
     *
     * @param {DialogAction} action Indicates what button the operator clicked
     * @returns {void}
     */
    const handleDeleteDialogClick = (action: DialogAction) => {
        setIsDeleteDialogVisible(false);
        let deleteCTDFiles = false;
        if (action === DialogAction.DELETE) {
            deleteCTDFiles = true;
        }
        startCTDDownload(deleteCTDFiles);
    };

    /**
     * Gets the CTD files from the Hub and downloads them to the client computer
     *
     * @param {number} botID Identifies which files to get
     * @param {boolean} deleteCTDFiles Clear the files from the Hub after download
     * @returns {void}
     */
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

    /**
     * Creates a list item element for each Bot connected to the router
     *
     * @returns {HTMLElement[]} Displayable list of Bots connected to the router
     */
    const getConnectedBots = () => {
        const bots = jaiaContext.bots.getBots();
        return Array.from(bots.values()).map((bot) => {
            if (bot.getWifiLinkQuality() > 0) {
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

/**
 * Allows the operator to control how the CTD data is managed on the Hub
 * after a download
 */
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
