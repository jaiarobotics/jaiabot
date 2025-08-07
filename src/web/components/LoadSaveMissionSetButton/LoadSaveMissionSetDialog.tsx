import { useContext, useState } from "react";
import { missionSet } from "../../data/mission_set/mission-set";
import { listSavedMissionSets } from "../../utils/local-storage";

import { Button } from "@mui/material";
import Icon from "@mdi/react";
import { mdiDelete, mdiFolderUpload, mdiFolderDownload } from "@mdi/js";

interface DialogProps {
    isVisible: boolean;
    //disabledCode: DisabledCodes;
    //onClose: (dialogAction: DialogActions) => void;
}

/**
 * Produces the dialog box that appears when clicking on the remote control button.
 * This dialog will be an alert if the command cannot be
 * sent or a confirmation prior to sending the command.
 */
export function LoadSaveMissionSetDialog(props: DialogProps) {
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
            <Button
                className="jaia-button"
                aria-label="help-window"
                onClick={() => handleDeleteClick()}
            >
                <Icon path={mdiDelete} title="Delete Mission Set"></Icon>
            </Button>
            <Button className="jaia-button">
                <Icon path={mdiFolderDownload} title="Save Mission Set"></Icon>
            </Button>
            <Button className="jaia-button">
                <Icon path={mdiFolderUpload} title="Load Mission Set"></Icon>
            </Button>

            <div className="flexSpacer"></div>
            <button className="dialog-button">Cancel</button>
        </div>
    );

    if (!props.isVisible) {
        return <div></div>;
    }
    return (
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" onClick={() => {}}>
                <div className={"jaia-dialog"}>
                    <h1> "Load or Save Mission Set" </h1>
                    <div className="title">Save Mission Set As</div>
                    {nameInput}
                    <div className="missionList">{missionNameRows}</div>
                    {buttonRow}
                </div>
            </div>
        </div>
    );

    return <div className="load-mission-panel"></div>;
}
