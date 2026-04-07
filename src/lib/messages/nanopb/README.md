# nanopb directory and symlinks

This directory and symlinks need to exist so that the relative source path ("nanopb/jaiabot/messages", "nanopb/google/protobuf", "nanopb/dccl:) for Protobuf messages is identical to the relative include/import path of the generated .protos, as `protoc` embeds this information into the generated code, and we will get an compiler error message. CMake creates `dccl` and `google` subdirectories so that these external .proto files can be built using the same relative path.
