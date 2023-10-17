import requests
from pprint import *

response = requests.delete('http://localhost:40011/log/bot0_fleet1_20230504T201751')

pprint(response)
