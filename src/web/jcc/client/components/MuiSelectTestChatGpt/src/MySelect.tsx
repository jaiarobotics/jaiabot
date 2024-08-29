// MySelect.tsx
import React, { useState } from "react";
import { Select, MenuItem, FormControl, InputLabel, SelectChangeEvent } from "@mui/material";

interface MySelectProps {
    handleChange?: (event: SelectChangeEvent) => void;
}

export function MySelect(props: MySelectProps) {
    const handleChange = props.handleChange
    const [value, setValue] = useState<string>("");

    const onChange = (event: SelectChangeEvent<string>) => {
        setValue(event.target.value);
        if (handleChange) {
            handleChange(event);
        }
    };

    return (
        <FormControl fullWidth>
            <InputLabel id="demo-simple-select-label">Age</InputLabel>
            <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                value={value}
                label="Age"
                onChange={onChange}
                data-testid="my-select"
            >
                <MenuItem value={10}>Ten</MenuItem>
                <MenuItem value={20}>Twenty</MenuItem>
                <MenuItem value={30}>Thirty</MenuItem>
            </Select>
        </FormControl>
    );
};
