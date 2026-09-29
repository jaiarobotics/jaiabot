#ifndef JAIABOT_SERIAL_MCU_H
#define JAIABOT_SERIAL_MCU_H

// helper functions for encoding/decoding messages from microcontrollers

#include <goby/middleware/protobuf/io.pb.h>

#include "jaiabot/crc/crc32.h"

namespace jaiabot::serial
{

constexpr int bits_in_byte = 8;
constexpr int bytes_in_crc32 = 4;

inline std::shared_ptr<goby::middleware::protobuf::IOData>
encode_for_mcu(const google::protobuf::Message& pb_msg)
{
    auto io_msg = std::make_shared<goby::middleware::protobuf::IOData>();
    std::string* encoded = io_msg->mutable_data();
    pb_msg.SerializeToString(encoded);

    std::uint32_t crc32_value = crc::calculate_crc32(encoded->data(), encoded->size());

    for (int i = bytes_in_crc32 - 1; i >= 0; --i)
    {
        encoded->push_back((crc32_value >> (i * bits_in_byte)) & 0xFF);
    }
    return io_msg;
}

template <typename ProtobufMessage>
ProtobufMessage decode_from_mcu(const goby::middleware::protobuf::IOData& io_msg)
{
    const auto& encoded = io_msg.data();

    if (encoded.size() < bytes_in_crc32)
        throw(std::runtime_error("Message is too small"));

    std::uint32_t computed_crc =
        crc::calculate_crc32(encoded.data(), encoded.size() - bytes_in_crc32);
    std::uint32_t provided_crc = 0;

    std::size_t i = 0;
    for (auto it = encoded.rbegin(), end = encoded.rbegin() + bytes_in_crc32; it != end; ++it, ++i)
        provided_crc |= ((*it) & 0xFF) << (i * bits_in_byte);

    if (computed_crc != provided_crc)
    {
        throw(std::runtime_error("Computed CRC (" + std::to_string(computed_crc) +
                                 ") does not equal CRC on message (" +
                                 std::to_string(provided_crc) + ")"));
    }

    ProtobufMessage pb_msg;
    pb_msg.ParseFromArray(encoded.data(), encoded.size() - bytes_in_crc32);
    return pb_msg;
}

} // namespace jaiabot::serial

#endif
