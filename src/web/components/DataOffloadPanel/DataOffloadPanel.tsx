import DataOffloadQueue from "../DataOffloadQueue/DataOffloadQueue";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Accordion, AccordionDetails, AccordionSummary } from "@mui/material";

// Utilities
import { downloadFile } from "../../utils/download/download";
import { taskPackets } from "../../data/task_packets/task-packets";
import { getCSV, getCSVFilename } from "../../utils/download/csv-export";
import { getKMZ, getKMZFilename } from "../../utils/download/kmz-export";

import "./DataOffloadPanel.less";

/**
 * Displays the data offload queue and buttons to download task packet data
 */
export default function DataOffloadPanel() {
    /**
     * Initiates KMZ download of task packet data
     *
     * @returns {void}
     */
    const handleDownloadKMZ = async () => {
        const kmzFilename = getKMZFilename(taskPackets.getTaskPackets());
        downloadFile(kmzFilename, await getKMZ(taskPackets.getTaskPackets()));
    };

    /**
     * Initiates CSV download of task packet data
     *
     * @returns {void}
     */
    const handleDownloadCSV = async () => {
        const csvFilename = getCSVFilename(taskPackets.getTaskPackets());
        downloadFile(csvFilename, await getCSV(taskPackets.getTaskPackets()), "text/csv");
    };

    return (
        <div className="jaia-panel data-offload-panel">
            <div className="jaia-panel-title">Data Offload</div>
            <div className="button-row">
                <button onClick={handleDownloadCSV} aria-label={"download-csv"}>
                    CSV
                </button>
                <button onClick={handleDownloadKMZ} aria-label={"download-kmz"}>
                    KMZ
                </button>
            </div>
            <Accordion className="accordion-container">
                <AccordionSummary className="accordion-summary" expandIcon={<ExpandMoreIcon />}>
                    Progress Queue
                </AccordionSummary>
                <AccordionDetails>
                    <DataOffloadQueue />
                </AccordionDetails>
            </Accordion>
        </div>
    );
}
