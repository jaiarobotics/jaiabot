import { useState } from "react";
import { Button } from "@mui/material";
import Icon from "@mdi/react";
import { mdiFolder } from "@mdi/js";

import { MDI_BUTTON_SIZE } from "../../../utils/constants";
import { ZoneStorageDialog } from "./ZoneStorageDialog";

interface Props {
    zoneSetName: string;
}

export default function ZoneStorageButton(props: Props) {
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    /**
     * Closes the dialog box.
     *
     * @returns {void}.
     */
    const onDialogClose = async () => {
        setIsDialogVisible(false);
    };

    return (
        <div>
            <Button
                className={"jaia-button"}
                aria-label={"zone-storage"}
                onClick={() => setIsDialogVisible(true)}
            >
                <Icon path={mdiFolder} size={MDI_BUTTON_SIZE} title="Obstacle Zone Storage" />
            </Button>
            {isDialogVisible ? (
                <ZoneStorageDialog zoneSetName={props.zoneSetName} onClose={onDialogClose} />
            ) : (
                <div></div>
            )}
        </div>
    );
}
