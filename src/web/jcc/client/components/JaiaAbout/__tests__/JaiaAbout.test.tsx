import { render, screen, fireEvent } from "@testing-library/react"

import JaiaAbout from "../JaiaAbout"
import { Metadata } from "../../../../../shared/PortalStatus"

const sampleMetadata1: Metadata = {}

describe("System information is visible", () => {
    test("JaiaAbout renders website url", () => {
        render(<JaiaAbout metadata={sampleMetadata1} />)
        const element = screen.getByText("www.jaia.tech")
        expect(element).toBeInTheDocument()
    })
    
    test("JaiaAbout renders phone number", () => {
        render(<JaiaAbout metadata={sampleMetadata1} />)
        const element = screen.getByText("+1 (401) 214-9232")
        expect(element).toBeInTheDocument()
    })
    
    test("JaiaAbout renders address", () => {
        render(<JaiaAbout metadata={sampleMetadata1} />)
        const element = screen.getByText("22 Burnside St Bristol RI 02809")
        expect(element).toBeInTheDocument()
    })
})

describe("JaiaABout panel closes", () => {
    test("JaiaAbout panel closes", () => {
        render(<JaiaAbout metadata={sampleMetadata1}/>)
        const panelElement = screen.getByTestId("jaia-about-panel")
        const closeButton = screen.getByRole("button", { name: "close-btn", hidden: true })
        fireEvent.click(closeButton)
        expect(panelElement).not.toBeVisible()
    })
})
