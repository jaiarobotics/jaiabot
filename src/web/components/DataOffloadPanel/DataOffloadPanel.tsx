import DataOffloadQueue from "../DataOffloadQueue/DataOffloadQueue";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Accordion, AccordionDetails, AccordionSummary } from "@mui/material";

import "./DataOffloadPanel.less";

/**
 * Displays the data offload queue and buttons to download task packet data
 */
export default function DataOffloadPanel() {
    return (
        <div className="jaia-panel data-offload-panel">
            <div className="jaia-panel-title">Data Offload</div>
            <div>
                <Accordion className="accordion-container">
                    <AccordionSummary className="accordion-summary" expandIcon={<ExpandMoreIcon />}>
                        Progress Queue
                    </AccordionSummary>
                    <AccordionDetails>
                        <DataOffloadQueue />
                    </AccordionDetails>
                </Accordion>
            </div>
        </div>
    );
}
