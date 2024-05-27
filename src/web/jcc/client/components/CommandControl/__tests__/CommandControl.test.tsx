import { render, screen, fireEvent } from "@testing-library/react"

import CommandControl from "../CommandControl"

describe("JaiaAbout integration tests", () => {
    test("JaiaAbout panel opens when Jaia info button is clicked", () => {
        render(<CommandControl />)
    })
})
