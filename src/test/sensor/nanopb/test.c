#include "jaiabot/messages/sensor/sensor_core.pb.h"
#include <stdio.h>

// static test that these messages are a fixed size
#ifndef jaiabot_sensor_protobuf_SensorRequest_size
#error jaiabot_sensor_protobuf_SensorRequest is not a fixed size message
#endif

#ifndef jaiabot_sensor_protobuf_SensorData_size
#error jaiabot_sensor_protobuf_SensorData is not a fixed size message
#endif

int main()
{
    printf("Max Size of SensorRequest: %d\n", jaiabot_sensor_protobuf_SensorRequest_size);
    printf("Max Size of SensorData: %d\n", jaiabot_sensor_protobuf_SensorData_size);
}
