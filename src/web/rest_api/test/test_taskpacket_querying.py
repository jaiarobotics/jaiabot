#!/usr/bin/env python3

import requests
import os
import pytest

import jaiabot.messages.rest_api_pb2 as rest_api
import google.protobuf.json_format as json_format
from jaiabot.messages.jaia_dccl_pb2 import TaskPacket

try: 
    api_key=os.environ['JAIA_REST_API_PRIVATE_KEY']
except KeyError:
    api_key=""

url = "http://127.0.0.1:9092/jaia/v1"

def run_request(request: rest_api.APIRequest) -> rest_api.APIResponse:
    print("#### REQUEST ####")
    # Attach API key from environment, if available, to the request.
    if api_key:
        request.api_key = api_key
    request_json = json_format.MessageToDict(request)
    print(request_json)

    res = requests.post(url, json=request_json)

    assert res.ok, f"Request failed with status code {res.status_code} and message {res.text}"

    print("#### RESPONSE ####")
    response = json_format.ParseDict(res.json(), rest_api.APIResponse())
    print(response)
    print("\n\n")

    assert not response.HasField("error"), f"API returned an error: {response.error}"

    return response


all_task_packets: list[TaskPacket] = []
all_bot_ids: list[int] = []
first_packet_start_time: int = 0
last_packet_start_time: int = 0


@pytest.fixture(scope="module", autouse=True)
def setup_module():
    global all_task_packets, all_bot_ids, first_packet_start_time, last_packet_start_time

    request = rest_api.APIRequest(
        target=rest_api.APIRequest.Nodes(
            all=True,
        ),
        task_packets=rest_api.TaskPacketQuery()
    )

    response = run_request(request)

    all_task_packets = list(response.task_packets.packets)
    all_bot_ids = [task_packet.bot_id for task_packet in response.task_packets.packets]
    first_packet_start_time = min([packet.start_time for packet in all_task_packets])
    last_packet_start_time = max([packet.start_time for packet in all_task_packets])

    print(f"Retrieved {len(all_task_packets)} total task packets")
    assert len(all_task_packets) > 0, "Expected at least one task packet"


def test_multibot_querying():
    if len(all_bot_ids) < 2:
        print("Not enough bots found in task packets to test multibot querying, skipping that test")
        return

    response = run_request(rest_api.APIRequest(
        target=rest_api.APIRequest.Nodes(
            bots=all_bot_ids[:2]
        ),
        task_packets=rest_api.TaskPacketQuery()
    ))

    assert len(response.task_packets.packets) > 0, "Expected at least one task packet for the specified bots"

    for packet in response.task_packets.packets:
        assert packet.bot_id in all_bot_ids[:2], f"{packet}\nTask packet bot ID does not match the specified bot IDs"

    print(f"Successfully retrieved {len(response.task_packets.packets)} task packets for bots {all_bot_ids[:2]}")


def test_time_range_filtering():
    middle_time = (first_packet_start_time + last_packet_start_time) // 2

    response = run_request(rest_api.APIRequest(
        target=rest_api.APIRequest.Nodes(
            all=True
        ),
        task_packets=rest_api.TaskPacketQuery(
            start_time=first_packet_start_time,
            end_time=middle_time
        )
    ))

    assert len(response.task_packets.packets) > 0, "Expected at least one task packet in the specified time range"

    # Account for the 1-second padding of the time querying
    ONE_SECOND = 1_000_000
    expected_range = (first_packet_start_time - ONE_SECOND, middle_time + ONE_SECOND)

    for packet in response.task_packets.packets:
        assert expected_range[0] <= packet.start_time <= expected_range[1], \
            f"{packet}\nTask packet start time {packet.start_time} is outside the specified range: {expected_range[0]} - {expected_range[1]}"

    print(f"Successfully retrieved {len(response.task_packets.packets)} task packets between {expected_range[0]} and {expected_range[1]}")


def test_mission_name_filtering():
    mission_names = set(packet.mission_name for packet in all_task_packets if packet.mission_name)
    if len(mission_names) == 0:
        print("No mission names found in task packets, skipping mission name filtering test")
        return
    
    mission_name = mission_names.pop()

    response = run_request(rest_api.APIRequest(
        target=rest_api.APIRequest.Nodes(
            all=True
        ),
        task_packets=rest_api.TaskPacketQuery(
            mission_name=[mission_name]
        )
    ))

    assert len(response.task_packets.packets) > 0, "Expected at least one task packet for the specified mission name"

    for packet in response.task_packets.packets:
        assert packet.mission_name == mission_name, f"{packet}\nTask packet mission name does not match the specified mission name"

    print(f"Successfully retrieved {len(response.task_packets.packets)} task packets for mission name '{mission_name}'")

    if len(mission_names) < 2:
        print("Not enough unique mission names found in task packets to test multiple mission name filtering, skipping that part of the test")
        return
    
    mission_name_2 = mission_names.pop()

    response = run_request(rest_api.APIRequest(
        target=rest_api.APIRequest.Nodes(
            all=True
        ),
        task_packets=rest_api.TaskPacketQuery(
            mission_name=[mission_name, mission_name_2]
        )
    ))

    assert len(response.task_packets.packets) > 0, "Expected at least one task packet for the specified mission names"

    for packet in response.task_packets.packets:
        assert packet.mission_name in [mission_name, mission_name_2], f"{packet}\nTask packet mission name does not match the specified mission names"

    print(f"Successfully retrieved {len(response.task_packets.packets)} task packets for mission names '{mission_name}' and '{mission_name_2}'")


def test_mission_summary_querying():
    first_packet_start_time = min([packet.start_time for packet in all_task_packets])
    last_packet_start_time = max([packet.start_time for packet in all_task_packets])
    middle_time = (first_packet_start_time + last_packet_start_time) // 2

    response = run_request(rest_api.APIRequest(
        target=rest_api.APIRequest.Nodes(
            all=True
        ),
        missions=rest_api.MissionQuery(
            start_time=first_packet_start_time, # Task packets are sorted descending by start time, so the last packet has the earliest start time.  This means we should get all missions that started after that time, which should be all of them.
            end_time=last_packet_start_time
        )
    ))

    assert len(response.missions.mission_summaries) > 0, "Expected at least one mission summary for bot 1"

    print(f"Successfully retrieved {len(response.missions.mission_summaries)} mission summaries for bot 1")


if __name__ == "__main__":
    setup_module()
    test_multibot_querying()
    test_time_range_filtering()
    test_mission_name_filtering()
    test_mission_summary_querying()
