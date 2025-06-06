import { SCROLL_DELAY } from "./constants";

interface XYCoordinate {
    x: number;
    y: number;
}

export enum MapIconColors {
    SELECTED = "turquoise",
    DEFAULT = "white",
}

export function angleToXY(angle: number): XYCoordinate {
    return { x: Math.cos(Math.PI / 2 - angle), y: -Math.sin(Math.PI / 2 - angle) };
}

/**
 * Adds an event listener to detect when a dropdown element extends beyond the visible view and
 * scrolls it back into view
 *
 * @param {string} className Used to identify dropdown elements
 * @param {string} parentID Used to identify outer container
 * @returns {void}
 *
 * @notes
 * parentContainerId needs to have the property max-height set in css
 */
export function addDropdownListener(className: string, parentID: string) {
    const dropdowns = Array.from(
        document.getElementsByClassName(className) as HTMLCollectionOf<HTMLElement>,
    );

    for (const dropdown of dropdowns) {
        dropdown.addEventListener("click", (event: Event) =>
            handleDropdownClick(className, parentID, event),
        );
    }
}

/**
 * Captures the root of the dropdown then triggers the scroll
 *
 * @param {string} className Identifies root of dropdown
 * @param {string} parentID  Identifies parent of dropdown
 * @param {Event} event Holds the clicked element
 * @returns {void}
 */
function handleDropdownClick(className: string, parentID: string, event: Event) {
    let clickedElement = event.target as HTMLElement;

    // Accordion closing
    if (clickedElement.classList.contains("Mui-expanded")) {
        return;
    }

    while (!clickedElement.classList.contains(className) && clickedElement.parentElement) {
        clickedElement = clickedElement.parentElement;
    }

    // Delay allows the dropdown to fully expand before scrolling
    setTimeout(() => adjustDropdownPosition(clickedElement, parentID), SCROLL_DELAY);
}

/**
 * Scrolls a dropdown element into view within its parent element
 *
 * @param {HTMLElement} dropdown Gives us access to dimensions of the dropdown element
 * @param {string} parentID Gives us access to dimensions of the parent element
 * @returns {void}
 */
function adjustDropdownPosition(dropdown: HTMLElement, parentID: string) {
    const parent = document.getElementById(parentID);

    if (!parent) return;

    const parentRect: DOMRect = parent.getBoundingClientRect();
    const dropdownRect: DOMRect = dropdown.getBoundingClientRect();

    if (dropdownRect.height > parentRect.height) {
        const heightDiff = dropdownRect.height - parentRect.height;
        parent.scrollBy({
            // Subtracting heightDiff reduces scroll by number of pixels dropdown is larger
            // than parent
            top: dropdownRect.bottom - parentRect.bottom - heightDiff,
            left: 0,
        });
    } else if (dropdownRect.bottom > parentRect.bottom) {
        parent.scrollBy({
            top: dropdownRect.bottom - parentRect.bottom,
            left: 0,
        });
    }
}

/**
 * Scrolls the newest mission into view
 *
 * @returns {void}
 */
export function scrollMissionsList() {
    setTimeout(() => {
        const missionsList = document.getElementById("missions-list");
        if (missionsList) {
            const scrollAmount = missionsList.scrollHeight;
            missionsList.scrollTo({ top: scrollAmount });
        }
    }, SCROLL_DELAY);
}
