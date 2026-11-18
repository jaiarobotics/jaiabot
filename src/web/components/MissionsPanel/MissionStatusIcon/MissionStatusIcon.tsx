import { Icon } from "@mdi/react";
import { Button } from "@mui/material";

import { MDI_BUTTON_SIZE } from "../../../utils/constants";

import "./MissionStatusIcon.less";

/** How urgent a status is, most urgent first. The icon's background shows it. */
export type StatusLevel = "error" | "warning" | "normal";

const MDI_COMPACT_SIZE = 0.9;

interface Props {
    level: StatusLevel;
    iconPath: string;
    /** Names the status in words, since the colour alone shows it on screen. */
    label: string;
    onClick: () => void;
    disabled?: boolean;
    /** Smaller, and with no fill at the normal level, so it stands out only when it needs to */
    compact?: boolean;
}

/** A status shown as an icon button whose background gives its level. */
export default function MissionStatusIcon(props: Props) {
    return (
        <Button
            className={`jaia-button mission-status-icon ${props.level}${props.compact ? " compact" : ""}`}
            aria-label={props.label}
            onClick={props.onClick}
            disabled={props.disabled}
        >
            <Icon path={props.iconPath} size={props.compact ? MDI_COMPACT_SIZE : MDI_BUTTON_SIZE} />
        </Button>
    );
}
