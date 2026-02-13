import React from "react";
import JaiaLogo from "../../style/icons/jaia-logo.svg";
import "./LoadingScreen.less";

/**
 * Loading screen component that displays during JCC initialization
 * Shows the Jaiabot logo and a red loading progress bar
 */
export default function LoadingScreen() {
    return (
        <div className="loading-screen">
            <div className="loading-content">
                <img
                    src={JaiaLogo}
                    alt="Jaiabot Logo"
                    className="loading-logo"
                />
                <div className="loading-bar-container">
                    <div className="loading-bar"></div>
                </div>
                <div className="loading-text">Loading Jaia Command & Control...</div>
            </div>
        </div>
    );
}
