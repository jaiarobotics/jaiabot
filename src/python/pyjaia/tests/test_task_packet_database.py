#!/usr/bin/env python3

from pyjaia.task_packet_database import TaskPacketDatabase


db = TaskPacketDatabase()

results = db.query_task_packets()

print(results)
print(len(results))
