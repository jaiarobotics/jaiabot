import React from 'react';
import { MenuItem, Select, FormControl, InputLabel, SelectChangeEvent } from '@mui/material';

interface TestSelectComponentProps {
  value: string;
  onChange: (event: SelectChangeEvent<string>) => void;
}

const TestSelectComponent: React.FC<TestSelectComponentProps> = ({ value, onChange }) => (
  <FormControl>
    <InputLabel id="select-label">Options</InputLabel>
    <Select
      native={true}
      labelId="select-label"
      value={value}
      onChange={onChange}
      data-testid="my-select"
    >
      <option value="option1">Option 1</option>
      <option value="option2">Option 2</option>
      <option value="option3">Option 3</option>
    </Select>
  </FormControl>
);

export default TestSelectComponent;