import React, { useEffect } from "react";
import { mdiClose } from "@mdi/js";
import { Icon } from "@mdi/react";
import "./JDVTitleBar.css";

interface Props {
    onClose: () => void
}


export function JDVTitleBar(props: Props) {
    return <div className="JDVTitleBar">
        <button onClick={props.onClose}>
            <Icon path={mdiClose}>
            </Icon>
        </button>
    </div>
}
