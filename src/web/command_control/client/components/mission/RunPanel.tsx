import React from 'react';
import { PortalBotStatus } from '../shared/PortalStatus';
import RunList from './RunList';
import { MissionInterface, RunInterface } from '../CommandControl';

interface Props {
    bots: {[key: number]: PortalBotStatus},
    mission: MissionInterface,
    loadMissionClick: any,
    saveMissionClick: any,
    deleteAllRunsInMission: any,
    autoAssignBotsToRuns: any,
    toggleEditMode: (evt: React.ChangeEvent, run: RunInterface) => boolean
}


interface State {}

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
                    toggleEditMode={self.props.toggleEditMode}
                />}
            </React.Fragment>
        );
    }
  }