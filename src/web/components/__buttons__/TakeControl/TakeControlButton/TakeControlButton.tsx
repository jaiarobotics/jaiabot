import { jaia_rest_api } from "../../../../utils/jaia-rest-api";
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
        try {
            const response = await jaia_rest_api.takeControl(); // Will throw if request fails
            console.log(response);
        } catch (error) {
            console.error("Error taking control:", error);
        }
    };

    return (
        <button id="take-control" onClick={handleTakeControlClick}>
            Take Control
        </button>
    );
}
