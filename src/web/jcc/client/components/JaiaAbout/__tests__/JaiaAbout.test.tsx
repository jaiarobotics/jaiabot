import { render, screen } from '@testing-library/react'

import JaiaAbout from '../JaiaAbout'
import { Metadata } from '../../../../../shared/PortalStatus'

const sampleMetadata1: Metadata = {}

test('JaiaAbout renders website url', () => {
    render(<JaiaAbout metadata={sampleMetadata1} />)
    const element = screen.getByText("www.jaia.tech")
    expect(element).toBeInTheDocument()
})

test('JaiaAbout renders phone number', () => {
    render(<JaiaAbout metadata={sampleMetadata1} />)
    const element = screen.getByText("+1 (401) 214-9232")
    expect(element).toBeInTheDocument()
})

test('JaiaAbout renders address', () => {
    render(<JaiaAbout metadata={sampleMetadata1} />)
    const element = screen.getByText("22 Burnside St Bristol RI 02809")
    expect(element).toBeInTheDocument()
})
