import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import JaiaToggle from "../../components/JaiaToggle/JaiaToggle";
import { ThemeProvider } from "@emotion/react";
import { accordionTheme } from "../../utils/style";
import { Accordion, AccordionDetails, AccordionSummary, Typography } from "@mui/material";
import { useState } from "react";
import { trackPod } from "../../openlayers/controls/track-pod";

import "./SettingsPanel.less";

interface SettingsPanelProps {
    trackingTarget?: string | number | null;
    trackBot?: (id: number | string | null) => void;
    zoomToPod?: (firstMove: boolean) => void;
}

export default function SettingsPanel(props: SettingsPanelProps) {
    const [isTrackingPod, setIsTrackingPod] = useState(false);

    const handleTrackPodToggleClick = () => {
        const isPodCurrentlyTracked = props.trackingTarget === "pod";

        if (props.trackBot && props.zoomToPod && props.trackingTarget !== undefined) {
            if (isPodCurrentlyTracked) {
                props.zoomToPod(false);
                props.trackBot(null);
                trackPod.stopTracking();
            } else {
                props.zoomToPod(true);
                props.trackBot("pod");
                trackPod.startTracking("pod");
            }
        } else {
            if (isTrackingPod) {
                trackPod.stopTracking();
            } else {
                trackPod.startTracking("pod");
            }
            setIsTrackingPod(!isTrackingPod);
        }
    };

    const isChecked =
        props.trackingTarget !== undefined ? props.trackingTarget === "pod" : isTrackingPod;

    return (
        <div className="jaia-panel settings-panel">
            <div className="jaia-panel-title">Settings</div>
            <div className="accordions-container">
                <div className="settings-card-container">
                    <div
                        className="settings-card"
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <div
                            className="settings-label"
                            style={{ color: "white", fontWeight: "bold" }}
                        >
                            Track Pod:
                        </div>
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
