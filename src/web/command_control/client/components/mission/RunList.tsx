import React from 'react';
import Button from '@mui/material/Button';
import Icon from '@mdi/react'
import { PortalBotStatus } from '../PortalStatus';
import RunItem from './RunItem';
import { MissionInterface } from '../CommandControl';
import { mdiPlus, mdiDelete, mdiFolderOpen, mdiContentSave } from '@mdi/js';
import { Missions } from '../Missions'

interface Props {
    bots: {[key: number]: PortalBotStatus}
    mission: MissionInterface
    loadMissionClick: any,
    saveMissionClick: any
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
    }

    render() { 
        let self = this;

        return (
            <React.Fragment>
                <div id="runList">
                    {
                        Object.entries(this.props.mission?.runs).map(([key, value]) => 
                            <React.Fragment key={key}>
                                <RunItem 
                                    bots={self.props.bots} 
                                    run={value} 
                                    mission={self.props.mission}
                                />
                            </React.Fragment>
                        )
                    }
                </div>
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
                    className="button-jcc" 
                    onClick={() => {
                        //Deep copy
                        let mission = this.props.mission;

                        for(let run in mission.runs)
                        {
                            delete mission.runs[run];
                        }

                        for(let botId in mission.botsAssignedToRuns)
                        {
                            delete mission.botsAssignedToRuns[botId]
                        }
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
            </React.Fragment>
        );
    }
  }