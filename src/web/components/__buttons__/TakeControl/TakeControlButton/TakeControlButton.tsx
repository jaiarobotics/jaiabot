import { jaiaAPI } from "../../../../utils/jaia-api";
import "./TakeControlButton.less";

/**
 * Renders the Take Control button in the bottom left corner of the JCC
 */
export default function TakeControlButton() {
    /**
     * Makes API call to take control of the system
     *
     * @returns {void}
     */
    const handleTakeControlClick = async () => {
        const res = await jaiaAPI.takeControl();
    };

    return (
        <button id="take-control" onClick={handleTakeControlClick}>
            Take Control
        </button>
    );
}
