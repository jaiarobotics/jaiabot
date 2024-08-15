import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event'; // Use user-event for better interactions
import '@testing-library/jest-dom';
import TestSelectComponent from '../TestSelectComponent';
import { SelectChangeEvent } from '@mui/material';

test('should select an option', async () => {
  const handleChange = jest.fn((event: SelectChangeEvent<string>) => {
    // Mock implementation to do nothing
  });

  // Render the component with initial value and mock change handler
  render(<TestSelectComponent value="" onChange={handleChange} />);
  
  // Open the select menu
  const selectElement = screen.getByTestId('my-select');
  userEvent.selectOptions(selectElement, 'option2');
  // Verify that the handleChange function was called with the correct value
  expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({
        target: expect.objectContaining({
            value: 'option2',
        }),
    }));


  // Verify that the handleChange function was called with the correct value
  expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({
    target: expect.objectContaining({
      value: 'option2',
    }),
  }));
  
   // Verify that the select value is updated
   expect(selectElement).toHaveValue('option2');
});