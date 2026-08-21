#!/usr/bin/env python3

import os
import sys
from unittest import mock

# app.py lives in src/web/server, outside the pyjaia package this tests/
# directory otherwise covers. 
_SERVER_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "web", "server")
)
if _SERVER_DIR not in sys.path:
    sys.path.insert(0, _SERVER_DIR)

sys.argv = ["app.py", "localhost", "-r"]

# Importing app.py also constructs jaia_portal.Interface (opens a real socket
# and starts a background thread pinging a goby server) and MapTileServer
# (writes to /var/log/jaiabot). 
with mock.patch("jaia_portal.Interface"), mock.patch("map_tile_server.MapTileServer"):
    import app as jcc_server

client = jcc_server.app.test_client()

# Known good feature values for a supported bot type, taken from the training data.
VALID_REQUEST = {
    "bot_type": "HYDRO",
    "transit_energy_wh": 8.0837,
    "transit_time_s": 194.2,
    "turn_density_deg_per_km": 1297.7,
    "hotel_energy_wh": 2.0942,
    "dive_energy_wh": 14.3762,
    "starting_battery_pct": 94.7,
}


def test_missing_field_returns_error_not_prediction():
    body = dict(VALID_REQUEST)
    del body["dive_energy_wh"]
    response = client.post("/jaia/v0/battery-prediction", json=body)
    assert response.status_code == 400
    assert "error" in response.get_json()


def test_wrong_type_value_returns_error_not_prediction():
    body = dict(VALID_REQUEST, transit_energy_wh="not-a-number")
    response = client.post("/jaia/v0/battery-prediction", json=body)
    assert response.status_code >= 400
    assert "error" in response.get_json()


def test_well_formed_request_returns_prediction():
    response = client.post("/jaia/v0/battery-prediction", json=VALID_REQUEST)
    assert response.status_code == 200
    result = response.get_json()
    assert isinstance(result["predicted_drain_pct"], (int, float))
    assert isinstance(result["predicted_final_pct"], (int, float))


def test_untrained_bot_type_returns_error_not_prediction():
    # BIO (bot_type 3) has no samples in the training data.
    body = dict(VALID_REQUEST, bot_type="BIO")
    response = client.post("/jaia/v0/battery-prediction", json=body)
    assert response.status_code == 422
    result = response.get_json()
    assert "error" in result
    assert "predicted_drain_pct" not in result
