import DataOffloadQueue from "../DataOffloadQueue/DataOffloadQueue";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Accordion, AccordionDetails, AccordionSummary } from "@mui/material";

// Utilities
import { downloadFile } from "../../utils/download";
import { KMLDocument } from "../../utils/KMZExport";
import { taskPackets } from "../../data/task_packets/task-packets";
import { getCSV, getCSVFilename } from "../../utils/CSVExport";

import "./DataOffloadPanel.less";

/**
 * Displays the data offload queue and buttons to download task packet data
 */
export default function DataOffloadPanel() {
    /**
     * Prepares a KML document for download
     *
     * @returns {void}
     */
    const handleDownloadKMZ = async () => {
        const kmlDocument = new KMLDocument();

        kmlDocument.setTaskPackets(taskPackets.getTaskPackets());

        let fileDate = new Date();
        // Use the date of the first task packet, if present
        if (taskPackets.getTaskPackets()[0]?.start_time !== undefined) {
            fileDate = new Date(taskPackets.getTaskPackets()[0].start_time / 1e3);
        }

        downloadFile(`taskPackets-${fileDate.toISOString()}.kmz`, await kmlDocument.getKMZ());
    };

    /**
     * Event handler for the CSV dowload button.
     * Creates the CSV file and initiates the download.
     *
     * @returns {void}
     */
    const handleDownloadCSV = async (event: React.MouseEvent<HTMLButtonElement>) => {
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
