import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { ThemeProvider } from "@emotion/react";
import { accordionTheme } from "../../utils/style";
import { Accordion, AccordionDetails, AccordionSummary, Typography } from "@mui/material";

import "./SettingsPanel.less";

export default function SettingsPanel() {
    return (
        <div className="jaia-panel settings-panel">
            <div className="jaia-panel-title">Settings</div>
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
