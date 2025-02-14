#!/usr/bin/env python3

import secrets
key=secrets.token_urlsafe(16)

print('# Append to /etc/jaiabot/rest_api.pb.cfg')
print(f'''key {{ 
    private_key: "{key}"
    permission: [ALL]
}}''')
