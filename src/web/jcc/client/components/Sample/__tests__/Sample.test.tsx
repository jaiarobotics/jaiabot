import { describe, expect, test } from "@jest/globals"
import { render } from '@testing-library/react'
import Sample from '../Sample'


test('renders sample component', () => {
    render(<Sample message="Hello, world!"/>)
})
