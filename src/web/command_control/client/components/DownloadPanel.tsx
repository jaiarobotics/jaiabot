import React, { useState } from 'react'

// Styling
import '../style/components/DownloadPanel.css'
import '../style/components/Details.less'
import { Button } from '@mui/material'
import Accordion from '@mui/material/Accordion'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import CircularProgress from '@mui/joy/CircularProgress';
import Icon from '@mdi/react'
import { mdiClose, mdiDownloadMultiple } from '@mdi/js'

// Utilities
import { taskData } from './TaskPackets'
import { KMLDocument } from './shared/KMZExport'
import { downloadBlobToFile } from './shared/Utilities'
import { downloadToFile } from './shared/Utilities'
import { getCSV, getCSVFilename } from './shared/CSVExport'

// Jaia Imports
import { PortalBotStatus } from './shared/PortalStatus';

interface Props {
    downloadableBots: PortalBotStatus[]
    removeBotFromQueue: (bot: PortalBotStatus) => void
    getBotDownloadPercent: (botId: number) => number
    processDownloadAllBots: () => Promise<void>
}

enum AccordionTabs {
    DownloadToComputer = 'DOWNLOAD_TO_COMPUTER',
    DownloadQueue = 'DOWNLOAD_QUEUE'
}

export default function DownloadPanel(props: Props) {
    const [openAccordionTabs, setOpenAccordionTabs] = useState([])

    const isOpenAccordionTab = (accordionTab: AccordionTabs) => {
        return openAccordionTabs.includes(accordionTab)
    }

    const handleAccordionTabClick = (accordionTab: AccordionTabs) => {
        let updatedOpenAccordionTabs = [...openAccordionTabs]
        
        if (isOpenAccordionTab(accordionTab)) {
            for (let i = 0; i < openAccordionTabs.length; i++) {
                if (openAccordionTabs[i] === accordionTab) {
                    updatedOpenAccordionTabs.splice(i, 1)
                    setOpenAccordionTabs(updatedOpenAccordionTabs)
                }
            }
        } else {
            updatedOpenAccordionTabs.push(accordionTab)
            setOpenAccordionTabs(updatedOpenAccordionTabs)
        }
    }

    const handleDownloadAll = async () => {
        await props.processDownloadAllBots();
    };

    
    /**
     * Prepares a KML document for download
     * 
     * @returns {void}
     */
    const handleClickedDownloadKMZ = async () => {
        const kmlDocument = new KMLDocument()
        kmlDocument.setTaskPackets(taskData.taskPackets)

        let fileDate = new Date()
        // Use the date of the first task packet, if present
        if (taskData.taskPackets[0]?.start_time !== undefined) {
            fileDate = new Date(taskData.taskPackets[0].start_time / 1e3)
        }

        const dateString = fileDate.toISOString()

        downloadBlobToFile(`taskPackets-${dateString}.kmz`, await kmlDocument.getKMZ())
    }
    
    
    /**
     * Event handler for the CSV dowload button.  Creates the CSV file and initiates
     * the download.
     *
    **/
    const handleDownloadCSV = async (event: React.MouseEvent<HTMLButtonElement>) => {
        const csvFilename = getCSVFilename(taskData.taskPackets)
        downloadToFile(await getCSV(taskData.taskPackets), 'text/csv', csvFilename)
    }

    return(
        <div className="download-panel-outer-container">
            <div className="panel-heading">Download Panel</div>

            <div className="download-panel-inner-container">
            <div className="toolbar">
            <Button id="downloadAll" className={`button-jcc`} onClick={handleDownloadAll}>
				<Icon path={mdiDownloadMultiple} title="Download All"/>
			</Button>
            </div>
            
            <Accordion 
                    expanded={isOpenAccordionTab(AccordionTabs.DownloadToComputer)}
                    onChange={() => handleAccordionTabClick(AccordionTabs.DownloadToComputer)}
                    className='accordionContainer'
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls='panel1a-content'
                        id='panel1a-header'
                    >
                        <Typography>Download To Computer</Typography>
                    </AccordionSummary>
                    <AccordionDetails className="download-panel-accordion-inner-container">
                        <Button onClick={handleDownloadCSV} className='button-jcc'>Download CSV</Button>
                        <Button onClick={handleClickedDownloadKMZ} className='button-jcc'>Download KMZ</Button>
                    </AccordionDetails>
            </Accordion>
            {/* <br /> */}
            <Accordion 
                    expanded={isOpenAccordionTab(AccordionTabs.DownloadQueue)}
                    onChange={() => handleAccordionTabClick(AccordionTabs.DownloadQueue)}
                    className='accordionContainer'
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls='panel1a-content'
                        id='panel1a-header'
                    >
                        <Typography>Download Queue</Typography>
                    </AccordionSummary>
                    <AccordionDetails className="download-panel-accordion-inner-container">
                    {props.downloadableBots.map(bot => {
                    return (
                        <div className="download-queue-card">
                            <div className="download-queue-bot-number">Bot: {bot.bot_id}</div>
                            <CircularProgress determinate value={props.getBotDownloadPercent(bot.bot_id)}/>
                            <div className='download-queue-clos-btn-container' onClick={() => props.removeBotFromQueue(bot)}>
                                <Icon path={mdiClose} size={1} className='download-queue-close-btn'/>
                            </div>
                        </div>
                    )
                    })}
                    </AccordionDetails>
                </Accordion>
            </div>

        </div>
    )
}