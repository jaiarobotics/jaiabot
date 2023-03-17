import React from 'react'
import Button from '@mui/material/Button';
import {JaiaAPI} from '../../../common/JaiaAPI'
import { PortalBotStatus } from '../PortalStatus';
import { MissionListInterface } from '../CommandControl';
import TeamMissionItem from './TeamMissionItem';
import { mdiPlus } from '@mdi/js';
import Icon from '@mdi/react'

interface Props {
	bots: {[key: number]: PortalBotStatus}
	missionList: MissionListInterface
    missionDetailsClicked: any
}

interface State {
	bots: {[key: number]: PortalBotStatus},
	missionList: MissionListInterface,
    missionDetailsClicked: any
}

export default class MissionList extends React.Component {
	api: JaiaAPI

	props: Props
	state: State

    constructor(props: Props) {
        super(props)

        this.state = {
            bots: props.bots,
			missionList: props.missionList,
            missionDetailsClicked: props.missionDetailsClicked
        }
    }

    static getDerivedStateFromProps(props: Props) {
        return {
            bots: props.bots
        }
    }

    render() {
		let self = this

		return (
			<React.Fragment>
                <div id="missionList">
                {
                    Object.entries(this.state.missionList?.missions).map(([key, value]) => 
                        <React.Fragment key={key}>
                            <TeamMissionItem 
                                bots={self.state.bots} 
                                teamMission={value} 
                                teamMissionList={self.state.missionList}
                                teamMissionDetailsClicked={self.state.missionDetailsClicked}
                            />
                        </React.Fragment>
                    )
                }
                </div>
                <Button 
                    className="button-jcc" 
                    id="add-mission" 
                    onClick={() => {
                        let incr = Number(this.props.missionList.missionIdIncrement) + 1;
                        //Deep copy
                        let missions = this.props.missionList.missions;

                        missions['mission-' + String(incr)] = {
                            id: 'mission-' + String(incr),
                            name: 'Mission ' + String(incr),
                            runs: {
                                'run-1': {
                                    id: 'run-1',
                                    name: 'Run 1',
                                    assigned: -1
                                },
                            },
                            editing: false,
                            runIdIncrement: 1
                        }

                        this.props.missionList.missionIdIncrement = incr;
                    }}
                >
                    <Icon path={mdiPlus} title="Add Mission"/>
                </Button>
            </React.Fragment>
		)

    }
}
