import React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { mdiDotsVertical } from '@mdi/js';
import Button from '@mui/material/Button';
import Icon from '@mdi/react'
import { mdiDelete } from '@mdi/js'
import { PortalBotStatus } from '../PortalStatus';
import { MissionInterface, MissionListInterface } from '../CommandControl';

interface Props {
    bots: {[key: number]: PortalBotStatus}
    mission: MissionInterface
    missionList: MissionListInterface
    missionDetailsClicked: any
}


interface State {
    bots: {[key: number]: PortalBotStatus},
    mission: MissionInterface,
    missionList: MissionListInterface,
    missionDetailsClicked: any
}

export default class MissionItem extends React.Component {

    props: Props
    state: State

    constructor(props: Props) {
        super(props)

        this.state = {
            bots: props.bots,
            mission: props.mission,
            missionList: props.missionList,
            missionDetailsClicked: props.missionDetailsClicked
        }
    }

    render() {
        let RunPanelButton = null;
        let RunDeleteButton = null;
        let title = this.props.mission.name;
  
        RunPanelButton = 
            <Button 
                className={'button-jcc missionAccordian'}
                onClick={(event) => {
                    event.stopPropagation();
                    this.state.missionDetailsClicked(this.state.mission.id);
                }}   
            >
                <Icon path={mdiDotsVertical} title="Get More Details"/>
            </Button>
        RunDeleteButton = 
            <Button 
                className={'button-jcc missionAccordian'}
                onClick={(event) => {
                    event.stopPropagation();

                    //Deep copy
                    let missionList = this.props.missionList;

                    delete missionList?.missions[this.props.mission.id];
                }}
            >
                <Icon path={mdiDelete} title="Delete Mission"/>
            </Button>
              
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
                        {RunPanelButton}
                        {RunDeleteButton}
                    </Typography>
                </AccordionDetails>
            </Accordion>
        );
    }
}