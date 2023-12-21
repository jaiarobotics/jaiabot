#!/bin/bash

openssl req  -nodes -new -x509 -out cert.cer -keyout key.key -config <( cat config.cfg )

