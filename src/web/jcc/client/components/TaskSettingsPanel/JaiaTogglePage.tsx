import React, { useState } from "react";
import Typography from "@mui/material/Typography";
import JaiaToggle from "../JaiaToggle";
import { Box } from "@mui/system";
// Use SwitchPage example to build a JaiToggle test
// onChange, currently has a type issue
export default function JaiaTogglePage() {
    const [state, setState] = useState(false);

    return (
        <>
            <Typography variant="h4" sx={{ margin: 2 }}>
                Switch
            </Typography>
            <Box sx={{ margin: 2 }}>
                {/* 👀 */}
                <JaiaToggle onClick={() => setState(!state)}
                            checked={() => state} />
                <br />
                {state.toString()}
                {/* 🙈 */}
            </Box>
        </>
    );
}
