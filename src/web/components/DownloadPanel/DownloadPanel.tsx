import React, { useState } from "react";

// Utilities
import { downloadToFile, downloadBlobToFile } from "../../utils/download";
import { KMLDocument } from "../../shared/KMZExport";
import { taskPackets } from "../../data/task_packets/task-packets";
import { getCSV, getCSVFilename } from "../../shared/CSVExport";

export default function DownloadPanel() {
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

    return (
        <div className="download-panel-outer-container">
            <div className="panel-heading">Download Panel</div>

            <div className="download-panel-inner-container">
                <Accordion
                    expanded={isOpenAccordionTab(AccordionTabs.DownloadToComputer)}
                    onChange={() => handleAccordionTabClick(AccordionTabs.DownloadToComputer)}
                    className="accordionContainer"
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls="panel1a-content"
                        id="panel1a-header"
                    >
                        <Typography>Download To Computer</Typography>
                    </AccordionSummary>
                    <AccordionDetails className="download-panel-accordion-inner-container">
                        <Button onClick={handleDownloadCSV} className="button-jcc">
                            Download CSV
                        </Button>
                        <Button onClick={handleClickedDownloadKMZ} className="button-jcc">
                            Download KMZ
                        </Button>
                    </AccordionDetails>
                </Accordion>
                <Accordion
                    expanded={isOpenAccordionTab(AccordionTabs.DownloadQueue)}
                    onChange={() => handleAccordionTabClick(AccordionTabs.DownloadQueue)}
                    className="accordionContainer"
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls="panel1a-content"
                        id="panel1a-header"
                    >
                        <Typography>Download Queue</Typography>
                    </AccordionSummary>
                    <AccordionDetails className="download-panel-accordion-inner-container">
                        {props.downloadableBots.length == 0 ? (
                            <div className="download-queue-empty">Queue is Empty</div>
                        ) : (
                            <div className="download-queue-inner-container">
                                {props.downloadableBots.map((bot) => {
                                    return (
                                        <div className="download-queue-card">
                                            <div className="download-queue-bot-number">
                                                Bot: {bot.bot_id}
                                            </div>
                                            <CircularProgress
                                                determinate
                                                value={props.getBotDownloadPercent(bot.bot_id)}
                                            />
                                            <div
                                                className="download-queue-clos-btn-container"
                                                onClick={() => props.removeBotFromQueue(bot)}
                                            >
                                                <Icon
                                                    path={mdiClose}
                                                    size={1}
                                                    className="download-queue-close-btn"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </AccordionDetails>
                </Accordion>
            </div>
        </div>
    );
}
