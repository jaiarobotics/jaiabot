import { render, screen, fireEvent } from "@testing-library/react"

import JaiaAbout from "../JaiaAbout"
import { Metadata, Version } from "../../../../../shared/PortalStatus"

const sampleMetadata1: Metadata = {}

const sampleVersion1: Version = {
    major: "1",
    minor: "10",
    patch: "0"
}
const sampleMetadata2: Metadata = {
    jaiabot_version: sampleVersion1
}

describe("System information is visible", () => {
    test("JaiaAbout links to company website", () => {
        render(<JaiaAbout metadata={sampleMetadata1} />)
        const element = screen.getByText("www.jaia.tech")
        expect(element).toHaveAttribute("href", "https://www.jaia.tech")
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

    test("JaiaAbout renders JCC version", () => {
        render(<JaiaAbout metadata={sampleMetadata2}/>)
        const element = screen.getByText("1.10.0")
        expect(element).toBeInTheDocument()
    })

    test("JaiaAbout links to documentation", () => {
        render(<JaiaAbout metadata={sampleMetadata1} />)
        const element = screen.getByText("JaiaDocs")
        expect(element).toHaveAttribute("href", "http://52.36.157.57/index.html")
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
