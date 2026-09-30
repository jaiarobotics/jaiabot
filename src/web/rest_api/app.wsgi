import sys
import os
from pathlib import Path

path = str(Path().absolute())

print("Path: ", path)

sys.path.append(path)

# Callers are authenticated by Authelia in front of the API, not by a key of its own
os.environ['JAIA_REST_API_PRIVATE_KEY'] = ""

from app import app as application
