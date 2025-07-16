import json
import time
import requests
import os

url_base = "https://testing.havocai.net"

# Maps bot_id to the returned HAVOC boat resource ID
bot_id_to_boat_id = {}

# Sample boat template
sample_boat = '''{
          "meta": {
            "kind": 4,
            "name": "jaia0"
          },
          "team": {
            "kind": 3,
            "name": "third-party"
          },
          "type": 1,
          "status": {
            "position": {
              "location": {
                "latitude": 0,
                "longitude": 0
              }
            },
            "heading": 0
          }
        }
    '''

def make_backend_request(
    url: str, json_payload: str, request_type: str = "POST"
) -> str:
    """Make a backend put/post/patch request to update resources in backend. Requires that
        HAVOC_BACKEND_SERVICE_TOKEN environment variable is set to the appropriate bearer token.

    Args:
        url (str): URL to submit request to
        json_payload (str): JSON payload
        request_type (str): "PUT"/"PATCH"/"POST"/"DELETE"

    Returns:
        str: Value returned from REST api call
    """

    if "HAVOC_BACKEND_SERVICE_TOKEN" not in os.environ:
        print("No auth token set in HAVOC_BACKEND_SERVICE_TOKEN")
        return ""
    auth_token = os.environ["HAVOC_BACKEND_SERVICE_TOKEN"]

    try:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {auth_token}",
        }

        req = request_type.lower()
        response = requests.Response()
        if req == "post":
            response = requests.post(url, data=json_payload, headers=headers)
        elif req == "put":
            response = requests.put(url, data=json_payload, headers=headers)
        elif req == "patch":
            response = requests.patch(url, data=json_payload, headers=headers)
        elif req == "delete":
            response = requests.delete(url, data=json_payload, headers=headers)

        # Check response status
        if (
            response.status_code != 200
            and response.status_code != 201
            and response.status_code != 204
        ):
            print(
                f"Server responded with status: {response.status_code} {response.reason}"
            )
            return ""
        return response.json()

    except requests.RequestException as e:
        print(f"Failed to send request: {e}")
        return
    
def post_boatstatus_havoc_request(boat_status, bot_id):
    response_data = make_backend_request(
        f"{url_base}/api/v0/boat",
        json.dumps(boat_status),
        "POST",
    )
    if not response_data:
        print("Failed to create boat resource.")
        return

    boat_id = response_data.get("meta", {}).get("id")
    if not boat_id:
        print("Could not get ID from created boat resource.")
        return

    print(f"Boat created with ID: {boat_id}")

    bot_id_to_boat_id[bot_id] = boat_id


def patch_boatstatus_havoc_request(boat_status, boat_id):
    boat_url = f"{url_base}/api/v0/boat/{boat_id}"

    make_backend_request(
        boat_url, json.dumps(boat_status), "PATCH"
    )

def send_bot_status_to_havoc(bot_status):
    bot_id = bot_status.get("bot_id")
    location = bot_status.get("location", {})
    heading = bot_status.get("heading", 0)

    if "lat" not in location or "lon" not in location:
        print(f"Skipping bot {bot_id} – missing location data")
        return

    boat_status = json.loads(sample_boat)
    boat_status["meta"]["name"] = f"jaia{bot_id}"
    boat_status["status"]["position"]["location"]["latitude"] = location["lat"]
    boat_status["status"]["position"]["location"]["longitude"] = location["lon"]
    boat_status["status"]["heading"] = heading        

    if bot_id in bot_id_to_boat_id:
        patch_boatstatus_havoc_request(boat_status, bot_id_to_boat_id[bot_id])
    else:
        post_boatstatus_havoc_request(boat_status, bot_id)
