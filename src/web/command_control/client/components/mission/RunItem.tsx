import React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Button from '@mui/material/Button';
import Icon from '@mdi/react'
import EditModeToggle from '../EditModeToggle';
import { mdiDelete, mdiContentDuplicate } from '@mdi/js'
import { PortalBotStatus } from '../shared/PortalStatus';
import { RunInterface, MissionInterface } from '../CommandControl';
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { Missions } from '../Missions';
import { Slider } from '@mui/material';
import { deepcopy } from '../shared/Utilities';
import { jaiaAPI } from '../../../common/JaiaAPI';

interface Props {
    bots: {[key: number]: PortalBotStatus}
    run: RunInterface
    mission: MissionInterface,
    setEditRunMode: (botIds: number[], canEdit: boolean) => void
    updateEditModeToggle: (run: RunInterface) => boolean,
    isEditModeToggleDisabled: (run: RunInterface) => boolean,
    toggleEditMode: (run: RunInterface) => boolean
}

interface State {
    isChecked: boolean
}

export default class RunItem extends React.Component {
    props: Props
    state: State
    botId: number | null
    botsNotAssigned: number[]
    enabledMissionStates = ['PRE_DEPLOYMENT', 'RECOVERY', 'STOPPED', 'POST_DEPLOYMENT']
    api = jaiaAPI

    constructor(props: Props) {
        super(props)
        this.state = {
          isChecked: this.props.run.canEdit
        }
    }
    
    handleBotSelectionChange(event: SelectChangeEvent) {
        let value = Number(event.target.value)

        if (isFinite(value)) {
            // Delete bot assignment if changed from previous
            if (value != this.props.run.assigned) {
                delete this.props.mission.botsAssignedToRuns[this.props.run.assigned]
            }
            // Change run assignment for run to bot 
            this.props.run.assigned = value
            this.props.run.command.bot_id = value
            this.props.mission.botsAssignedToRuns[this.props.run.assigned] = this.props.run.id
        }
    }

    render() {
        let runAssignSelect = null
        let runDeleteButton = null
        let duplicateRunButton = null
        let editModeButton = null
        let title = this.props.run.name
        let podStatusBotIds = Object.keys(this.props.bots)
        let botsAssignedToRunsIds = Object.keys(this.props.mission.botsAssignedToRuns)
        let assignedLabel = ""
        let assignedOption = null
        this.botsNotAssigned = []

        // Find the difference between the current botIds available
        // And the bots that are already assigned to get the ones that
        // Have not been assigned yet
        podStatusBotIds.forEach((key) => {
            if (!botsAssignedToRunsIds.includes(key)) {
                let id = Number(key)
                if(isFinite(id)) {
                    this.botsNotAssigned.push(id)
                }
            }
        });

        // Check to see if that run is assigned
        // And if the bot id is not included in the botsNotAssigned array
        if (this.props.run.assigned != -1 && !this.botsNotAssigned.includes(this.props.run.assigned)) {
            assignedLabel = "Bot-" + this.props.run.assigned
            assignedOption = (
                <MenuItem 
                    key={this.props.run.assigned} 
                    value={this.props.run.assigned}
                >
                    {assignedLabel}
                </MenuItem>
            )
        }

        // Create the Select Object
        runAssignSelect = (
            <Box sx={{ minWidth: 120 }}>
                <FormControl fullWidth>
                <InputLabel id="bot-assigned-select-label">Id</InputLabel>
                    <Select
                        labelId="bot-assigned-select-label"
                        id="bot-assigned-select"
                        value={this.props.run.assigned.toString()}
                        label="Assign"
                        disabled={this.props.isEditModeToggleDisabled(this.props.run) && this.props.run.assigned !== -1}
                        onChange={(evt: SelectChangeEvent) => this.handleBotSelectionChange(evt)}
                    >
                        <MenuItem 
                            key={-1} 
                            value={-1}
                        >
                            Unassigned
                        </MenuItem>

                        {
                            assignedOption ? 
                                <MenuItem 
                                    key={this.props.run.assigned} 
                                    value={this.props.run.assigned}
                                >
                                    {assignedLabel}
                                </MenuItem> : ""
                        }
                       
                        {
                            this.botsNotAssigned ? Object.keys(this.botsNotAssigned).map((id) => (
                                <MenuItem 
                                    key={this.botsNotAssigned[Number(id)]} 
                                    value={this.botsNotAssigned[Number(id)]}>
                                    Bot-{this.botsNotAssigned[Number(id)]}
                                </MenuItem>
                            )) : ""
                        }
                    </Select>
                </FormControl>
            </Box>
        )

        // Create Copy of Run Button
        duplicateRunButton = (
            <Button 
                className={'button-jcc missionAccordian'}
                onClick={(event) => {
                    event.stopPropagation();
                    const goals = deepcopy(this.props.run.command.plan.goal)
                    Missions.addRunWithGoals(-1, goals, this.props.mission);
                }}
            >
                <Icon path={mdiContentDuplicate} title="Duplicate Run"/>
            </Button>
        )

        // Create Delete Button
        runDeleteButton = (
            <Button 
                className={`button-jcc missionAccordian ${(this.props.isEditModeToggleDisabled(this.props.run) && this.props.run.assigned !== -1) ?  'inactive' : ''}`}
                disabled={this.props.isEditModeToggleDisabled(this.props.run) && this.props.run.assigned !== -1}
                onClick={(event) => {
                    event.stopPropagation()
                    const warningString = "Are you sure you want to delete " + this.props.run.name + "?"
		            if (confirm(warningString)) {
                        //Deep copy
                        const mission = this.props.mission
                        delete mission?.runs[this.props.run.id]
                        delete mission?.botsAssignedToRuns[this.props.run.assigned]
                    }
                }}
            >
                <Icon path={mdiDelete} title="Delete Run"/>
            </Button>
        )

        // Create Edit Mode Toggle
        editModeButton = (
            <EditModeToggle 
                checked={this.props.updateEditModeToggle} 
                disabled={this.props.isEditModeToggleDisabled} 
                onClick={this.props.toggleEditMode}
                run={this.props.run}
                label="Edit"
                title="ToggleEditMode"
            />
        )

        let plan = this.props.run.command.plan
        let repeats = plan?.repeats ?? 1
        let repeatsInput =
            <div>
                Repeats: {repeats}
                <Slider
                    id="runRepeats"
                    aria-label="Repeats"
                    value={repeats}
                    valueLabelDisplay="auto"
                    step={1}
                    marks
                    min={1}
                    max={10}
                    onChange={(evt: Event, value: number, activeThumb: number) => {
                        if (plan != null) {
                            plan.repeats = value
                            this.forceUpdate() // Force update, because I don't want to add repeats to the State. I want a single source of truth.
                        }
                    }}
                />
            </div>

        return (
            <Accordion className="run-accordian">
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1a-content"
                    id="panel1a-header"
                >
                    <Typography className="title">
                        {title}
                    </Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <span className="runItemInfo">
                        {runAssignSelect}
                        {duplicateRunButton}
                        {runDeleteButton}
                        {editModeButton}
                    </span>
                    <div>
                        {repeatsInput}
                    </div>
                </AccordionDetails>
            </Accordion>
        )
    }
}