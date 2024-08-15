// src/MySelect.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MySelect } from "./MySelect";
import "@testing-library/jest-dom/extend-expect";

describe("MySelect Component", () => {
    it("should render the select component and allow selection of an option", () => {
        const handleChange = jest.fn(); // Mock function

        render(<MySelect handleChange={handleChange} />);

        // Verify the select component renders
        const selectElement = screen.getByRole("combobox");
        expect(selectElement).toBeInTheDocument();

        // Open the select dropdown
        fireEvent.mouseDown(selectElement);

        // Select the "Twenty" option
        const option = screen.getByText("Twenty");
        fireEvent.click(option);

        // Verify the value has been updated in the dropdown
        expect(selectElement).toHaveTextContent("Twenty");

        // Verify handleChange was called with the expected value
        expect(handleChange).toHaveBeenCalledTimes(1);
        expect(handleChange).toHaveBeenCalledWith(
            expect.objectContaining({
                target: expect.objectContaining({ value: 20 }),
            }),
        );
    });
});
