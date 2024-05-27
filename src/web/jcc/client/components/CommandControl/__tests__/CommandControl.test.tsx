import { render, screen, fireEvent } from "@testing-library/react"

import CommandControl from "../CommandControl"

describe("JaiaAbout integration tests", () => {
    test("JaiaAbout panel opens when Jaia info button is clicked", () => {
        render(<CommandControl />)
        const jaiaInfoButton = screen.getByRole("img", { name: "Jaia info button" })
        fireEvent.click(jaiaInfoButton)
        const panelElement = screen.getByTestId("jaia-about-panel")
        expect(panelElement).toBeVisible()
    })
})
