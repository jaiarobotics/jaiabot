import requests

response = requests.post('http://localhost:40011/convert-if-needed', json=['bot5_fleet1_20230712T182543'])

print(response.json())
