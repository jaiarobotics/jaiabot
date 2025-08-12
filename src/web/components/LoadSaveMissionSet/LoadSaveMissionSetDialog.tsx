import { useState } from "react";
import { missionSet } from "../../data/mission_set/mission-set";
import { listSavedMissionSets } from "../../utils/local-storage";
import SaveMissionSetButton from "./SaveMissionSetButton/SaveMissionSetButton";
import LoadMissionSetButton from "./LoadMissionSetButton/LoadMissionSetButton";
import DeleteMissionSetButton from "./DeleteMissionSetButton/DeleteMissionSetButton";
import "./LoadSaveMissionSet.less";

interface DialogProps {
    isVisible: boolean;
    onClose: () => void;
}

/**
 * Produces the dialog box that appears when clicking on the load/save mission set button
 * This dialog provides delete, save and load mission set buttons
 */
export function LoadSaveMissionSetDialog(props: DialogProps) {
    const [saveName, setSaveName] = useState<string>(missionSet.getName());

    const handleRowClick = (name: string) => {
        setSaveName(name);
    };

    // Name text input
    const nameInput = (
        <div>
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
            <DeleteMissionSetButton saveName={saveName} />
            <SaveMissionSetButton saveName={saveName} onClose={props.onClose} />
            <LoadMissionSetButton saveName={saveName} onClose={props.onClose} />
            <div className="flexSpacer"></div>
            <button className="dialog-button" onClick={() => props.onClose()}>
                Close
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
                        <div className="title">Mission Set Name</div>
                        {nameInput}
                        <div className="missionList">{missionNameRows}</div>
                        {buttonRow}
                    </div>
                </div>
            </div>
        </div>
    );
}
