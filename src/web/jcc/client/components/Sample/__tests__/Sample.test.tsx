import { render, screen } from '@testing-library/react'
import Sample from '../Sample'

test('Sample renders text in doc', () => {
    render(<Sample message="Hello, World!"/>)
    const element = screen.getByText((/Hello, World!/))
    expect(element).toBeInTheDocument()
})
