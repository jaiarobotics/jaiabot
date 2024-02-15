import React, { useState } from 'react'

import WptToggle from './WptToggle'
import { taskData } from './TaskPackets'
import { KMLDocument } from './shared/KMZExport'
import { downloadBlobToFile } from './shared/Utilities'
import { PanelType } from './CommandControl'
import { info } from '../libs/notifications'
import { Interactions } from './Interactions'


import Accordion from '@mui/material/Accordion'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'

import { Icon } from '@mdi/react'
import { mdiLayersTriple, mdiMapMarker, mdiSendVariant, mdiRuler } from '@mdi/js'
import { Button } from '@mui/material'
import '../style/components/SettingsPanel.css'
import { downloadToFile } from './shared/Utilities'
import { getCSV, getCSVFilename } from './shared/CSVExport'

import { Interaction } from 'ol/interaction'


interface Props {
    changeInteraction: (newInteraction: Interaction, cursor:string) => void
    taskPacketsTimeline: {[key: string]: string | boolean}
    isClusterModeOn: boolean
    handleTaskPacketEditDatesToggle: () => void
    handleTaskPacketsTimelineChange: (evt: React.ChangeEvent<HTMLInputElement>) => void
    handleSubmitTaskPacketsTimeline: () => void
    handleKeepEndDateCurrentToggle: () => void
    interactions: Interactions
    isTaskPacketsSendBtnDisabled: () => boolean
    setClusterModeStatus: (isOn: boolean) => void
    setVisiblePanel: (panelType: PanelType) => void
    trackBot: (id: number | string) => void
    trackingTarget:string | number | null
    visiblePanel: PanelType
    zoomToPod: (firstMove: boolean) => void
}

enum AccordionTabs {
    TaskPackets = 'TASK_PACKETS'
}

export function SettingsPanel(props: Props) {
    const [openAccordionTabs, setOpenAccordionTabs] = useState([])

    const handleClusterToggleClick = () => {
        // Task packets within this distance (meters) will be clustered
        const defaultDistance = 30

        if (props.isClusterModeOn) {
            taskData.updateClusterDistance(0)
        } else {
            taskData.updateClusterDistance(defaultDistance)
        }

        props.setClusterModeStatus(!props.isClusterModeOn)
    }
    const trackPodButton = (props.trackingTarget === 'pod' ? (
        <Button
            className="button-jcc active"
            onClick={() => {
                props.zoomToPod(false);
                props.trackBot(null);
            }}
        >
            <Icon path={mdiMapMarker} title="Unfollow Bots" />
        </Button>
    ) : (
        <Button
            className="button-jcc"
            onClick={() => {
                props.zoomToPod(true);
                props.trackBot('pod');
            }}
        >
            <Icon path={mdiMapMarker} title="Follow Bots" />
        </Button>
    ))

    const measureButton = (props.visiblePanel == PanelType.MEASURE_TOOL) ? (
        <div>
            <div id="measureResult" />
            <Button
                className="button-jcc active"
                onClick={() => {
                    props.setVisiblePanel(PanelType.NONE)
                }}
            >
                <Icon path={mdiRuler}  title="Measurement Result" />
            </Button>
        </div>
    ) : (
        <Button
            className="button-jcc"
            onClick={() => {
                props.setVisiblePanel(PanelType.MEASURE_TOOL)
                props.changeInteraction(props.interactions.measureInteraction, 'crosshair');
                info('Touch map to set first measure point');
            }}
        >
            <Icon path={mdiRuler}  title="Measure Distance" />
        </Button>
    )
    const mapLayersButton = (props.visiblePanel == PanelType.MAP_LAYERS) ? (
        <Button className="button-jcc active"
            onClick={() => {
                props.setVisiblePanel(PanelType.NONE)
            }}
        >
            <Icon path={mdiLayersTriple} title="Map Layers" />
        </Button>

    ) : (
        <Button className="button-jcc"
            onClick={() => {
                props.setVisiblePanel(PanelType.MAP_LAYERS)
            }}
        >
            <Icon path={mdiLayersTriple} title="Map Layers" />
        </Button>
    )


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

    return (
        <div className="settings-outer-container">
			<div className="panel-heading">Settings</div>
            <div className="settings-inner-container">
 
            {trackPodButton}
            {measureButton}
            {mapLayersButton}

                <Accordion 
                    expanded={isOpenAccordionTab(AccordionTabs.TaskPackets)}
                    onChange={() => handleAccordionTabClick(AccordionTabs.TaskPackets)}
                    className='accordionContainer'
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls='panel1a-content'
                        id='panel1a-header'
                    >
                        <Typography>Task Packets</Typography>
                    </AccordionSummary>
                    <AccordionDetails className="settings-accordion-inner-container">
                        <div className="settings-card">
                            <div className="settings-label">Clusters:</div>
                            <WptToggle 
                                checked={() => props.isClusterModeOn}
                                onClick={() => handleClusterToggleClick()}
                            />
                        </div>
                        <div className="settings-card">
                            <div className="settings-label">Edit Dates:</div>
                            <WptToggle 
                                checked={() => props.taskPacketsTimeline.isEditing as boolean}
                                onClick={() => props.handleTaskPacketEditDatesToggle()}
                            />
                        </div>
                        <div className={
                            `settings-card-grid
                            ${props.taskPacketsTimeline.isEditing ? " visible" : " hidden"}`
                        }>
                            <div className="settings-label">Start Date:</div>
                            <input 
                                id="task-packet-start-date" 
                                type="date" 
                                value={props.taskPacketsTimeline.startDate as string} 
                                onChange={(evt) => props.handleTaskPacketsTimelineChange(evt)}
                                max={''}>
                            </input>
                            <input 
                                id="task-packet-start-time" 
                                type="time" 
                                value={props.taskPacketsTimeline.startTime as string} 
                                onChange={(evt) => props.handleTaskPacketsTimelineChange(evt)}>
                            </input>
                            
                            <div className="settings-label">End Date:</div>
                            <input 
                                id="task-packet-end-date" 
                                type="date" 
                                value={props.taskPacketsTimeline.endDate as string}
                                onChange={(evt) => props.handleTaskPacketsTimelineChange(evt)}>
                            </input>
                            <input 
                                id="task-packet-end-time" 
                                type="time"
                                value={props.taskPacketsTimeline.endTime as string}
                                onChange={(evt) => props.handleTaskPacketsTimelineChange(evt)}>
                            </input>
                            
                            <div className="task-packet-button-container">
                                <div className="task-packet-checkbox-container">
                                    <input 
                                        type="checkbox"
                                        checked={props.taskPacketsTimeline.keepEndDateCurrent as boolean}
                                        onChange={() => props.handleKeepEndDateCurrentToggle()}>
                                    </input>
                                    <label>Keep End Date Current</label>
                                </div>
                                <div 
                                    className={
                                        `settings-send-btn
                                        ${props.isTaskPacketsSendBtnDisabled() ? ' disabled' : ''}`
                                    }
                                    onClick={() => props.handleSubmitTaskPacketsTimeline()}
                                >
                                    <Icon path={mdiSendVariant} title='Get Task Packets'/>
                                </div>
                            </div>
                        </div>
                        <Button onClick={handleDownloadCSV} className='button-jcc'>Download CSV</Button>
                        <Button onClick={handleClickedDownloadKMZ} className='button-jcc'>Download KMZ</Button>
                    </AccordionDetails>
                </Accordion>
            </div>
        </div>
    )
}
