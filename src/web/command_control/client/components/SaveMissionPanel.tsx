/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react'

// Material Design Icons
import Icon from '@mdi/react'
import { mdiDelete, mdiPlay, mdiFolderOpen, mdiContentSave, mdiFolderDownload } from '@mdi/js'
import Button from '@mui/material/Button';
import { downloadToFile } from './shared/Utilities';
import { MissionLibraryLocalStorage } from './MissionLibrary';
import { CommandList } from './Missions';
import { MissionInterface } from './CommandControl';


interface Props {
    missionLibrary: MissionLibraryLocalStorage
    mission: MissionInterface
    onDone: () => void
}


interface State {
    selectedMissionName: string | null
}


export class SaveMissionPanel extends React.Component {

    props: Props
    state: State

    constructor(props: Props) {
        super(props)

        this.state = {
            selectedMissionName: null
        }
    }

    render() {
        let self = this

        // Nem text input
        const nameInput = (<div>
            <input type="text" className="textInput" autoFocus placeholder="Mission Name" defaultValue={this.state.selectedMissionName} onInput={(e) => {
                this.state.selectedMissionName = (e.target as any).value
            }} onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    this.saveClicked()
                }
            }}></input>
        </div>)

        // Mission rows
        let missionNames = this.props.missionLibrary.missionNames()

        let missionNameRows = missionNames.map((name) => {

            var rowClasses = "LoadMissionPanel row hoverable"
            if (name == this.state.selectedMissionName) {
                rowClasses += ' selected'
            }

            let row = (<div key={name} className={rowClasses} onClick={self.didClick.bind(self, name)}>
                {name}
            </div>)

            return row
        })

        // Buttons
        let buttonRow = (<div className="LoadMissionPanel HorizontalFlexbox">
            <Button className="button-jcc" onClick={this.deleteClicked.bind(this)}>
                <Icon path={mdiDelete}></Icon>
            </Button>
            <Button className="button-jcc" onClick={this.downloadClicked.bind(this)}>
                <Icon path={mdiFolderDownload}></Icon>
            </Button>
            <div className='flexSpacer'></div>
            <Button className="button-jcc" onClick={this.cancelClicked.bind(this)}>Cancel</Button>
            <Button className="button-jcc" onClick={this.saveClicked.bind(this)}>Save</Button>
        </div>)

        return (<div className="LoadMissionPanel centered rounded shadowed">
            <div className="LoadMissionPanel title">Save Mission As</div>
            {nameInput}
            <div className="LoadMissionPanel missionList">
                {missionNameRows}
            </div>
            {buttonRow}
        </div>)
    }

    didClick(name: string) {
        this.setState({selectedMissionName: name})
    }

    saveClicked() {
        // Check to see if we have selected a mission
        if (Object.keys(this.props.mission.runs).length === 0) {
            alert("Please create a mission to save")
            return
        }

        let name = this.state.selectedMissionName
        if (name == null) {
            alert("Please name this mission")
            return
        }

        if (this.props.missionLibrary.hasMission(name)) {
            if (!confirm('Do you really want to replace mission named \"' + name + '\"?')) {
                return
            }
        }

        this.props.missionLibrary.saveMission(name, this.props.mission)

        this.props.onDone?.()
    }

    deleteClicked() {
        let name = this.state.selectedMissionName

        if (name == null) {
            return
        }
        
        if (confirm("Are you sure you want to delete the mission named \"" + name + "\"?")) {
            this.props.missionLibrary.deleteMission(name)
            this.state.selectedMissionName = null;
            this.forceUpdate()
        }
    }

    cancelClicked() {
        this.props.onDone?.()
    }

    downloadClicked() {
        downloadToFile(JSON.stringify(this.props.mission), 'application/json', 'mission.json')
    }

}
