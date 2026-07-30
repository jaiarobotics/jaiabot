import { useContext, useState } from "react";
import { JaiaDispatchContext } from "../../../../context/JaiaContext";
import { JaiaActions } from "../../../../context/jaia-actions";
import { DialogActions } from "../../../../types/context-types";
import { exclusionZoneSet } from "../../../../data/exclusion_zones/exclusion-zone-set";
import { saveToHub } from "../zone-storage";
import { DisabledCodes } from "./save-messages";
import { SaveZoneDialog } from "./SaveZoneDialog";

interface Props {
    saveName: string;
    savedNames: string[];
    onSaved: () => void;
}

/**
 * Produces the save zone set button.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function SaveZoneButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    /**
     * Checks the zone set and applies the appropriate disabled code.
     *
     * @returns {DisabledCodes} The applicable disabled code based on the zone set conditions.
     */
    const getDisabledCode = () => {
        if (exclusionZoneSet.getZones().size === 0) return DisabledCodes.NO_ZONES;
        if (!props.saveName.trim()) return DisabledCodes.NO_NAME;
        if (props.savedNames.includes(props.saveName.trim())) return DisabledCodes.OVERWRITE;
        return DisabledCodes.NONE;
    };

    /**
     * Displays dialog if a warning condition exists or saves the zone set directly.
     *
     * @returns {void}.
     */
    const onButtonClick = () => {
        if (getDisabledCode() !== DisabledCodes.NONE) {
            setIsDialogVisible(true);
        } else {
            onDialogClose(DialogActions.CONFIRMED);
        }
    };

    /**
     * Closes the dialog box then acts based on the button clicked.
     *
     * @param {DialogActions} dialogAction Indicates which button was clicked.
     * @returns {void}.
     */
    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);
        if (dialogAction === DialogActions.CONFIRMED) {
            saveToHub(props.saveName.trim()).then(() => {
                jaiaDispatch({
                    type: JaiaActions.CHANGE_EXCLUSION_ZONE_SET_NAME,
                    exclusionZoneSetName: props.saveName.trim(),
                });
                props.onSaved();
            });
        }
    };

    return (
        <div>
            <button aria-label={"save-zone-set"} onClick={() => onButtonClick()}>
                Save
            </button>
            <SaveZoneDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                saveName={props.saveName}
                onClose={onDialogClose}
            />
        </div>
    );
}
