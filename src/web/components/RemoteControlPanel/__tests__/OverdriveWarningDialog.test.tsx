import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import { OverdriveWarningDialog } from "../OverdriveWarning/OverdriveWarningDialog";
import { DialogActions } from "../../../types/context-types";

test("Overdrive warning dialog is hidden when not visible", () => {
    render(<OverdriveWarningDialog isVisible={false} onClose={jest.fn()} />);

    expect(screen.queryByText("Warning")).not.toBeInTheDocument();
});

test("Overdrive warning dialog shows warning text and buttons when visible", () => {
    render(<OverdriveWarningDialog isVisible={true} onClose={jest.fn()} />);

    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(
        screen.getByText("Overdrive offers more speed, but it can make control more difficult."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enable Overdrive" })).toBeInTheDocument();
});

test("Overdrive warning dialog calls onClose with correct action", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();

    render(<OverdriveWarningDialog isVisible={true} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledWith(DialogActions.NONE);

    await user.click(screen.getByRole("button", { name: "Enable Overdrive" }));
    expect(onClose).toHaveBeenCalledWith(DialogActions.CONFIRMED);
});
