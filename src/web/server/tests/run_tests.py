#!/usr/bin/env python3
import geojson.utils
import requests
from pprint import pprint
import geojson


def show(response: requests.Response):
    print('==================')

    print('Request:')
    pprint(f'{response.request.method} {response.request.url}')
    if response.request.body is not None:
        print(response.request.body)

    print('-------------------')
    print('Response:')
    print(response.status_code, response.reason)
    try:
        pprint(response.json())
    except requests.exceptions.JSONDecodeError:
        print(response.content)


url = 'http://localhost:40001/jaia/v0/annotations'


pointFeature = geojson.Feature(1, geometry=geojson.utils.generate_random('Point'), properties={
    'title': 'Tada!',
    'marker-size': 'large',
    'marker-color': 'green',
    'data': {
        'depth': 50000,
        'salinity': 10
    }
})

show(requests.post(url, json=pointFeature))

show(requests.get(url))
