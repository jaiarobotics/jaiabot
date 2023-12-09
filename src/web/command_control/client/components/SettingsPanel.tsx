import React, { useState } from 'react'

import WptToggle from './WptToggle'
import { taskData } from './TaskPackets'

import Accordion from '@mui/material/Accordion'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'

import { Icon } from '@mdi/react'
import { Button } from '@mui/material'
import { mdiDownload, mdiSendVariant } from '@mdi/js'
import '../style/components/SettingsPanel.css'
import { KMLDocument } from './shared/KMZExport'
import { downloadBlobToFile, downloadToFile } from './shared/Utilities'

interface Props {
    taskPacketsTimeline: {[key: string]: string | boolean}
    isClusterModeOn: boolean
    handleTaskPacketEditDatesToggle: () => void
    handleTaskPacketsTimelineChange: (evt: React.ChangeEvent<HTMLInputElement>) => void
    handleSubmitTaskPacketsTimeline: () => void
    handleKeepEndDateCurrentToggle: () => void
    isTaskPacketsSendBtnDisabled: () => boolean
    setClusterModeStatus: (isOn: boolean) => void
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

    const handleClickedDownloadKMZ = async (event: React.MouseEvent<HTMLButtonElement>) => {
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
    
    return (
        <div className="settings-outer-container">
			<div className="panel-heading">Settings</div>
            <div className="settings-inner-container">
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
                        <Button className="button-jcc" onClick={handleClickedDownloadKMZ}>Download KMZ</Button>
                    </AccordionDetails>
                </Accordion>
            </div>
        </div>
    )
}
