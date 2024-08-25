#!/usr/bin/env python3
import requests
from pprint import pprint


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
show(requests.post(url, json={'testing': 1}))

show(requests.get(url))

show(requests.delete(url))

show(requests.get(url))
