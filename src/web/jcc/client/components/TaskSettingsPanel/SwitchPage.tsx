import React, { useState } from "react";
import Typography from "@mui/material/Typography";
import { Switch } from "@mui/material";
import { Box } from "@mui/system";
// example from https://github.com/pham-andrew/MUItesting.com
// orignal in javascript, trying to get ot work in typescript
export default function SwitchPage() {
    const [state, setState] = useState(false);

    return (
        <>
            <Typography variant="h4" sx={{ margin: 2 }}>
                Switch
            </Typography>
            <Box sx={{ margin: 2 }}>
                {/* 👀 */}
                <Switch onChange={() => setState(!state)} />
                <br />
                {state.toString()}
                {/* 🙈 */}
            </Box>
        </>
    );
}
