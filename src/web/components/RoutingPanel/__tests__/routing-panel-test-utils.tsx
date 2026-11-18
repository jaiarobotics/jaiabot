import { render } from "@testing-library/react";

import RoutingPanel from "../RoutingPanel";

import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import { handleClickedButton } from "../../../context/handlers/selection-handlers";
import { makeMutableState } from "../../../context/handlers/__tests__/handler-test-utils";
import { RoutingTarget } from "../../../data/jaia_global/jaia-global";
import {
    ButtonNames,
    ButtonTypes,
    JaiaAction,
    JaiaContextType,
} from "../../../types/context-types";

/**
 * Opens the routing panel for the target and renders it, with a mocked dispatch. `apply` runs
 * the last dispatched action through its handler and re-renders with the result, as the
 * reducer would; `reopen` opens the panel again after it was closed.
 */
export function renderRoutingPanel(routingTarget: RoutingTarget) {
    let state: JaiaContextType = makeMutableState();
    const dispatch = jest.fn();
    const open = () => {
        state = handleClickedButton(
            { ...state },
            {
                type: JaiaActions.CLICKED_BUTTON,
                buttonType: ButtonTypes.MAP_MODE,
                buttonName: ButtonNames.ROUTING_PANEL,
                routingTarget,
            },
        );
    };
    const view = () => (
        <JaiaContext.Provider value={state}>
            <JaiaDispatchContext.Provider value={dispatch}>
                {state.visiblePanel === ButtonNames.ROUTING_PANEL && <RoutingPanel />}
            </JaiaDispatchContext.Provider>
        </JaiaContext.Provider>
    );
    open();
    const { rerender } = render(view());
    const apply = (handler: (state: JaiaContextType, action: JaiaAction) => JaiaContextType) => {
        state = handler({ ...state }, dispatch.mock.lastCall[0]);
        rerender(view());
    };
    const reopen = () => {
        open();
        rerender(view());
    };
    const panel = () => document.querySelector<HTMLElement>(".routing-panel");
    return { dispatch, apply, reopen, panel };
}
