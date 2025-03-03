// Jaia
import { JaiaContextProvider } from "../context/Jaia/JaiaContext";

// Style
import "./App.less";
import Map from "../components/Map/Map";
import NodeList from "../containers/NodeList/NodeList";
import TopButtonList from "../components/TopButtonList/TopButtonList";
import SideButtonList from "../components/SideButtonList/SideButtonList";
import HubDetails from "../containers/HubDetails/HubDetails";
import MissionsPanel from "../containers/MissionsPanel/MissionsPanel";

/**
 * The root of the JCC interface
 */
export default function App() {
    return (
        <div id="jcc">
            <JaiaContextProvider>
                <Map />
                <NodeList />
                <TopButtonList />
                <SideButtonList />
                <HubDetails />
                <MissionsPanel />
            </JaiaContextProvider>
        </div>
    );
}
