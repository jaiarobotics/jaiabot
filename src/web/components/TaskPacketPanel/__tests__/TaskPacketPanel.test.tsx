import { render, screen } from "@testing-library/react";

import TaskPacketPanel from "../TaskPacketPanel";
import { TaskPackets } from "../../../data/task_packets/task-packets";
import { MapFeatureTypes } from "../../../types/openlayers-types";
import { TaskPacket } from "@proto/jaiabot/messages/jaia_dccl";

test("Shows the task packet's start and end as month/day/year", () => {
    // Thursday 29 October 2026, local time
    const startMicros = new Date(2026, 9, 29, 10, 21).getTime() * 1_000;
    const endMicros = new Date(2026, 9, 29, 10, 25).getTime() * 1_000;

    const taskPacket = {
        bot_id: 1,
        start_time: startMicros,
        end_time: endMicros,
        dive: { depth_achieved: 14, dive_rate: 1.3, bottom_dive: false },
    } as unknown as TaskPacket;
    const taskPackets = { getTaskPacket: () => taskPacket } as unknown as TaskPackets;

    render(
        <TaskPacketPanel
            taskPackets={taskPackets}
            selectedTaskPacket={{
                botID: 1,
                startTime: startMicros,
                type: MapFeatureTypes.DIVE,
            }}
        />,
    );

    expect(screen.getByText("10:21 10/29/2026")).toBeInTheDocument();
    expect(screen.getByText("10:25 10/29/2026")).toBeInTheDocument();
});
