import React, { useState } from 'react'

import JaiaToggle from './JaiaToggle'
import { taskData } from './TaskPackets'
import { KMLDocument } from './shared/KMZExport'
import { downloadBlobToFile } from './shared/Utilities'
import { PanelType } from './CommandControl'

import Accordion from '@mui/material/Accordion'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'

import { Icon } from '@mdi/react'
import { mdiSendVariant} from '@mdi/js'
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
    setVisiblePanel: (panelType: PanelType) => void
    trackBot: (id: number | string) => void
    trackingTarget:string | number | null
    visiblePanel: PanelType
    zoomToPod: (firstMove: boolean) => void
}

enum AccordionTabs {
    TaskPackets = 'TASK_PACKETS',
    MapLayers = 'MAP_LAYERS'
}

/**
 * Defines Layout and Functionality of the Settings Panel (Map Settings)
 *
 * @param {Props} Props passed from CommandControl
 * @returns {string} Web content of Settings Panel
 */

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

    const handleTrackPodToggleClick = () => {
        if (props.trackingTarget === 'pod') {
            props.zoomToPod(false);
            props.trackBot(null);
        } else {
            props.zoomToPod(true);
            props.trackBot('pod');
        }
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

    return (
        <div className="settings-outer-container">
            <div className="panel-heading">Map Settings</div>
            <div className="settings-inner-container">
                <div className="settings-card-container">
                    <div className="settings-card">
                        <div className="settings-label" style={{color:'white'}}>Track Pod:</div>
                        <JaiaToggle
                            checked={() => props.trackingTarget === 'pod'}
                            onClick={() => handleTrackPodToggleClick()}
                        />
                    </div>
                </div>
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
                            <JaiaToggle
                                checked={() => props.isClusterModeOn}
                                onClick={() => handleClusterToggleClick()}
                            />
                        </div>
                        <div className="settings-card">
                            <div className="settings-label">Edit Dates:</div>
                            <JaiaToggle
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
                                    <Icon path={mdiSendVariant} title='Get Task Packets' />
                                </div>
                            </div>
                        </div>
                    </AccordionDetails>
                </Accordion>
                <Accordion
                    expanded={isOpenAccordionTab(AccordionTabs.MapLayers)}
                    onChange={() => handleAccordionTabClick(AccordionTabs.MapLayers)}
                    className='accordionContainer'
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls='panel1a-content'
                        id='panel1a-header'
                    >
                        <Typography>Map Layers</Typography>
                    </AccordionSummary>
                    <AccordionDetails className="settings-accordion-inner-container">
                        <div className="map-layers-inner-container" id="mapLayers"></div>
                    </AccordionDetails>
                </Accordion>

            </div>

        </div>
    )
}
