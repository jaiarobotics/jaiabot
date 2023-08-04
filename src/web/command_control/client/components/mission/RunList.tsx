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
    setEditRunMode: (botIds: number[], canEdit: boolean) => void,
    setEditModeToggle: (runNumber: number, isOn: boolean) => void
    updateEditModeToggle: (run: RunInterface) => boolean,
    isEditModeToggleDisabled: (run: RunInterface) => boolean,
    toggleEditMode: (run: RunInterface) => boolean
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
                                setEditRunMode={self.props.setEditRunMode}
                                updateEditModeToggle={self.props.updateEditModeToggle}
                                isEditModeToggleDisabled={self.props.isEditModeToggleDisabled}
                                toggleEditMode={self.props.toggleEditMode}
                            />
                        </React.Fragment>
                    )
                }
            </div>
        );
    }
  }