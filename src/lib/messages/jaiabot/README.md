# jaiabot/messages symlink

This directory and symlink needs to exist so that the relative source path ("jaiabot/messages") for Protobuf messages is identical to the relative include/import path of the generated .protos, as `protoc` embeds this information into the generated code, and we will get an compiler error message.