import { useContext } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import NotificationDot from "../NotificationDot/NotificationDot";
import { DeviceMetadata_Version } from "../../shared/proto/jaiabot/messages/metadata";

import Icon from "@mdi/react";
import { mdiClose } from "@mdi/js";

import JaiaLogo from "../../style/icons/jaia-logo.png";
import "./JaiaAbout.less";

const COMPANY_WEBSITE = "https://jaia.tech";
const PHONE_NUMBER = "+1 (401) 214-9232";
const COMPANY_ADDRESS = "22 Burnside St Bristol RI 02809";
const DOC_WEBSITE = "http://docs.jaia.tech";

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
    const formatVersion = (version: DeviceMetadata_Version) => {
        if (!version) {
            return "---";
        }

        if (version.major && version.minor && version.patch) {
            return `${version.major}.${version.minor}.${version.patch}`;
        }

        return "---";
    };

    /**
     * Provides context to the notification dot
     *
     * @returns {HTMLElement} Description of notification dot
     */
    const getNotificationDotHelperElement = () => {
        if (!jaiaContext.jaiaGlobal.getIsConnectedToInternet()) {
            return <p>No Internet Connection</p>;
        }

        if (jaiaContext.jaiaGlobal.getIsUpgradeAvailable()) {
            return (
                <a href="jcu/" target="_blank" rel="noopener noreferrer">
                    Upgrade Available
                </a>
            );
        }

        return <p>Connected to Internet</p>;
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
            <div className="jaia-about-row">
                <div className="label">Notifications:</div>
                <div className="input notification">
                    <NotificationDot className="jaia-about-panel" />
                    {getNotificationDotHelperElement()}
                </div>
            </div>
            <div className="jaia-about-row">
                <div className="label">Website:</div>
                <a href={COMPANY_WEBSITE} target="_blank" rel="noopener noreferrer">
                    www.jaia.tech
                </a>
            </div>
            <div className="jaia-about-row">
                <div className="label">Phone:</div>
                <div className="input">{PHONE_NUMBER}</div>
            </div>
            <div className="jaia-about-row">
                <div className="label">Address:</div>
                <div className="input">{COMPANY_ADDRESS}</div>
            </div>
            <div className="jaia-about-row">
                <div className="label">Software DeviceMetadata_Version:</div>
                <div className="input">
                    {formatVersion(jaiaContext.jaiaGlobal.getMetadata()?.jaiabot_version)}
                </div>
            </div>
            <div className="jaia-about-row">
                <div className="label">Documentation:</div>
                <a href={DOC_WEBSITE} target="_blank" rel="noopener noreferrer">
                    JaiaDocs
                </a>
            </div>
        </div>
    );
}
