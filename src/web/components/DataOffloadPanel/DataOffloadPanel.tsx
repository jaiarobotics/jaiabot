import React, { useState } from "react";
import DataOffloadQueue from "./DataOffloadQueue/DataOffloadQueue";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Accordion, AccordionDetails, AccordionSummary } from "@mui/material";

// Utilities
import { taskPackets } from "../../data/task_packets/task-packets";
import { getCSV, getCSVFilename } from "../../utils/download/csv-export";
import { getKMZ, getKMZFilename } from "../../utils/download/kmz-export";
import { downloadFile, getCTDFiles } from "../../utils/download/download";

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
    const handleDownloadKMZ = async (event: React.MouseEvent<Element, MouseEvent>) => {
        event.stopPropagation();
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
        const kmzFilename = getKMZFilename(taskPackets.getIncludedTaskPackets());
        downloadFile(kmzFilename, await getKMZ(taskPackets.getIncludedTaskPackets()));
    };

    /**
     * Initiates CSV download of task packet data
     *
     * @returns {void}
     */
    const handleDownloadCSV = async () => {
        const csvFilename = getCSVFilename(taskPackets.getIncludedTaskPackets());
        downloadFile(csvFilename, await getCSV(taskPackets.getIncludedTaskPackets()), "text/csv");
    };

    /**
     * Downloads a ZIP file of CTD cast data in the UNB format (University of New Brunswick)
     *
     * @returns {void}
     */
    const handleDownloadCTD = (event: React.MouseEvent<Element, MouseEvent>) => {
        event.stopPropagation();
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
        getCTDFiles();
    };

    return (
        <div className="jaia-panel data-offload-panel">
            <div className="jaia-panel-title">Data Offload</div>
            <div className="button-row">
                <button onClick={handleDownloadCSV} aria-label={"download-csv"}>
                    CSV
                </button>
                <button onClick={(event) => handleDownloadKMZ(event)} aria-label={"download-kmz"}>
                    KMZ
                </button>
                <button onClick={(event) => handleDownloadCTD(event)} aria-label={"download-ctd"}>
                    CTD
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
