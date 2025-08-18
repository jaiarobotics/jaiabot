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
export function MissionSetStorageDialog(props: DialogProps) {
    const [saveName, setSaveName] = useState<string>(missionSet.getName());

    const handleRowClick = (name: string) => {
        setSaveName(name);
    };

    const clearSaveName = () => {
        setSaveName("");
    };

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

    if (!props.isVisible) {
        return <div></div>;
    }

    return (
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" onClick={() => {}}>
                <div className="jaia-dialog mission-set-storage">
                    <h1>Mission Set Storage</h1>
                    <div className="input-container">
                        <label>Mission Set Name</label>
                        <input
                            type="text"
                            value={saveName}
                            onInput={(evt) => {
                                setSaveName((evt.target as any).value);
                            }}
                        />
                    </div>
                    <div className="mission-sets-container">
                        <label>Mission Sets</label>
                        <div className="mission-set-names">{missionNameRows}</div>
                    </div>
                    <div className="button-row">
                        <DeleteMissionSetButton saveName={saveName} clearSaveName={clearSaveName} />
                        <SaveMissionSetButton saveName={saveName} onClose={props.onClose} />
                        <LoadMissionSetButton saveName={saveName} onClose={props.onClose} />
                    </div>
                    <button onClick={() => props.onClose()}>Close</button>
                </div>
            </div>
        </div>
    );
}
