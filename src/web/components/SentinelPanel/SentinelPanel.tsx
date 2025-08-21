import { Intercept, Track } from "../../types/protobuf-types";

interface Props {
    tracks: Track[];
    intercepts: Intercept[];
}

export default function SentinelPanel(props: Props) {
    return <div id="sentinel"></div>;
}
