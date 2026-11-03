import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { mdiMapMarkerPath } from "@mdi/js";

import MissionStatusIcon from "../MissionStatusIcon";

describe("MissionStatusIcon", () => {
    test("is named by its label and shows its level", () => {
        render(
            <MissionStatusIcon
                level="warning"
                iconPath={mdiMapMarkerPath}
                label="Test status"
                onClick={jest.fn()}
            />,
        );

        expect(screen.getByRole("button", { name: "Test status" })).toHaveClass("warning");
    });

    test("a tap calls its handler", async () => {
        const onClick = jest.fn();
        render(
            <MissionStatusIcon
                level="normal"
                iconPath={mdiMapMarkerPath}
                label="Test status"
                onClick={onClick}
            />,
        );

        await userEvent.click(screen.getByRole("button", { name: "Test status" }));

        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
