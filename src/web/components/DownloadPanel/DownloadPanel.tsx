import React, { useState } from "react";

// Utilities
import { downloadToFile, downloadBlobToFile } from "../../utils/download";
import { KMLDocument } from "../../shared/KMZExport";
import { taskPackets } from "../../data/task_packets/task-packets";
import { getCSV, getCSVFilename } from "../../shared/CSVExport";

/**
 * Prepares a KML document for download
 *
 * @returns {void}
 */
const handleClickedDownloadKMZ = async () => {
    const kmlDocument = new KMLDocument();

    kmlDocument.setTaskPackets(taskPackets.getTaskPackets());

    let fileDate = new Date();
    // Use the date of the first task packet, if present
    if (taskPackets.getTaskPackets()[0]?.start_time !== undefined) {
        fileDate = new Date(taskPackets.getTaskPackets()[0].start_time / 1e3);
    }

    const dateString = fileDate.toISOString();

    downloadBlobToFile(`taskPackets-${dateString}.kmz`, await kmlDocument.getKMZ());
};

/**
 * Event handler for the CSV dowload button.
 * Creates the CSV file and initiates the download.
 *
 * @returns {void}
 */
const handleDownloadCSV = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const csvFilename = getCSVFilename(taskPackets.getTaskPackets());
    downloadToFile(await getCSV(taskPackets.getTaskPackets()), "text/csv", csvFilename);
};

export default function DownloadPanel() {}
