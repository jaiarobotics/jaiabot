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
 * @returns {string} Label for the dismissal button
 */
export function dismissButtonLabel(revert: RevertContext[]): string {
    return revert.length === 0 ? "Cancel" : "Revert";
}

/**
 * Whether confirming leads anywhere different from dismissing, which is the only
 * reason to offer both. Confirming applies whatever the proposal can apply and leaves
 * the operator's own edit standing; dismissing applies the revert list instead. With
 * nothing to apply and nothing to revert the two are the same action, and offering
 * both only invites the operator to wonder which one they wanted.
 *
 * @param {RevertContext[]} revert Revert actions the dismissal button will apply
 * @param {boolean} hasChangesToApply Whether confirming would change any mission
 * @returns {boolean} Whether a confirm button should be offered alongside the dismissal
 */
export function shouldOfferConfirm(revert: RevertContext[], hasChangesToApply: boolean): boolean {
    return hasChangesToApply || revert.length > 0;
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
