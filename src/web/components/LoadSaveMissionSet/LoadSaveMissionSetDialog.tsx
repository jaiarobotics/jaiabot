import { useState } from "react";
import { missionSet } from "../../data/mission_set/mission-set";
import { listSavedMissionSets } from "../../utils/local-storage";

import { Button } from "@mui/material";
import Icon from "@mdi/react";
import { mdiDelete, mdiFolderUpload, mdiFolderDownload } from "@mdi/js";
import "./LoadSaveMissionSet.less";

interface DialogProps {
    isVisible: boolean;
    onClose: () => void;
}

/**
 * Produces the dialog box that appears when clicking on the remote control button.
 * This dialog will be an alert if the command cannot be
 * sent or a confirmation prior to sending the command.
 */
export function LoadSaveMissionSetDialog(props: DialogProps) {
    const [saveName, setSaveName] = useState<string>(missionSet.getName());

    const handleSaveClick = () => {
        //TODO, may post warning
        if (saveName == undefined) setSaveName("DefaultMissionSet");
        missionSet.saveToLocalStorage(saveName);
        props.onClose();
    };

    const handleLoadClick = () => {
        //TODO, should post warning
        if (saveName == undefined) return;
        missionSet.loadFromLocalStorage(saveName);
        props.onClose();
    };

    const handleDeleteClick = () => {
        if (saveName == undefined) return; //TODO, should post warning
        missionSet.deleteFromLocalStorage(saveName);
    };

    const handleRowClick = (name: string) => {
        // console.log("Clicked on:",name);
        setSaveName(name);
    };

    // Name text input
    const nameInput = (
        <div className="load-save-mission-set">
            <input
                type="text"
                className="textInput"
                autoFocus
                placeholder="Mission Name"
                value={saveName}
                onInput={(e) => {
                    setSaveName((e.target as any).value);
                }}
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
            <div key={name} className={rowClasses} onClick={() => handleRowClick(name)}>
                {name}
            </div>
        );

        return row;
    });

    // Buttons
    let buttonRow = (
        <div className="jaia-button-row">
            <Button
                className="jaia-button"
                aria-label="help-window"
                onClick={() => handleDeleteClick()}
            >
                <Icon path={mdiDelete} title="Delete Mission Set"></Icon>
            </Button>
            <Button className="jaia-button" onClick={() => handleSaveClick()}>
                <Icon path={mdiFolderDownload} title="Save Mission Set"></Icon>
            </Button>
            <Button className="jaia-button" onClick={() => handleLoadClick()}>
                <Icon path={mdiFolderUpload} title="Load Mission Set"></Icon>
            </Button>

            <div className="flexSpacer"></div>
            <button className="dialog-button" onClick={() => props.onClose()}>
                Cancel
            </button>
        </div>
    );

    if (!props.isVisible) {
        return <div></div>;
    }
    return (
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" onClick={() => {}}>
                <div className={"jaia-dialog"}>
                    <div className={"load-save-mission-set"}>
                        <h1> "Load or Save Mission Set" </h1>
                        <div className="title">Save Mission Set As</div>
                        {nameInput}
                        <div className="missionList">{missionNameRows}</div>
                        {buttonRow}
                    </div>
                </div>
            </div>
        </div>
    );
}
