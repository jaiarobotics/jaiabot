import React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Button from '@mui/material/Button';
import Icon from '@mdi/react'
import { mdiDelete, mdiContentDuplicate } from '@mdi/js'
import { PortalBotStatus } from '../shared/PortalStatus';
import { RunInterface, MissionInterface } from '../CommandControl';
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { Missions } from '../Missions';
import Switch from '@mui/material/Switch';
import { Slider, FormGroup, FormControlLabel } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { amber } from '@mui/material/colors';
import { deepcopy } from '../Utilities';
import { jaiaAPI } from '../../../common/JaiaAPI';
import { CommandType } from '../shared/JAIAProtobuf';
import { error, info } from '../../libs/notifications';

interface Props {
    bots: {[key: number]: PortalBotStatus}
    run: RunInterface
    mission: MissionInterface,
    setEditRunMode: (botIds: number[], canEdit: boolean) => void
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
          isChecked: true
        }
    }

    toggleEditMode() {
        const botId = this.props.run.assigned
        const isChecked = !this.state.isChecked
        this.props.setEditRunMode([botId], isChecked)
        this.setState({ isChecked: isChecked })
    }

    updateEditModeToggle() {
        if (!this.props.run.canEdit) {
            return false
        } else if (this.state.isChecked) {
            return true
        }
        return false
    }

    isEditModeToggleDisabled() {
        for (const bot of Object.values(this.props.bots)) {
            const botId = this.props.run.assigned
            if (botId === bot.bot_id) {
                const missionState = bot.mission_state
                for (const enabledMissionState of this.enabledMissionStates) {
                    if (missionState.includes(enabledMissionState)) {
                        return false
                    }
                }
            }
        }
        if (this.state.isChecked) {
            this.setState({isChecked: false})
        }
        return true
    }

    handleMissionStateChange() {
        for (const bot of Object.values(this.props.bots)) {
            const botId = this.props.run.assigned
            if (botId === bot.bot_id) {
                const missionState = bot.mission_state
                for (const enabledMissionState of this.enabledMissionStates) {
                    if (missionState.includes(enabledMissionState) && this.state.isChecked) {
                        this.props.setEditRunMode([botId], true)
                        return
                    }
                }
                this.props.setEditRunMode([botId], false)
            }
        }
    }

    render() {
        let runAssignSelect = null;
        let runDeleteButton = null;
        let duplicateRunButton = null;
        let editModeButton = null;
        let title = this.props.run.name;
        let podStatusBotIds = Object.keys(this.props.bots);
        let botsAssignedToRunsIds = Object.keys(this.props.mission.botsAssignedToRuns);
        this.botsNotAssigned = [];
        let assignedLabel = "";
        let assignedOption = null;

        this.handleMissionStateChange()
        
        // Find the difference between the current botIds available
        // And the bots that are already assigned to get the ones that
        // Have not been assigned yet
        podStatusBotIds.forEach((key) => {
            if (!botsAssignedToRunsIds.includes(key)) {
                let id = Number(key);
                if(isFinite(id))
                {
                    this.botsNotAssigned.push(id);
                }
            }
        });

        // Check to see if that run is assigned
        // And the bot id is not included in the botsNotAssigned array
        if(this.props.run.assigned != -1
            && !this.botsNotAssigned.includes(this.props.run.assigned))
        {
            assignedLabel = "Bot-" + this.props.run.assigned
            assignedOption = 
                <MenuItem 
                    key={this.props.run.assigned} 
                    value={this.props.run.assigned}
                >
                    {assignedLabel}
                </MenuItem>
        }

        // Create the Select Object
        runAssignSelect =
            <Box sx={{ minWidth: 120 }}>
                <FormControl fullWidth>
                <InputLabel id="bot-assigned-select-label">Id</InputLabel>
                    <Select
                        labelId="bot-assigned-select-label"
                        id="bot-assigned-select"
                        value={this.props.run.assigned.toString()}
                        label="Assign"
                        onChange={this.assignChange}
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
                className={`button-jcc missionAccordian ${this.isEditModeToggleDisabled() ? 'inactive' : ''}`}
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
        // MUI Styling: mui.com/material-ui/react-switch
        const AmberSwitch = styled(Switch)(({ theme }) => ({
            '& .MuiSwitch-switchBase.Mui-checked': {
              color: amber[600],
              '&:hover': {
                backgroundColor: alpha(amber[600], theme.palette.action.hoverOpacity),
              },
            },
            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
              backgroundColor: amber[600],
            },
            '& .MuiSwitch-switchBase.Mui-checked.Mui-disabled': {
                color: amber[300],
            }        
        }));

        editModeButton = (
            <FormGroup>
                <FormControlLabel 
                    control={
                        <AmberSwitch 
                            checked={this.updateEditModeToggle()} 
                            disabled={this.isEditModeToggleDisabled()} 
                            onClick={() => this.toggleEditMode()}
                        />
                    }
                    label="Edit" 
                    title='Toggle Edit Mode'
                />
            </FormGroup>
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
                            this.forceUpdate() // Force update, because I don't want to add repeats to the State.  I want a single source of truth.
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
        );
    }

    assignChange = (event: SelectChangeEvent) => {
        let value = Number(event.target.value);

        if(isFinite(value))
        {
            // Delete bot assignment if changed from previous
            if(value != this.props.run.assigned)
            {
                delete this.props.mission.botsAssignedToRuns[this.props.run.assigned];
            }

            // Change run assignment for run to bot 
            this.props.run.assigned = value;
            this.props.run.command.bot_id = value;
            this.props.mission.botsAssignedToRuns[this.props.run.assigned] = this.props.run.id;
        }
    };
}