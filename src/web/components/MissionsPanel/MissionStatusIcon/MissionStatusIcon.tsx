import { Icon } from "@mdi/react";
import { Button } from "@mui/material";

import { MDI_BUTTON_SIZE } from "../../../utils/constants";

import "./MissionStatusIcon.less";

/** How urgent a status is, most urgent first. The icon's background shows it. */
export type StatusLevel = "error" | "warning" | "normal";

interface Props {
    level: StatusLevel;
    iconPath: string;
    /** Names the status in words, since the colour alone shows it on screen. */
    label: string;
    onClick: () => void;
    disabled?: boolean;
}

/** A status shown as an icon button whose background gives its level. */
export default function MissionStatusIcon(props: Props) {
    return (
        <Button
            className={`jaia-button mission-status-icon ${props.level}`}
            aria-label={props.label}
            onClick={props.onClick}
            disabled={props.disabled}
        >
            <Icon path={props.iconPath} size={MDI_BUTTON_SIZE} />
        </Button>
    );
}
