import React from 'react';
import Button from '@mui/material/Button';
import Icon from '@mdi/react'
import { PortalBotStatus } from '../shared/PortalStatus';
import RunItem from './RunItem';
import { MissionInterface, RunInterface } from '../CommandControl';
import { mdiPlus, mdiDelete, mdiFolderOpen, mdiContentSave, mdiAutoFix } from '@mdi/js';
import { Missions } from '../Missions'

interface Props {
    bots: {[key: number]: PortalBotStatus}
    mission: MissionInterface
    loadMissionClick: any,
    saveMissionClick: any,
    deleteAllRunsInMission: any,
    autoAssignBotsToRuns: any
    setEditRunMode: (botIds: number[], canEdit: boolean) => void
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
            <div className="mission-panel-content-container">
                <div className="mission-panel-commands-container">
                    <Button 
                        className="button-jcc" 
                        id="add-run" 
                        onClick={() => {
                            Missions.addRunWithWaypoints(-1, [], this.props.mission);
                        }}
                    >
                        <Icon path={mdiPlus} title="Add Run"/>
                    </Button>
                    <Button 
                        className={"button-jcc" + (emptyMission ? ' inactive' : '')}
                        onClick={() => {
                            if (emptyMission) return
                            this.props.deleteAllRunsInMission(this.props.mission, true) 
                        }}
                    >
                        <Icon path={mdiDelete} title="Clear Mission"/>
                    </Button>
                    <Button 
                        className="button-jcc" 
                        onClick={() => { this.props.loadMissionClick() }}
                    >
                        <Icon path={mdiFolderOpen} title="Load Mission"/>
                    </Button>
                    <Button 
                        className="button-jcc" 
                        onClick={() => { this.props.saveMissionClick() }}
                    >
                        <Icon path={mdiContentSave} title="Save Mission"/>
                    </Button>
                    <Button 
                        className="button-jcc" 
                        onClick={() => { this.props.autoAssignBotsToRuns() }}
                    >
                        <Icon path={mdiAutoFix} title="Auto Assign Bots"/>
                    </Button>
                </div>
                <div id="runList">
                    {
                        Object.entries(this.props?.mission?.runs).map(([key, value]) => 
                            <React.Fragment key={key}>
                                <RunItem 
                                    bots={self.props.bots} 
                                    run={value} 
                                    mission={self.props.mission}
                                    setEditRunMode={self.props.setEditRunMode}
                                />
                            </React.Fragment>
                        )
                    }
                </div>
            </div>
        );
    }
  }