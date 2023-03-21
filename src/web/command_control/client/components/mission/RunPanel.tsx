import React from 'react';
import Button from '@mui/material/Button';
import Icon from '@mdi/react'
import { PortalBotStatus } from '../PortalStatus';
import RunList from './RunList';
import { MissionInterface } from '../CommandControl';
import { mdiArrowLeft } from '@mdi/js';

interface Props {
	bots: {[key: number]: PortalBotStatus},
	mission: MissionInterface,
}


interface State {
}

export default class RunPanel extends React.Component {

  props: Props
	state: State

    constructor(props: Props) {
        super(props)
        this.state = {
        }
    }

    render() { 
    
        let self = this
    
        return (
            <React.Fragment>
                {<RunList
                    bots={self.props.bots} 
                    mission={self.props.mission}
                />}
            </React.Fragment>
        );
    }
  }