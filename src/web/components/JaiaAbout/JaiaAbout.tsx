import { useContext } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import NotificationDot from "../NotificatioDot/NotificationDot";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { Version } from "../../types/protobuf-types";

import Icon from "@mdi/react";
import { mdiClose } from "@mdi/js";

import JaiaLogo from "../../style/icons/jaia-logo.png";
import "./JaiaAbout.less";

/**
 * Displays company and version information in the JCC
 */
export default function JaiaAbout() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Combines the major, minor, and patch into a single string
     *
     * @param {Metadata} metadata Contains software version numbers
     * @returns {void}
     */
    const formatVersion = (version: Version) => {
        if (!version) {
            return "---";
        }

        if (version.major && version.minor && version.patch) {
            return `${version.major}.${version.minor}.${version.patch}`;
        }
    };

    const getNotificationDotHelperText = () => {
        if (!jaiaGlobal.getIsInternetConnected()) {
            return "No Internet Connection";
        }

        if (jaiaGlobal.getIsUpgradeAvailable()) {
            return (
                <a href="jcu/" target="_blank" rel="noopener noreferrer">
                    Upgrade Available
                </a>
            );
        }
    };

    /**
     * Sets the visible panel to NONE
     *
     * @returns {void}
     */
    const handleCloseClick = () => {
        jaiaDispatch({ type: JaiaActions.CLICKED_BUTTON });
    };

    return (
        <div className="jaia-about">
            <button onClick={() => handleCloseClick()}>
                <Icon path={mdiClose} size={1} />
            </button>
            <img src={JaiaLogo}></img>
            <div className="notification-row">
                <NotificationDot className="jaia-about-panel" />
                <div>{getNotificationDotHelperText()}</div>
                <NotificationDot className="jaia-about-panel" />
            </div>
            <div className="jaia-about-row">
                <div className="label">Website:</div>
                <a href="https://www.jaia.tech" target="_blank" rel="noopener noreferrer">
                    www.jaia.tech
                </a>
            </div>
            <div className="jaia-about-row">
                <div className="label">Phone:</div>
                <div className="input">+1 (401) 214-9232</div>
            </div>
            <div className="jaia-about-row">
                <div className="label">Address:</div>
                <div className="input">22 Burnside St Bristol RI 02809</div>
            </div>
            <div className="jaia-about-row">
                <div className="label">Software Version:</div>
                <div className="input">
                    {formatVersion(jaiaContext.jaiaGlobal.getMetadata()?.jaiabot_version)}
                </div>
            </div>
            <div className="jaia-about-row">
                <div className="label">Documentation:</div>
                <a href="http://52.36.157.57/index.html" target="_blank" rel="noopener noreferrer">
                    JaiaDocs
                </a>
            </div>
        </div>
    );
}
