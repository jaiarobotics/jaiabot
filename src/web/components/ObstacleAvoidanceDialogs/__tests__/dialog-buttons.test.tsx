import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import MissionRerouteDialog from "../MissionRerouteDialog/MissionRerouteDialog";
import WaypointRemovalDialog from "../WaypointRemovalDialog/WaypointRemovalDialog";
import { JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import {
    PendingReroute,
    PendingWaypointRemoval,
    ProposalStatus,
    RevertContext,
} from "../../../data/obstacle_avoidance_data/pending-route-data";

function reroute(revert: RevertContext[], overrides: Partial<PendingReroute> = {}): PendingReroute {
    return {
        proposals: [
            {
                missionID: 1,
                newWaypoints: [],
                bypassCount: 2,
                involvedZoneIDs: [7],
                status: ProposalStatus.FEASIBLE,
            },
        ],
        totalBypassCount: 2,
        revert,
        ...overrides,
    };
}

function removal(
    revert: RevertContext[],
    overrides: Partial<PendingWaypointRemoval> = {},
): PendingWaypointRemoval {
    return {
        proposals: [{ missionID: 1, newWaypoints: [], removedCount: 1, isGutted: false }],
        totalRemovedCount: 1,
        offendingZoneIDs: [7],
        revert,
        ...overrides,
    };
}

function renderWithDispatch(ui: React.ReactElement, dispatch = jest.fn()) {
    render(
        <JaiaDispatchContext.Provider value={dispatch as never}>{ui}</JaiaDispatchContext.Provider>,
    );
    return dispatch;
}

const DELETE_ZONE: RevertContext = { kind: "deleteZone", zoneID: 7 };
const RESTORE_SHAPE: RevertContext = {
    kind: "restoreZoneShape",
    zoneID: 7,
    zone: { vertices: [] },
};

describe("MissionRerouteDialog dismissal button", () => {
    test("says Revert when the button undoes a change the operator made", () => {
        renderWithDispatch(<MissionRerouteDialog pending={reroute([DELETE_ZONE])} />);

        expect(screen.getByRole("button", { name: "Revert" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    });

    test("says Cancel when there is nothing to undo, even outside a load", () => {
        renderWithDispatch(<MissionRerouteDialog pending={reroute([])} />);

        expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Revert/ })).not.toBeInTheDocument();
    });

    test("says Cancel for a zone load, whose zones stay loaded either way", () => {
        renderWithDispatch(
            <MissionRerouteDialog
                pending={reroute([], {
                    loadSummary: { kind: "zoneLoad", loadedZoneIDs: [7], skippedZoneIDs: [] },
                })}
            />,
        );

        expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    test("says Revert All when nothing can be confirmed and a change must be undone", () => {
        renderWithDispatch(
            <MissionRerouteDialog
                pending={reroute([DELETE_ZONE], {
                    proposals: [
                        {
                            missionID: 1,
                            newWaypoints: [],
                            bypassCount: 0,
                            involvedZoneIDs: [7],
                            status: ProposalStatus.IMPOSSIBLE,
                        },
                    ],
                    totalBypassCount: 0,
                })}
            />,
        );

        expect(screen.getByRole("button", { name: "Revert All" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
    });

    test("names what reverting undoes, listing every change when there is more than one", () => {
        const { unmount } = render(
            <JaiaDispatchContext.Provider value={jest.fn() as never}>
                <MissionRerouteDialog pending={reroute([DELETE_ZONE])} />
            </JaiaDispatchContext.Provider>,
        );
        expect(screen.getByText("Reverting will remove the new zone.")).toBeInTheDocument();
        unmount();

        renderWithDispatch(
            <MissionRerouteDialog
                pending={reroute([
                    { kind: "restoreWaypoints", missions: [{ missionID: 1, waypoints: [] }] },
                    DELETE_ZONE,
                ])}
            />,
        );
        expect(
            screen.getByText("Reverting will restore the previous route and remove the new zone."),
        ).toBeInTheDocument();
    });

    test("says nothing about reverting when nothing would be undone", () => {
        renderWithDispatch(<MissionRerouteDialog pending={reroute([])} />);

        expect(screen.queryByText(/Reverting will/)).not.toBeInTheDocument();
    });

    test("dispatches the cancel action when clicked", async () => {
        const user = userEvent.setup();
        const dispatch = renderWithDispatch(
            <MissionRerouteDialog pending={reroute([DELETE_ZONE])} />,
        );

        await user.click(screen.getByRole("button", { name: "Revert" }));

        expect(dispatch).toHaveBeenCalledWith({ type: JaiaActions.CANCEL_MISSION_REROUTE });
    });
});

describe("WaypointRemovalDialog dismissal button", () => {
    test("says Revert when the button undoes a change the operator made", () => {
        renderWithDispatch(<WaypointRemovalDialog pending={removal([RESTORE_SHAPE])} />);

        expect(screen.getByRole("button", { name: "Revert" })).toBeInTheDocument();
        expect(
            screen.getByText("Reverting will restore the zone's previous shape."),
        ).toBeInTheDocument();
    });

    test("says Cancel when there is nothing to undo", () => {
        renderWithDispatch(<WaypointRemovalDialog pending={removal([])} />);

        expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
        expect(screen.queryByText(/Reverting will/)).not.toBeInTheDocument();
    });

    test("says Revert All when nothing can be applied", () => {
        renderWithDispatch(
            <WaypointRemovalDialog
                pending={removal([RESTORE_SHAPE], {
                    // Every waypoint is inside a zone, so there is no removal to apply —
                    // the mission is left alone and the dismissal is the only action.
                    proposals: [
                        { missionID: 1, newWaypoints: [], removedCount: 2, isGutted: true },
                    ],
                    totalRemovedCount: 2,
                })}
            />,
        );

        expect(screen.getByRole("button", { name: "Revert All" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
    });

    test("still offers Confirm when a removal applies even though the follow-up is unroutable", () => {
        renderWithDispatch(
            <WaypointRemovalDialog
                pending={removal([RESTORE_SHAPE], {
                    followUpReroute: {
                        proposals: [
                            {
                                missionID: 1,
                                newWaypoints: [],
                                bypassCount: 0,
                                involvedZoneIDs: [7],
                                status: ProposalStatus.OVER_LIMIT,
                            },
                        ],
                        totalBypassCount: 0,
                    },
                })}
            />,
        );

        // The removal is still worth applying; the unroutable mission is simply left alone.
        expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Revert" })).toBeInTheDocument();
    });

    test("dispatches the cancel action when clicked", async () => {
        const user = userEvent.setup();
        const dispatch = renderWithDispatch(
            <WaypointRemovalDialog pending={removal([RESTORE_SHAPE])} />,
        );

        await user.click(screen.getByRole("button", { name: "Revert" }));

        expect(dispatch).toHaveBeenCalledWith({ type: JaiaActions.CANCEL_WAYPOINT_REMOVAL });
    });
});
