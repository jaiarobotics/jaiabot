// React
import React from "react";

// Jaia
import { GlobalContextProvider } from "../context/Global/GlobalContext";
import { HubContextProvider } from "../context/Hub/HubContext";
import { BotContextProvider } from "../context/Bot/BotContext";
import { CommandControlWrapper } from "../containers/CommandControl/CommandControl";

export default function App() {
    return (
        <div>
            <GlobalContextProvider>
                <HubContextProvider>
                    <BotContextProvider>
                        <CommandControlWrapper />
                    </BotContextProvider>
                </HubContextProvider>
            </GlobalContextProvider>
        </div>
    );
}
