import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SwitchPage from "../SwitchPage";

test("flipping switch changes boolean", async () => {
    render(<SwitchPage />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("true")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
});
