import sys
from pathlib import Path

path = str(Path().absolute())

print("Path: ", path)

sys.path.append(path)
 
from app import app as application
