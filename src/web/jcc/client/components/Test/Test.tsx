import { useState } from "react";
import JaiaToggle from "../JaiaToggle";
import "./Test.less";

export function Test() {
    const [checked, setChecked] = useState(false);
    const [showMaxDepth, setShowMaxDepth] = useState(true);

    const handleToggleClick = () => {
        setChecked(!checked);
        setShowMaxDepth(!showMaxDepth);
    };

    return (
        <div className={"test-container"}>
            <JaiaToggle
                checked={() => checked}
                disabled={() => false}
                onClick={() => handleToggleClick()}
            />
            {showMaxDepth ? <div>Max Depth</div> : <div></div>}
        </div>
    );
}
