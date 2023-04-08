import React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Button from '@mui/material/Button';
import Icon from '@mdi/react'
import { mdiDelete, mdiContentDuplicate } from '@mdi/js'
import { PortalBotStatus } from '../PortalStatus';
import { RunInterface, MissionInterface } from '../CommandControl';
import Switch from '@mui/material/Switch';
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { Missions } from '../Missions'

interface Props {
    bots: {[key: number]: PortalBotStatus}
    run: RunInterface
    mission: MissionInterface,
}


interface State {
    editing: boolean,
}

export default class RunItem extends React.Component {

    props: Props
    state: State
    botId: number | null
    botsNotAssigned: number[]

    constructor(props: Props) {
        super(props)

        this.state = {
          editing: false,
        }
    }

    render() {

        let self = this;
        let runDeleteButton = null;
        let runAssignSelect = null;
        let duplicateRunButton = null;
        let title = this.props.run.name;
        let podStatusBotIds = Object.keys(self.props.bots);
        let botsAssignedToRunsIds = Object.keys(self.props.mission.botsAssignedToRuns);
        self.botsNotAssigned = [];
        let assignedLabel = "";
        let assignedOption = null;

        // Find the difference between the current botIds available
        // And the bots that are already assigned to get the ones that
        // Have not been assigned yet
        podStatusBotIds.forEach((key) => {
            if (!botsAssignedToRunsIds.includes(key)) {
                let id = Number(key);
                if(isFinite(id))
                {
                    self.botsNotAssigned.push(id);
                }
            }
        });

        // Check to see if that run is assigned
        // And the bot id is not included in the botsNotAssigned array
        if(self.props.run.assigned != -1
            && !self.botsNotAssigned.includes(self.props.run.assigned))
        {
            assignedLabel = "Bot-" + self.props.run.assigned
            assignedOption = 
                <MenuItem 
                    key={self.props.run.assigned} 
                    value={self.props.run.assigned}
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
                        onChange={self.assignChange}
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
                                    key={self.props.run.assigned} 
                                    value={self.props.run.assigned}
                                >
                                    {assignedLabel}
                                </MenuItem> : ""
                        }
                       
                        {
                            self.botsNotAssigned ? Object.keys(self.botsNotAssigned).map((id) => (
                                <MenuItem 
                                    key={self.botsNotAssigned[Number(id)]} 
                                    value={self.botsNotAssigned[Number(id)]}>
                                    Bot-{self.botsNotAssigned[Number(id)]}
                                </MenuItem>
                            )) : ""
                        }
                    </Select>
                </FormControl>
            </Box>
  
        // Create Delete Button
        runDeleteButton = 
            <Button 
                className={'button-jcc missionAccordian'}
                onClick={(event) => {
                    event.stopPropagation();

                    const warning_string = "Are you sure you want to delete " + this.props.run.name + "?";

		            if (confirm(warning_string)) {

                        //Deep copy
                        let mission = this.props.mission;

                        delete mission?.runs[this.props.run.id];

                        delete mission?.botsAssignedToRuns[this.props.run.assigned]
                    }
                }}
            >
                <Icon path={mdiDelete} title="Delete Run"/>
            </Button>

        // Create Copy of Run Button
        duplicateRunButton =
            <Button 
                className={'button-jcc missionAccordian'}
                onClick={(event) => {
                    event.stopPropagation();
                    Missions.addRunWithGoals(-1, this.props.run.command.plan.goal, this.props.mission);
                }}
            >
                <Icon path={mdiContentDuplicate} title="Duplicate Run"/>
            </Button>    

        // Create Edit Toggle
        let edit =
            <Switch
                checked={self.state.editing}
                onChange={self.editUpdate.bind(self)}
                inputProps={{ 'aria-label': 'controlled' }}
            />
  
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
                        {edit}
                        {runDeleteButton}
                    </span>
                </AccordionDetails>
            </Accordion>
        );
    }

    editUpdate = (event: React.ChangeEvent<HTMLInputElement>) => {
        this.props.run.editing = event.target.checked;
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