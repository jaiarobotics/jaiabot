import { useState } from "react";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Accordion, AccordionDetails, AccordionSummary, Typography } from "@mui/material";
import { ThemeProvider } from "@emotion/react";

import JaiaToggle from "../../components/JaiaToggle/JaiaToggle";
import { trackPod } from "../../openlayers/controls/track-pod";
import { accordionTheme } from "../../utils/style";

import "./SettingsPanel.less";

/**
 * Contains general configurations for the JCC and Jaia System
 */

export default function SettingsPanel() {
    const [isTrackingPod, setIsTrackingPod] = useState(trackPod.isTracking());

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

    return (
        <div className="jaia-panel settings-panel">
            <div className="jaia-panel-title">Settings</div>
            <div className="settings-row">
                <div className="settings-label">Track Pod:</div>
                <JaiaToggle checked={() => isTrackingPod} onClick={handleTrackPodToggleClick} />
            </div>
            <div className="accordions-container">
                <ThemeProvider theme={accordionTheme}>
                    <Accordion className="accordion-container">
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            className="accordion-summary"
                        >
                            <Typography>Task Packets</Typography>
                        </AccordionSummary>
                        <AccordionDetails></AccordionDetails>
                    </Accordion>

                    <Accordion className="accordion-container">
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            className="accordion-summary"
                        >
                            <Typography>Map Layers</Typography>
                        </AccordionSummary>
                        <AccordionDetails></AccordionDetails>
                    </Accordion>

                    <Accordion className="accordion-container">
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            className="accordion-summary"
                        >
                            <Typography>Engineering</Typography>
                        </AccordionSummary>
                        <AccordionDetails></AccordionDetails>
                    </Accordion>
                </ThemeProvider>
            </div>
        </div>
    );
}
