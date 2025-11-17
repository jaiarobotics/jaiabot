#!/usr/bin/env python3

from pyjaia.logtools import *
from jaiabot.messages.jaia_dccl_pb2 import BotStatus
from google.protobuf.json_format import MessageToDict


def test_read_series():
    log = JaiaLogH5('test.h5')
    series = log.read_series('jaiabot::bot_status;15/jaiabot.protobuf.BotStatus/mission_state')
    assert len(series.y_values) > 0


def test_read_objects():
    log = JaiaLogH5('test.h5')
    objects = log.read_protobuf_objects('jaiabot::bot_status;15/jaiabot.protobuf.BotStatus', protobuf_message_name=BotStatus)
    # for object in objects:
    #     print(MessageToDict(object, preserving_proto_field_name=True))

    print(objects[0])

    print(f'Loaded {len(objects)} objects')
    assert len(objects) > 0
    assert isinstance(objects[0], BotStatus)


def test_read_array():
    log = JaiaLogH5('test.h5')
    array = log.read_array('jaiabot::metadata;15/jaiabot.protobuf.DeviceMetadata/jaiabot_version/patch', is_string=True)
    print(array)
    assert len(array) > 0


if __name__ == '__main__':
    test_read_array()
    test_read_series()
    test_read_objects()
    print('All tests passed!')
