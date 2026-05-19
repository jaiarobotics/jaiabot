import { useState, useEffect, useContext } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Accordion, AccordionDetails, AccordionSummary, Typography } from "@mui/material";
import { ThemeProvider } from "@emotion/react";

import MoveHub from "./MoveHub/MoveHub";
import JaiaToggle from "../../components/JaiaToggle/JaiaToggle";
import ScanForBot from "./ScanForBot/ScanForBot";
import Engineering from "./Engineering/Engineering";
import OfflineMaps from "./OfflineMaps/OfflineMaps";
import QueryBotStatus from "./QueryBotStatus/QueryBotStatus";
import LayerSwitcherMenu from "./LayerSwitcherMenu/LayerSwitcherMenu";
import { trackPod } from "../../openlayers/controls/track-pod";
import { CoordinateSystem } from "../../types/jaia-system-types";
import { accordionTheme, addDropdownListener } from "../../utils/style";

import "./SettingsPanel.less";

/**
 * Contains general configurations for the JCC and Jaia System
 */

export default function SettingsPanel() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [isTrackingPod, setIsTrackingPod] = useState(trackPod.isTracking());

    useEffect(() => {
        addDropdownListener("accordion-container", "settings-accordions-container");
    }, []);

    /**
     * Switches the track pod functionality on/off based on the toggle state
     *
     * @returns {void}
     */
    const handleTrackPodToggleClick = () => {
        if (isTrackingPod) {
            trackPod.stopTracking();
        } else {
            trackPod.startTracking();
        }
        setIsTrackingPod(!isTrackingPod);
    };

    /**
     * Opens Jaia Engineering & Debug in a separate tab
     *
     * @returns {void}
     */
    const handleJEDClick = () => {
        window.open("/jed/");
    };

    const handleCoordSystemClick = (coordSystem: CoordinateSystem) => {
        jaiaDispatch({ type: JaiaActions.CHANGE_COORD_SYSTEM, coordinateSystem: coordSystem });
    };

    const getCoordButtonClassName = (coordSystem: CoordinateSystem) => {
        if (coordSystem === jaiaContext.jaiaGlobal.getCoordinateSystem()) {
            return "selected";
        }
        return "";
    };

    return (
        <div className="jaia-panel settings-panel">
            <div className="jaia-panel-title">Settings</div>
            <div className="settings-row">
                <div className="settings-label">Track Pod:</div>
                <JaiaToggle checked={() => isTrackingPod} onClick={handleTrackPodToggleClick} />
            </div>
            <div className="coordinate-system-container">
                <button
                    className={getCoordButtonClassName(CoordinateSystem.LAT_LON)}
                    onClick={() => handleCoordSystemClick(CoordinateSystem.LAT_LON)}
                >
                    Lat / Lon
                </button>
                <button
                    className={getCoordButtonClassName(CoordinateSystem.MGRS)}
                    onClick={() => handleCoordSystemClick(CoordinateSystem.MGRS)}
                >
                    MGRS
                </button>
            </div>
            <div className="accordions-container" id="settings-accordions-container">
                <ThemeProvider theme={accordionTheme}>
                    <Accordion className="accordion-container">
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            className="accordion-summary"
                        >
                            <Typography>Map Layers</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <LayerSwitcherMenu />
                        </AccordionDetails>
                    </Accordion>

                    <Accordion className="accordion-container-engineering">
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            className="accordion-summary"
                        >
                            <Typography>Engineering</Typography>
                        </AccordionSummary>
                        <AccordionDetails className="engineering-accordion-details">
                            <button className="engineering-button" onClick={() => handleJEDClick()}>
                                Jaia Engineering & Debug
                            </button>
                            <Engineering />
                            <QueryBotStatus />
                            <ScanForBot />
                        </AccordionDetails>
                    </Accordion>

                    <Accordion className="accordion-container">
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            className="accordion-summary"
                        >
                            <Typography>Offline Maps</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <OfflineMaps />
                        </AccordionDetails>
                    </Accordion>
                    <Accordion className="accordion-container">
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            className="accordion-summary"
                        >
                            <Typography>Simulation</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <MoveHub />
                        </AccordionDetails>
                    </Accordion>
                </ThemeProvider>
            </div>
        </div>
    );
}
