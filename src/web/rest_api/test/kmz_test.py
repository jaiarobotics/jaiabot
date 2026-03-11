from google.protobuf.json_format import MessageToDict

from jaiabot.messages.rest_api_pb2 import *
from jaiabot.messages.jaia_dccl_pb2 import TaskPacket

import requests
import datetime
import os

"""A pytest script to test the KMZ generation functionality of the REST API."""

API_KEY = os.getenv('JAIA_REST_API_PRIVATE_KEY', "")
print(f'Using API key: {API_KEY}')

def utime_now():
    return int(datetime.datetime.now().timestamp() * 1e6)


def test_kmz_generation():
    # This test will make a request to the KMZ endpoint and check that it returns a non-empty byte string
    now = utime_now()
    

    api_request = APIRequest()
    api_request.target.all = True
    api_request.kmz.start_time = int(now - 7 * 24 * 60 * 60 * 1e6) # 7 days ago
    api_request.kmz.end_time = int(now)
    api_request.api_key = API_KEY

    res = requests.post('http://localhost:9092/jaia/v1', json=MessageToDict(api_request, preserving_proto_field_name=True))
    assert res.ok, f"Request failed with status code {res.status_code} and message: {res.text}"
    assert res.status_code == 200
    assert isinstance(res.content, bytes)
    assert len(res.content) > 0

    print("KMZ generation test passed, received KMZ file of size", len(res.content), "bytes")
    open('test_output.kmz', 'wb').write(res.content)


if __name__ == "__main__":
    test_kmz_generation()

