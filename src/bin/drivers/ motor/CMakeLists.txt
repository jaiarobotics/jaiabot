syntax = "proto2";

import "goby/middleware/protobuf/app_config.proto";
import "goby/zeromq/protobuf/interprocess_config.proto";
import "goby/middleware/protobuf/udp_config.proto";

package jaiabot.config;

message MotorDriver
{
    // required parameters for ApplicationBase3 class
    optional goby.middleware.protobuf.AppConfig app = 1;
    optional goby.zeromq.protobuf.InterProcessPortalConfig interprocess = 2;
    required goby.middleware.protobuf.UDPPointToPointConfig udp_config = 3;
}