import { useState } from "react";
import { createPortal } from "react-dom";

import Mission from "../../data/mission_set/mission";
import { exclusionZoneSet } from "../../data/exclusion_zones/exclusion-zone-set";
import { GeographicCoordinate } from "../../types/protobuf-types";
import { checkPlacement, PlacedPoint } from "../../utils/routing/placement";

interface Props {
    message: string;
    /** Places the point. Without it, the dialog reports a refusal. */
    onConfirm?: () => void;
    onCancel: () => void;
}

/**
 * Asks the operator to confirm a placement inside an exclusion zone, or explains why a
 * placement is refused.
 */
export default function PlacementDialog({ message, onConfirm, onCancel }: Props) {
    // Rendered on the body so a positioned panel cannot stack above it
    return createPortal(
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" />
            <div className="jaia-dialog">
                <h1>{onConfirm ? "Confirm" : "Placement Not Allowed"}</h1>
                <p>{message}</p>
                <div className="dialog-button-row">
                    {/* Focus moves here, so typing can't keep editing the field behind */}
                    <button className="dialog-button" onClick={onCancel} autoFocus>
                        {onConfirm ? "Cancel" : "OK"}
                    </button>
                    {onConfirm && (
                        <button className="dialog-button" onClick={onConfirm}>
                            Place anyway
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}

interface PlaceOptions {
    /** Mission the point is appended to as a new waypoint. */
    appendingTo?: Mission;
    /** Runs when the operator cancels, or dismisses a refusal. */
    onCancel?: () => void;
}

/**
 * Checks placements against the exclusion zones and the waypoint limit, and holds the
 * dialog that asks the operator to confirm or explains a refusal.
 *
 * A custom React hook: each component that calls it gets its own copy of the dialog state,
 * and re-renders when the dialog opens or closes.
 *
 * @returns {object} `checkAndPlace`, which places a point once it is allowed or confirmed;
 * `placementDialog`, the dialog to render, or null; and `isPrompting`, true while it is open
 */
export function usePlacementCheck() {
    const [prompt, setPrompt] = useState<{
        message: string;
        onConfirm?: () => void;
        onCancel?: () => void;
    } | null>(null);

    /**
     * Places a point if its location is allowed. Otherwise asks the operator to confirm, or
     * explains why it is refused, and places it only once confirmed.
     *
     * @param {GeographicCoordinate} location Where the point would go
     * @param {PlacedPoint} point The kind of point being placed
     * @param {Function} place Places the point
     * @param {PlaceOptions} [options] The mission appended to, and what to do on cancel
     * @returns {void}
     */
    const checkAndPlace = (
        location: GeographicCoordinate,
        point: PlacedPoint,
        place: () => void,
        options: PlaceOptions = {},
    ) => {
        const zones = exclusionZoneSet.getZones();
        const placement = checkPlacement(location, zones, point, options.appendingTo);
        if (placement.kind === "allowed") {
            place();
            return;
        }
        setPrompt({
            message: placement.message,
            onConfirm: placement.kind === "confirm" ? place : undefined,
            onCancel: options.onCancel,
        });
    };

    const placementDialog = prompt && (
        <PlacementDialog
            message={prompt.message}
            onConfirm={
                prompt.onConfirm &&
                (() => {
                    setPrompt(null);
                    prompt.onConfirm!();
                })
            }
            onCancel={() => {
                setPrompt(null);
                prompt.onCancel?.();
            }}
        />
    );

    return { checkAndPlace, placementDialog, isPrompting: prompt !== null };
}
