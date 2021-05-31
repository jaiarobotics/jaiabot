
#ifndef JAIABOT_LORA_SERIAL_H
#define JAIABOT_LORA_SERIAL_H

#include <boost/asio.hpp>

#include "goby/middleware/io/detail/io_interface.h"     // for PubSubLayer
#include "goby/middleware/io/detail/serial_interface.h" // for SerialThread
#include "jaiabot/messages/nanopb/feather.pb.h"

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
namespace lora
{
constexpr const char* SERIAL_MAGIC = "JAIA";
constexpr int SERIAL_MAGIC_BYTES = 4;
constexpr int SIZE_BYTES = 2;
constexpr int BITS_IN_BYTE = 8;
constexpr auto SERIAL_MAX_SIZE = SERIAL_MAGIC_BYTES + SIZE_BYTES + 1ul
                                 << (SIZE_BYTES * BITS_IN_BYTE);

/// \brief Reads/Writes LoRa Adafruit feather message packages from/to serial port
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
class SerialThreadLoRaFeather
    : public goby::middleware::io::detail::SerialThread<line_in_group, line_out_group,
                                                        publish_layer, subscribe_layer, ThreadType,
                                                        use_indexed_groups>
{
    using Base =
        goby::middleware::io::detail::SerialThread<line_in_group, line_out_group, publish_layer,
                                                   subscribe_layer, ThreadType, use_indexed_groups>;

  public:
    SerialThreadLoRaFeather(const goby::middleware::protobuf::SerialConfig& config, int index = -1)
        : Base(config, index)
    {
    }

    ~SerialThreadLoRaFeather() {}

  private:
    void async_read() override;

    void read_first_byte();
    void read_magic();
    void read_size();
    void read_body();

  private:
    std::array<char, SERIAL_MAX_SIZE> buffer_;
    char* buffer_write_ptr_{buffer_.data()};
    std::uint16_t message_size_{0};
};
} // namespace lora
} // namespace jaiabot

template <const goby::middleware::Group& line_in_group,
          const goby::middleware::Group& line_out_group,
          goby::middleware::io::PubSubLayer publish_layer,
          goby::middleware::io::PubSubLayer subscribe_layer, template <class> class ThreadType,
          bool use_indexed_groups>
void jaiabot::lora::SerialThreadLoRaFeather<line_in_group, line_out_group, publish_layer,
                                            subscribe_layer, ThreadType,
                                            use_indexed_groups>::async_read()
{
    buffer_write_ptr_ = buffer_.data();
    read_first_byte();
}

template <const goby::middleware::Group& line_in_group,
          const goby::middleware::Group& line_out_group,
          goby::middleware::io::PubSubLayer publish_layer,
          goby::middleware::io::PubSubLayer subscribe_layer, template <class> class ThreadType,
          bool use_indexed_groups>
void jaiabot::lora::SerialThreadLoRaFeather<line_in_group, line_out_group, publish_layer,
                                            subscribe_layer, ThreadType,
                                            use_indexed_groups>::read_first_byte()
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

template <const goby::middleware::Group& line_in_group,
          const goby::middleware::Group& line_out_group,
          goby::middleware::io::PubSubLayer publish_layer,
          goby::middleware::io::PubSubLayer subscribe_layer, template <class> class ThreadType,
          bool use_indexed_groups>
void jaiabot::lora::SerialThreadLoRaFeather<line_in_group, line_out_group, publish_layer,
                                            subscribe_layer, ThreadType,
                                            use_indexed_groups>::read_magic()
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
                            << "Invalid magic word, expected: " << SERIAL_MAGIC << ", received: "
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

template <const goby::middleware::Group& line_in_group,
          const goby::middleware::Group& line_out_group,
          goby::middleware::io::PubSubLayer publish_layer,
          goby::middleware::io::PubSubLayer subscribe_layer, template <class> class ThreadType,
          bool use_indexed_groups>
void jaiabot::lora::SerialThreadLoRaFeather<line_in_group, line_out_group, publish_layer,
                                            subscribe_layer, ThreadType,
                                            use_indexed_groups>::read_size()
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
                message_size_ << BITS_IN_BYTE;
                message_size_ |= buffer_[SERIAL_MAGIC_BYTES + 1];
                if (message_size_ > jaiabot_protobuf_LoRaMessage_size)
                {
                    goby::glog.is_warn() && goby::glog
                                                << "Reported message size is larger than Protobuf "
                                                   "LoraMessage maximum size. Reported:"
                                                << message_size_ << ", expected max: "
                                                << jaiabot_protobuf_LoRaMessage_size << std::endl;

                    this->async_read();
                }
                else
                {
                    buffer_write_ptr_ += bytes_transferred;
                    read_body();
                }
            }
            else
            {
                this->handle_read_error(ec);
            }
        });
}

template <const goby::middleware::Group& line_in_group,
          const goby::middleware::Group& line_out_group,
          goby::middleware::io::PubSubLayer publish_layer,
          goby::middleware::io::PubSubLayer subscribe_layer, template <class> class ThreadType,
          bool use_indexed_groups>
void jaiabot::lora::SerialThreadLoRaFeather<line_in_group, line_out_group, publish_layer,
                                            subscribe_layer, ThreadType,
                                            use_indexed_groups>::read_body()
{
    boost::asio::async_read(
        this->mutable_serial_port(),
        boost::asio::buffer(buffer_write_ptr_,
                            buffer_.size() - (buffer_write_ptr_ - buffer_.data())),
        boost::asio::transfer_exactly(message_size_),
        [this](const boost::system::error_code& ec, std::size_t bytes_transferred) {
            if (!ec && bytes_transferred > 0)
            {
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

#endif
