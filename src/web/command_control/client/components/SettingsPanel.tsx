import React, { useState } from 'react'

import WptToggle from './WptToggle'
import { taskData } from './TaskPackets'

import Accordion from '@mui/material/Accordion'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'

import { Icon } from '@mdi/react'
import { mdiSendVariant } from '@mdi/js'
import { Button } from '@mui/material'
import '../style/components/SettingsPanel.css'
import { downloadToFile } from './shared/Utilities'
import { getCSV, getCSVFilename } from './shared/CSVExport'

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
    
    
    /**
     * Event handler for the CSV dowload button.  Creates the CSV file and initiates
     * the download.
     *
     * @async
    **/
    const handleDownloadCSV = async (event: React.MouseEvent<HTMLButtonElement>) => {
        const csvFilename = getCSVFilename(taskData.taskPackets)
        downloadToFile(await getCSV(taskData.taskPackets), 'text/csv', csvFilename)
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
                        <Button onClick={handleDownloadCSV} className='button-jcc'>Download CSV</Button>
                    </AccordionDetails>
                </Accordion>
            </div>
        </div>
    )
}
