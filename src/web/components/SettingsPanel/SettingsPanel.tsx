import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import JaiaToggle from "../../components/JaiaToggle/JaiaToggle";
import { ThemeProvider } from "@emotion/react";
import { accordionTheme } from "../../utils/style";
import { Accordion, AccordionDetails, AccordionSummary, Typography } from "@mui/material";
import { useState } from "react";
import { trackPod } from "../../openlayers/controls/track-pod";

import "./SettingsPanel.less";

export default function SettingsPanel() {
    const [isTrackingPod, setIsTrackingPod] = useState(false);

    const handleTrackPodToggleClick = () => {
        if (isTrackingPod) {
            trackPod.stopTracking();
        } else {
            trackPod.startTracking("pod");
        }
        setIsTrackingPod(!isTrackingPod);
    };

    const isChecked = isTrackingPod;

    return (
        <div className="jaia-panel settings-panel">
            <div className="jaia-panel-title">Settings</div>
            <div className="accordions-container">
                <div className="settings-card-container">
                    <div className="settings-card">
                        <div className="settings-track-pod-label">Track Pod:</div>
                        <JaiaToggle checked={() => isChecked} onClick={handleTrackPodToggleClick} />
                    </div>
                </div>

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
