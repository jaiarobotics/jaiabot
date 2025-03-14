
#ifndef JAIABOT_SERIAL_CRC32_H
#define JAIABOT_SERIAL_CRC32_H

#include <boost/asio.hpp>
#include <string>

#include "goby/middleware/io/detail/io_interface.h"     // for PubSubLayer
#include "goby/middleware/io/detail/serial_interface.h" // for SerialThread
#include "jaiabot/messages/nanopb/feather.pb.h"

#include "crc32.h"

using crc::calculate_crc32;

namespace goby
{
namespace middleware
{
class Group;
}
} // namespace goby
namespace goby
{
namespace middleware
{
namespace protobuf
{
class SerialConfig;
}
} // namespace middleware
} // namespace goby

namespace jaiabot
{
namespace serial
{
constexpr const char* SERIAL_MAGIC = "JAIA";
constexpr int SERIAL_MAGIC_BYTES = 4;
constexpr int SIZE_BYTES = 2;
constexpr int BITS_IN_BYTE = 8;
constexpr auto SERIAL_MAX_SIZE = 2048; // Can be increased, just for safety
constexpr auto CRC_SIZE = 4;

static const std::shared_ptr<goby::middleware::protobuf::IOData>
encode_frame(const std::string& data)
{
    std::uint16_t size = data.length();
    std::string size_str = {static_cast<char>((size >> jaiabot::serial::BITS_IN_BYTE) & 0xFF),
                            static_cast<char>(size & 0xFF)};

    auto crc = calculate_crc32(data.c_str(), size);
    char crc_data[4];
    for (int i = 0; i < 4; i++) { crc_data[i] = ((char*)&crc)[3 - i]; }

    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    io_data->set_data(std::string(SERIAL_MAGIC, SERIAL_MAGIC_BYTES) + size_str +
                      string(crc_data, 4) + data);

    return io_data;
}

static const std::string decode_frame(const std::string& frame_data)
{
    const auto HEADER_LENGTH = SERIAL_MAGIC_BYTES + SIZE_BYTES + CRC_SIZE;
    auto size = frame_data.length() - HEADER_LENGTH;

    if (size >= 0)
    {
        return frame_data.substr(HEADER_LENGTH, size);
    }
    else
    {
        return "";
    }
}

/// \brief Reads/Writes message packages from/to serial port
/// \tparam line_in_group goby::middleware::Group to publish to after receiving data from the serial port
/// \tparam line_out_group goby::middleware::Group to subcribe to for data to send to the serial port
template <const goby::middleware::Group& line_in_group,
          const goby::middleware::Group& line_out_group,
          goby::middleware::io::PubSubLayer publish_layer =
              goby::middleware::io::PubSubLayer::INTERPROCESS,
          goby::middleware::io::PubSubLayer subscribe_layer =
              goby::middleware::io::PubSubLayer::INTERTHREAD,
          template <class> class ThreadType = goby::middleware::SimpleThread,
          bool use_indexed_groups = false>
class SerialThreadCRC32
    : public goby::middleware::io::detail::SerialThread<line_in_group, line_out_group,
                                                        publish_layer, subscribe_layer, ThreadType,
                                                        use_indexed_groups>
{
    using Base =
        goby::middleware::io::detail::SerialThread<line_in_group, line_out_group, publish_layer,
                                                   subscribe_layer, ThreadType, use_indexed_groups>;

  public:
    SerialThreadCRC32(const goby::middleware::protobuf::SerialConfig& config, int index = -1)
        : Base(config, index)
    {
    }

    ~SerialThreadCRC32() {}

  private:
    void async_read() override
    {
        buffer_write_ptr_ = buffer_.data();
        read_first_byte();
    }

    void read_first_byte()
    {
        boost::asio::async_read(
            this->mutable_serial_port(),
            boost::asio::buffer(buffer_write_ptr_,
                                buffer_.size() - (buffer_write_ptr_ - buffer_.data())),
            boost::asio::transfer_exactly(1),
            [this](const boost::system::error_code& ec, std::size_t bytes_transferred) {
                if (!ec && bytes_transferred > 0)
                {
                    if (buffer_[0] != SERIAL_MAGIC[0])
                    {
                        goby::glog.is_warn() &&
                            goby::glog << "Invalid first byte, expected: " << SERIAL_MAGIC[0]
                                       << ", received: " << buffer_[0] << std::endl;
                        this->async_read();
                    }
                    else
                    {
                        buffer_write_ptr_ += bytes_transferred;
                        read_magic();
                    }
                }
                else
                {
                    this->handle_read_error(ec);
                }
            });
    }

    void read_magic()
    {
        boost::asio::async_read(
            this->mutable_serial_port(),
            boost::asio::buffer(buffer_write_ptr_,
                                buffer_.size() - (buffer_write_ptr_ - buffer_.data())),
            boost::asio::transfer_exactly(SERIAL_MAGIC_BYTES - 1),
            [this](const boost::system::error_code& ec, std::size_t bytes_transferred) {
                if (!ec && bytes_transferred > 0)
                {
                    if (memcmp(buffer_.data(), SERIAL_MAGIC, SERIAL_MAGIC_BYTES) != 0)
                    {
                        goby::glog.is_warn() &&
                            goby::glog
                                << "Invalid magic word, expected: " << SERIAL_MAGIC
                                << ", received: "
                                << std::string(buffer_.data(), buffer_.data() + SERIAL_MAGIC_BYTES)
                                << std::endl;
                        this->async_read();
                    }
                    else
                    {
                        buffer_write_ptr_ += bytes_transferred;
                        read_size();
                    }
                }
                else
                {
                    this->handle_read_error(ec);
                }
            });
    }

    void read_size()
    {
        boost::asio::async_read(
            this->mutable_serial_port(),
            boost::asio::buffer(buffer_write_ptr_,
                                buffer_.size() - (buffer_write_ptr_ - buffer_.data())),
            boost::asio::transfer_exactly(SIZE_BYTES),
            [this](const boost::system::error_code& ec, std::size_t bytes_transferred) {
                if (!ec && bytes_transferred > 0)
                {
                    message_size_ = 0;
                    message_size_ |= buffer_[SERIAL_MAGIC_BYTES];
                    message_size_ <<= BITS_IN_BYTE;
                    message_size_ |= buffer_[SERIAL_MAGIC_BYTES + 1];
                    if (message_size_ > SERIAL_MAX_SIZE)
                    {
                        goby::glog.is_warn() &&
                            goby::glog
                                << "Reported message size is larger than SERIAL_MAX_SIZE. Reported:"
                                << message_size_ << ", expected max: " << SERIAL_MAX_SIZE
                                << std::endl;

                        this->async_read();
                    }
                    else
                    {
                        buffer_write_ptr_ += bytes_transferred;
                        read_crc32();
                    }
                }
                else
                {
                    this->handle_read_error(ec);
                }
            });
    }

    void read_crc32()
    {
        boost::asio::async_read(
            this->mutable_serial_port(),
            boost::asio::buffer(buffer_write_ptr_,
                                buffer_.size() - (buffer_write_ptr_ - buffer_.data())),
            boost::asio::transfer_exactly(CRC_SIZE),
            [this](const boost::system::error_code& ec, std::size_t bytes_transferred) {
                if (!ec && bytes_transferred > 0)
                {
                    crc32_ = 0;
                    char* ptr = reinterpret_cast<char*>(&crc32_);

                    // Manually construct the integer from the byte array
                    for (int i = 0; i < 4; i++) { ptr[3 - i] = buffer_write_ptr_[i]; }

                    buffer_write_ptr_ += bytes_transferred;
                    read_body();
                }
                else
                {
                    this->handle_read_error(ec);
                }
            });
    }

    void read_body()
    {
        boost::asio::async_read(
            this->mutable_serial_port(),
            boost::asio::buffer(buffer_write_ptr_,
                                buffer_.size() - (buffer_write_ptr_ - buffer_.data())),
            boost::asio::transfer_exactly(message_size_),
            [this](const boost::system::error_code& ec, std::size_t bytes_transferred) {
                if (!ec && bytes_transferred > 0)
                {
                    auto actual_crc32 = calculate_crc32(buffer_write_ptr_, bytes_transferred);

                    if (crc32_ != actual_crc32)
                    {
                        goby::glog.is_warn() &&
                            goby::glog << "message_size_: " << message_size_
                                       << ", bytes_transferred: " << bytes_transferred
                                       << ", expected crc32: " << crc32_
                                       << ", actual_crc32: " << actual_crc32 << std::endl;

                        goby::glog.is_warn() && goby::glog << "CRC32 failure.  Expected: " << crc32_
                                                           << ", actual: " << actual_crc32
                                                           << std::endl;

                        this->async_read();
                    }

                    buffer_write_ptr_ += bytes_transferred;

                    auto io_msg = std::make_shared<goby::middleware::protobuf::IOData>();
                    io_msg->set_data(std::string(buffer_.data(), buffer_write_ptr_));
                    this->handle_read_success(buffer_write_ptr_ - buffer_.data(), io_msg);
                    this->async_read();
                }
                else
                {
                    this->handle_read_error(ec);
                }
            });
    }

  private:
    std::array<char, SERIAL_MAX_SIZE> buffer_;
    char* buffer_write_ptr_{buffer_.data()};
    std::uint16_t message_size_{0};
    std::uint32_t crc32_{0};
};

} // namespace serial
} // namespace jaiabot

#endif
