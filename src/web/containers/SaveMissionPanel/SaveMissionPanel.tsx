// React
import React from "react";
import { useContext, useState } from "react";

import { JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import { missionSet } from "../../data/mission_set/mission-set";
import { listSavedMissionSets } from "../../utils/local-storage";

import Icon from "@mdi/react";
import Button from "@mui/material/Button";
import { mdiDelete, mdiFolderDownload } from "@mdi/js";
import "./SaveMissionPanel.less";

/**
 * Renders a panel for operators to save missions
 */
export default function SaveMissionPanel() {
    const [saveName, setSaveName] = useState<string>("");

    const handleSaveClick = () => {
        if (saveName == undefined) setSaveName("DefaultMissionSet");
        missionSet.saveToLocalStorage(saveName);
    };

    const handleDeleteClick = () => {
        if (saveName == undefined) return; //TODO, should post warning
        missionSet.deleteFromLocalStorage(saveName);
    };

    const handleRowClick = (name: string) => {
        setSaveName(name);
    };

    // Nem text input
    const nameInput = (
        <div>
            <input
                type="text"
                className="textInput"
                autoFocus
                placeholder="Mission Name"
                defaultValue={saveName}
                onInput={(e) => {}}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                    }
                }}
            ></input>
        </div>
    );

    // Mission rows

    let savedMissionNamess = listSavedMissionSets();

    const missionNameRows = savedMissionNamess.map((name) => {
        var rowClasses = "row hoverable";
        if (name == saveName) {
            rowClasses += " selected";
        }
        let row = (
            <div key={name} className={rowClasses}>
                {name}
            </div>
        );

        return row;
    });

    // Buttons
    let buttonRow = (
        <div className="jaia-button-row">
            <Button className="jaia-button" onClick={() => handleDeleteClick()}>
                <Icon path={mdiDelete}></Icon>
            </Button>
            <Button className="jaia-button">
                <Icon path={mdiFolderDownload}></Icon>
            </Button>
            <div className="flexSpacer"></div>
            <button>Cancel</button>
            <button onClick={() => handleSaveClick()}>Save</button>
        </div>
    );

    return (
        <div className="load-mission-panel">
            <div className="title">Save Mission Set As</div>
            {nameInput}
            <div className="missionList">{missionNameRows}</div>
            {buttonRow}
        </div>
    );
}
