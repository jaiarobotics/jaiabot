/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react'

// Material Design Icons
import Icon from '@mdi/react'
import { mdiDelete, mdiPlay, mdiFolderOpen, mdiContentSave } from '@mdi/js'

export class SaveMissionPanel extends React.Component {

    constructor(props) {
        super(props)

        this.state = {
            selectedMissionName: null
        }
    }

    render() {
        let self = this

        // Nem text input
        this.nameInput = (<div>
            <input type="text" className="textInput" autoFocus placeholder="Mission Name" defaultValue={this.state.selectedMissionName} onInput={(e) => {
                this.state.selectedMissionName = e.target.value
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

            let row = (<div className={rowClasses} onClick={self.didClick.bind(self, name)}>
                {name}
            </div>)

            return row
        })

        // Buttons
        let buttonRow = (<div className="LoadMissionPanel HorizontalFlexbox">
            <button onClick={this.deleteClicked.bind(this)}>
                <Icon path={mdiDelete}></Icon>
            </button>
            <div className='flexSpacer'></div>
            <button onClick={this.cancelClicked.bind(this)}>Cancel</button>
            <button onClick={this.saveClicked.bind(this)}>Save</button>
        </div>)

        return (<div className="LoadMissionPanel centered rounded shadowed">
            <div className="LoadMissionPanel title">Save Mission As</div>
            {this.nameInput}
            <div className="LoadMissionPanel missionList">
                {missionNameRows}
            </div>
            {buttonRow}
        </div>)
    }

    didClick(name) {
        this.setState({selectedMissionName: name})
    }

    saveClicked() {
        let name = this.state.selectedMissionName
        if (name == null) {
            return
        }

        if (this.props.missionLibrary.hasMission(name)) {
            if (!confirm('Do you really want to replace mission named \"' + name + '\"?')) {
                return
            }
        }

        this.props.missionLibrary.saveMission(name, this.props.missions)

        this.props.onDone?.()
    }

    deleteClicked() {
        let name = this.state.selectedMissionName

        if (name == null) {
            return
        }
        
        if (confirm("Are you sure you want to delete the mission named \"" + name + "\"?")) {
            this.props.missionLibrary.deleteMission(name)
            this.forceUpdate()
        }
    }

    cancelClicked() {
        this.props.onDone?.()
    }

}
