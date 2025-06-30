// React
import React from "react";
import { useContext } from "react";

import { JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import { missionSet } from "../../data/missions/missionSet";

import Icon from "@mdi/react";
import Button from "@mui/material/Button";
import { mdiDelete, mdiFolderDownload } from "@mdi/js";
import "./SaveMissionPanel.less";

/**
 * Renders a panel for operators to save missions
 */
export default function SaveMissionPanel() {
    const jaiaDispatch = useContext(JaiaDispatchContext);

    // Nem text input
    const nameInput = (
        <div>
            <input
                type="text"
                className="textInput"
                autoFocus
                placeholder="Mission Name"
                defaultValue={missionSet.getName()}
                onInput={(e) => {}}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                    }
                }}
            ></input>
        </div>
    );

    // Mission rows

    //let savedMissionNamess = missionSet.listSavedMissionSets();
    // TODO restore above below is for testing
    let savedMissionNamess = ["one", "two", "three"];

    const missionNameRows = savedMissionNamess.map((name) => {
        var rowClasses = "LoadMissionPanel row hoverable";
        if (name == "missionSet.getName()") {
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
        <div className="LoadMissionPanel HorizontalFlexbox">
            <Button className="button-jcc">
                <Icon path={mdiDelete}></Icon>
            </Button>
            <Button className="button-jcc">
                <Icon path={mdiFolderDownload}></Icon>
            </Button>
            <div className="flexSpacer"></div>
            <Button className="button-jcc">Cancel</Button>
            <Button className="button-jcc">Save</Button>
        </div>
    );

    return (
        <div className="LoadMissionPanel centered rounded shadowed">
            <div className="LoadMissionPanel title">Save Mission As</div>
            {nameInput}
            <div className="LoadMissionPanel missionList">{missionNameRows}</div>
            {buttonRow}
        </div>
    );
}
