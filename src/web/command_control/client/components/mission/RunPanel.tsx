import React from 'react';
import { PortalBotStatus } from '../PortalStatus';
import RunList from './RunList';
import { MissionInterface } from '../CommandControl';

interface Props {
    bots: {[key: number]: PortalBotStatus},
    mission: MissionInterface,
    loadMissionClick: any,
    saveMissionClick: any,
    deleteAllRunsInMission: any,
    autoAssignBotsToRuns: any
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
                    loadMissionClick={self.props.loadMissionClick}
				    saveMissionClick={self.props.saveMissionClick}
                    deleteAllRunsInMission={self.props.deleteAllRunsInMission}
                    autoAssignBotsToRuns={self.props.autoAssignBotsToRuns}
                />}
            </React.Fragment>
        );
    }
  }