import { RevertContext } from "../../../data/obstacle_avoidance_data/pending-route-data";

const REVERT_DESCRIPTIONS: Record<RevertContext["kind"], string> = {
    deleteZone: "remove the new zone",
    restoreZoneShape: "restore the zone's previous shape",
    restoreWaypoints: "restore the previous route",
    restoreMissionSnapshot: "restore the previous missions",
    restoreZoneSetSnapshot: "restore the previous zones",
};

/**
 * Chooses the dismissal button's label from what that button will actually do.
 * An empty revert list means the operator's own action already stands and only
 * the proposal is being declined, so the button cancels rather than reverts.
 *
 * @param {RevertContext[]} revert Revert actions the dismissal button will apply
 * @param {boolean} revertsEverything Whether no part of the proposal can be confirmed, leaving the button as the only action
 * @returns {string} Label for the dismissal button
 */
export function dismissButtonLabel(revert: RevertContext[], revertsEverything: boolean): string {
    if (revert.length === 0) return "Cancel";
    return revertsEverything ? "Revert All" : "Revert";
}

/**
 * Describes what reverting would undo, so the dialog can say which of the
 * operator's changes the button rolls back rather than leaving them to guess.
 * Returns null when nothing would be undone.
 *
 * @param {RevertContext[]} revert Revert actions the dismissal button will apply
 * @returns {string | null} Sentence fragment naming what is undone, or null if nothing is
 */
export function describeRevert(revert: RevertContext[]): string | null {
    const parts = Array.from(new Set(revert.map((r) => REVERT_DESCRIPTIONS[r.kind])));
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0];
    return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
