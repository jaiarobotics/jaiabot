import { useState } from "react";

import { LoadSaveMissionSetDialog } from "./LoadSaveMissionSetDialog";
import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiFolder } from "@mdi/js";

export default function LoadSaveMissionSetButton() {
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    /**
     * Closes the dialog box
     *
     * @returns {void}
     */
    const onDialogClose = async () => {
        setIsDialogVisible(false);
    };

    return (
        <div>
            <Button
                className={"jaia-button"}
                aria-label={"load-or-mission-set"}
                onClick={() => setIsDialogVisible(true)}
            >
                <Icon path={mdiFolder} title="Load or Save Mission Set"></Icon>
            </Button>
            <LoadSaveMissionSetDialog isVisible={isDialogVisible} onClose={onDialogClose} />
        </div>
    );
}
