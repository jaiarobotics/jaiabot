import React from 'react';
import Button from '@mui/material/Button';
import Icon from '@mdi/react'
import { PortalBotStatus } from '../PortalStatus';
import ObjectiveItem from './ObjectiveItem';
import { MissionInterface, MissionListInterface } from '../CommandControl';
import { mdiPlus, mdiArrowLeft } from '@mdi/js';

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

export default class RunList extends React.Component {

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
        let self = this;

        return (
            <React.Fragment>
                <div id="runList">
                    <div className="panel" >
						<b>{self.state.mission.name}</b><br />						
					</div>
                    {
                    Object.entries(this.state.mission?.runs).map(([key, value]) => 
                        <React.Fragment key={key}>
                            <ObjectiveItem 
                                bots={self.state.bots} 
                                run={value} 
                                mission={self.state.mission}
                                missionList={self.state.missionList}
                            />
                        </React.Fragment>
                    )
                    }
                </div>
                <Button 
                    className={'button-jcc missionAccordian'}
                    onClick={(event) => {
                        event.stopPropagation();
                        this.state.missionDetailsClicked(this.state.mission.id);
                    }}   
                >
                    <Icon path={mdiArrowLeft} title="Go Back To Team Missions"/>
                </Button>
                <Button 
                    className="button-jcc" 
                    id="add-run" 
                    onClick={() => {
                        let incr = Number(this.props.mission.runIdIncrement) + 1;

                        //Deep copy
                        let teams = this.props.missionList.missions;

                        teams[this.props.mission.id].runs['run-' + String(incr)] = {
                            id: 'run-' + String(incr),
                            name: 'Run ' + String(incr),
                            assigned: -1
                        }

                        teams[this.props.mission.id].runIdIncrement = incr;
                    }}
                >
                    <Icon path={mdiPlus} title="Add Run"/>
                </Button>
            </React.Fragment>
        );
    }
  }