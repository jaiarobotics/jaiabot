import Icon from "@mdi/react";
import { mdiClose } from "@mdi/js";
import { success } from "toastr";
import React, { useContext, useState } from "react";

import Hub from "../../../data/hubs/hub";
import { JaiaContext } from "../../../context/JaiaContext";
import { jaiaAPI } from "../../../utils/jaia-api";
import { sendHubCommand } from "../../../utils/commands";
import { CommandForHub, HubCommandType } from "../../../types/protobuf-types";
import "./CTDOffload.less";

interface Props {
    isVisible: boolean;
    closeCTDPanel: () => void;
}

const LOOKUP_DELAY = 7_500; // ms;
const WIFI_QUALITY_THRESHOLD = 0;

const botCheckedStates = new Map<number, boolean>();

/**
 * Allows an operator to download CTD data via WiFi
 */
export default function CTDOffload(props: Props) {
    const jaiaContext = useContext(JaiaContext);
    const [isDeleteFilesChecked, setIsDeleteFilesChecked] = useState(false);

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
     * Sends the command to the Hub to transfer CTD files from a Bot to the Hub.
     * Once the command has been sent, a call is made to transfer the files from the
     * Hub to the client computer.
     *
     * @param {boolean} deleteCTDFiles Clear the files from the Hub after download
     * @returns {void}
     *
     * @notes
     * Exit full screen prior to download so it can be re-established after
     */
    const handleDownloadCTDClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }

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

    /**
     * Gets the CTD files from the Hub and downloads them to the client computer
     *
     * @param {number} botID Identifies which files to get
     * @param {boolean} deleteCTDFiles Clear the files from the Hub after download
     * @returns {void}
     */
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

            if (isDeleteFilesChecked) {
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
        const connectedBots = Array.from(bots.values()).filter(
            (bot) => bot.getWifiLinkQuality() > WIFI_QUALITY_THRESHOLD,
        );
        return connectedBots.map((bot) => {
            return (
                <li key={bot.getBotID()}>
                    <input type="checkbox" onChange={() => handleCheckboxClick(bot.getBotID())} />
                    <label>Bot {bot.getBotID()}</label>
                </li>
            );
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
                <div className="line-break"></div>
                <div className="remove-files-selection">
                    <input
                        type="checkbox"
                        onChange={() => setIsDeleteFilesChecked(!isDeleteFilesChecked)}
                    />
                    <label>Remove CTD Files From Hub</label>
                </div>
                <button
                    className="download-button"
                    onClick={(event) => handleDownloadCTDClick(event)}
                >
                    Download
                </button>
            </div>
        );
    }
}
