import React from 'react'
import Icon from '@mdi/react'
import { mdiClose } from '@mdi/js'

import { PanelType } from './CommandControl'
import '../style/components/ContactInfoPanel.css'
import { ContactStatus } from './shared/JAIAProtobuf'
import { Missions } from './Missions'
import { JaiaAPI } from '../../common/JaiaAPI'
import { GlobalSettings } from './Settings'
import { error } from '../libs/notifications'
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { CustomAlert } from './shared/CustomAlert';

interface Props {
    setVisiblePanel: (panelType: PanelType) => void,
    contact: ContactStatus,
    botIds: number[]
    api: JaiaAPI
}

let botAssigned = -1 as number

export default function ContactInfoPanel(props: Props) {
    

    /**
     * Sends a trail command
     * 
     * @returns {void}
     */
    const handleTrailClick = () => {
        let datumLocation = props.contact.location 
        let speed = GlobalSettings.missionPlanSpeeds

        if (!datumLocation) {
            datumLocation = {lat: 0, lon: 0}
        }
        
        const botMission = Missions.TrailMode(botAssigned, props.contact?.contact, datumLocation, speed)

        CustomAlert.confirm(`Are you sure you'd like bot: ` + botAssigned?.toString() 
            + ` to trail contact: ` + props.contact?.contact?.toString(), 
            `Trail Contact ` + props.contact?.contact?.toString(), () => {

            props.api.postCommand(botMission).then(response => {
                if (response.message) {
                    error(response.message)
                }
            })
        })
    }

    /**
     * Handles updating the assigned bot
     * 
     * @param event {SelectChangeEvent} The event is used to get the assigned bot
     * @returns {void}
     */
    const handleBotSelectionChange = (event: SelectChangeEvent) => {
        const newBotId = Number(event.target.value)
        botAssigned = newBotId
    }

    return (
        <div className="contact-info-panel-base-grid">
            <div className="contact-info-layout-container">
                <div className='contact-info-close-btn' onClick={() => {
                    props.setVisiblePanel(PanelType.NONE)
                }}>
                    <Icon path={mdiClose} size={1} />
                </div>
                <div className="contact-info-outer-container">
                    <div className="contact-info-title">Contact Information</div>
                    <div className="contact-info-panel-container">
                        <div className="contact-info-label">contact:</div>
                        <div className="contact-info-input">{props.contact?.contact}</div>
                        <div className="contact-info-line-break"></div>
                        <div className="contact-info-label">Select Bot To Trail Contact:</div>
                        <Box sx={{ minWidth: 120 }}>
                            <FormControl fullWidth>
                            <InputLabel id="bot-assigned-select-label">Id</InputLabel>
                                <Select
                                    labelId="bot-assigned-select-label"
                                    id="bot-assigned-select"
                                    value={botAssigned?.toString()}
                                    label="Assign"
                                    onChange={(evt: SelectChangeEvent) => handleBotSelectionChange(evt)}
                                >
                                    {
                                        props.botIds.map((id) => {
                                            return <MenuItem key={id} value={id}>{`Bot-${id}`}</MenuItem>
                                        })
                                    }
                                </Select>
                            </FormControl>
                        </Box>
                        <div className="contact-info-line-break"></div>
                        <button className="contact-info-btn" onClick={() => handleTrailClick()}>Trail Contact</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
