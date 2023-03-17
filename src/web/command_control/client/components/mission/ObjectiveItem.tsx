import React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Button from '@mui/material/Button';
import Icon from '@mdi/react'
import { mdiDelete } from '@mdi/js'
import { PortalBotStatus } from '../PortalStatus';
import { ObjectiveInterface, TeamMissionListInterface, TeamMissionInterface } from '../CommandControl';
import Switch from '@mui/material/Switch';
import FormLabel from '@mui/material/FormLabel';
import FormControl from '@mui/material/FormControl';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';

interface Props {
	bots: {[key: number]: PortalBotStatus}
	objective: ObjectiveInterface
    teamMission: TeamMissionInterface,
    teamMissionList: TeamMissionListInterface
}


interface State {
	bots: {[key: number]: PortalBotStatus},
    objective: ObjectiveInterface,
    teamMission: TeamMissionInterface,
    teamMissionList: TeamMissionListInterface,
    editing: boolean
}

export default class ObjectiveItem extends React.Component {

    props: Props
    state: State
    botId: number | null

    constructor(props: Props) {
        super(props)

        this.state = {
          bots: props.bots,
          objective: props.objective,
          teamMission: props.teamMission,
          teamMissionList: props.teamMissionList,
          editing: false
        }
    }

    render() {

        let self = this;
        let objectiveDeleteButton = null;
        let title = this.props.objective.title;

        // If we haven't selected a bot yet, and there are bots available, then select the lowest indexed bot
        if (self.botId == null) {
          self.botId = Number(Object.keys(self.state.bots)[0])
        }
  
        objectiveDeleteButton = 
            <Button 
                className={'button-jcc missionAccordian'}
                onClick={(event) => {
                  event.stopPropagation();

                  //Deep copy
                  let teams = this.props.teamMissionList.teams;

                  delete teams[this.props.teamMission.id].objectives[this.props.objective.id];
                }}
            >
                <Icon path={mdiDelete} title="Delete Objective"/>
            </Button>

        //console.log(self.state);
                
        /*let botSelector = 
            <div>
                <label style={{fontSize: "32px", marginRight: "25px", color: "#0bc9cd"}}>Bot</label>
                <select style={{width: "50px", marginBottom: "10px", color: "#0bc9cd"}} name="bot" id="pid_gains_bot_selector" defaultValue={self.botId} onChange={self.didSelectBot.bind(self)}>
                    {
                        self.state.bots ? Object.keys(self.state.bots).map((botId) => (
                            <option key={botId} value={botId}>{botId}</option>
                        )) : ""
                    }
                </select>
            </div>*/

        let edit =
            <Switch
                checked={self.state.editing}
                onChange={self.editUpdate.bind(self)}
                inputProps={{ 'aria-label': 'controlled' }}
            />
  
        return (
            <Accordion className="mission-accordian">
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
                    <Typography>
                        {edit}
                        {/*botSelector*/}
                        {objectiveDeleteButton}
                    </Typography>
                </AccordionDetails>
            </Accordion>
        );
    }

    didSelectBot(evt: Event) {
        this.botId = (evt.target as any).value
        this.forceUpdate()
    }

    editUpdate = (event: React.ChangeEvent<HTMLInputElement>) => {
        this.state.editing = event.target.checked;
    }
}