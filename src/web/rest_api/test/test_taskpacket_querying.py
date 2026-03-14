#!/usr/bin/env python3

import requests
import json
import datetime
import os
import argparse
from time import time

import jaiabot.messages.rest_api_pb2 as rest_api
import google.protobuf.json_format as json_format


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

    return response


def get_all_task_packets_for_bot(bot_id: int) -> rest_api.TaskPacketQueryResults:
    request = rest_api.APIRequest(
        target=rest_api.APIRequest.Nodes(
            bots=[bot_id]
        ),
        task_packets=rest_api.TaskPacketQuery()
    )

    response = run_request(request)
    return response.task_packets


all_task_packets = get_all_task_packets_for_bot(1).packets
print(f"Retrieved {len(all_task_packets)} total task packets for bot 1")
assert len(all_task_packets) > 0, "Expected at least one task packet for bot 1"


def test_time_range_filtering():
    first_packet_start_time = min([packet.start_time for packet in all_task_packets])
    last_packet_start_time = max([packet.start_time for packet in all_task_packets])
    middle_time = (first_packet_start_time + last_packet_start_time) // 2

    response = run_request(rest_api.APIRequest(
        target=rest_api.APIRequest.Nodes(
            bots=[1]
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
            bots=[1]
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
            bots=[1]
        ),
        task_packets=rest_api.TaskPacketQuery(
            mission_name=[mission_name, mission_name_2]
        )
    ))

    assert len(response.task_packets.packets) > 0, "Expected at least one task packet for the specified mission names"

    for packet in response.task_packets.packets:
        assert packet.mission_name in [mission_name, mission_name_2], f"{packet}\nTask packet mission name does not match the specified mission names"

    print(f"Successfully retrieved {len(response.task_packets.packets)} task packets for mission names '{mission_name}' and '{mission_name_2}'")


if __name__ == "__main__":
    test_time_range_filtering()
    test_mission_name_filtering()

