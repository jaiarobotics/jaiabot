import { useContext, useState } from "react";

import { LoadSaveMissionSetDialog } from "./LoadSaveMissionSetDialog";
import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiFolderArrowUpDown, mdiFolderOpen, mdiContentSave } from "@mdi/js";

import { JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

export default function LoadSaveMissionSetButton() {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    return (
        <div>
            <Button
                className={"jaia-button"}
                aria-label={"load-mission-set"}
                onClick={() => setIsDialogVisible(true)}
            >
                <Icon path={mdiFolderArrowUpDown} title="Load or Save Mission Set"></Icon>
            </Button>
            <LoadSaveMissionSetDialog
                isVisible={isDialogVisible}
                //disabledCode={getDisabledCode()}
                //onClose={onDialogClose}
            />
        </div>
    );
}
