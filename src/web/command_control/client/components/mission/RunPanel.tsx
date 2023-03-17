import React from 'react';
import Button from '@mui/material/Button';
import Icon from '@mdi/react'
import { PortalBotStatus } from '../PortalStatus';
import ObjectiveList from './ObjectiveList';
import { MissionInterface, MissionListInterface } from '../CommandControl';
import { mdiArrowLeft } from '@mdi/js';

interface Props {
	bots: {[key: number]: PortalBotStatus}
	missionteamMissionteamMission: MissionInterface
    missionList: MissionListInterface
    missionDetailsClicked: any
}


interface State {
    bots: {[key: number]: PortalBotStatus},
    mission: MissionInterface,
    missionList: MissionListInterface,
    missionDetailsClicked: any
}

export default class ObjectivePanel extends React.Component {

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
    
        let self = this
    
        return (
            <React.Fragment>
                <ObjectiveList
                    bots={self.state.bots} 
                    mission={self.state.mission}
                    missionList={self.state.missionList}
                    missionDetailsClicked={self.state.missionDetailsClicked}
                />
            </React.Fragment>
        );
    }
  }