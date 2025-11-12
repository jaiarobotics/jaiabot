import { useEffect, useState } from "react";

import { jaiaAPI } from "../../utils/jaia-api";
import { Metadata } from "../../types/protobuf-types";

import JaiaLogo from "../../style/icons/jaia-logo.svg";
import "./JaiaAbout.less";

/**
 * Displays company and version information in the JCC
 */
export default function JaiaAbout() {
    const [version, setVersion] = useState("");

    useEffect(() => {
        jaiaAPI.getMetadata().then((metadata: Metadata) => formatVersion(metadata));
    }, []);

    /**
     * Combines the major, minor, and patch into a single string
     *
     * @param {Metadata} metadata Contains software version numbers
     * @returns {void}
     */
    const formatVersion = (metadata: Metadata) => {
        const version = metadata.jaiabot_version;

        if (!version) {
            return;
        }

        if (version.major && version.minor && version.patch) {
            setVersion(`${version.major}.${version.minor}.${version.patch}`);
        }
    };

    return (
        <div className="jaia-about">
            <img src={JaiaLogo}></img>
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
                <div className="label">JCC Version:</div>
                <div className="input">{version}</div>
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
