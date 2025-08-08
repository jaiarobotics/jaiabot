import { useContext, useState } from "react";

import { LoadSaveMissionSetDialog } from "./LoadSaveMissionSetDialog";
import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiFolder } from "@mdi/js";

import { JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

export default function LoadSaveMissionSetButton() {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    /**
     * Closes the dialog box then acts based on the type of button clicked
     *
     * @param {DialogActions} dialogAction Indicates which button was clicked
     * @returns {void}
     */
    const onDialogClose = async () => {
        setIsDialogVisible(false);
    };

    return (
        <div>
            <Button
                className={"jaia-button"}
                aria-label={"load-mission-set"}
                onClick={() => setIsDialogVisible(true)}
            >
                <Icon path={mdiFolder} title="Load or Save Mission Set"></Icon>
            </Button>
            <LoadSaveMissionSetDialog
                isVisible={isDialogVisible}
                //disabledCode={getDisabledCode()}
                onClose={onDialogClose}
            />
        </div>
    );
}
