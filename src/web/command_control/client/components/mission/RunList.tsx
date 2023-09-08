import React from 'react';
import { PortalBotStatus } from '../shared/PortalStatus';
import RunItem from './RunItem';
import { MissionInterface, RunInterface } from '../CommandControl';

interface Props {
    bots: {[key: number]: PortalBotStatus}
    mission: MissionInterface
    loadMissionClick: any,
    saveMissionClick: any,
    deleteAllRunsInMission: any,
    autoAssignBotsToRuns: any
    toggleEditMode: (evt: React.ChangeEvent, run: RunInterface) => boolean
    unSelectHubOrBot: () => void
}

interface State {
}

export default class RunList extends React.Component {

  props: Props
	state: State

    constructor(props: Props) {
        super(props)

        this.state = {
        }

        this.props = props
    }

    render() { 
        let self = this;
        const emptyMission = Object.keys(this.props.mission.runs).length == 0
        
        return (
            <div id="runList">
                {
                    Object.entries(this.props?.mission?.runs).map(([key, value]) => 
                        <React.Fragment key={key}>
                            <RunItem 
                                bots={self.props.bots} 
                                run={value} 
                                mission={self.props.mission}
                                toggleEditMode={self.props.toggleEditMode}
                                unSelectHubOrBot={self.props.unSelectHubOrBot}
                            />
                        </React.Fragment>
                    )
                }
            </div>
        );
    }
  }