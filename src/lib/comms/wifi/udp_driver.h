// This file was forked from Goby on Feb 26, 2025
// Original copyright follows:
//
// Copyright 2011-2023:
//   GobySoft, LLC (2013-)
//   Massachusetts Institute of Technology (2007-2014)
//   Community contributors (see AUTHORS file)
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//
//
// This file is part of the Goby Underwater Autonomy Project Libraries
// ("The Goby Libraries").
//
// The Goby Libraries are free software: you can redistribute them and/or modify
// them under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 2.1 of the License, or
// (at your option) any later version.
//
// The Goby Libraries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with Goby.  If not, see <http://www.gnu.org/licenses/>.

#ifndef GOBY_ACOMMS_MODEMDRIVER_UDP_DRIVER_H
#define GOBY_ACOMMS_MODEMDRIVER_UDP_DRIVER_H

#include <array>   // for array
#include <cstddef> // for size_t
#include <cstdint> // for uint32_t
#include <map>     // for multimap
#include <memory>  // for unique_ptr
#include <set>     // for set

#include <boost/asio/ip/udp.hpp> // for udp, udp::endpoint

#include "goby/acomms/modemdriver/driver_base.h" // for ModemDriverBase
#include "goby/acomms/protobuf/driver_base.pb.h" // for DriverConfig
#include "goby/util/asio_compat.h"               // for io_context
#include "jaiabot/messages/udp_driver.pb.h"

extern "C"
{
    const char* goby_driver_name();
    goby::acomms::ModemDriverBase* goby_make_driver();
}

namespace boost
{
namespace system
{
class error_code;
} // namespace system
} // namespace boost

namespace goby
{
namespace acomms
{
namespace protobuf
{
class ModemTransmission;
} // namespace protobuf
} // namespace acomms
} // namespace goby

namespace jaiabot
{
namespace comms
{

class UDPDriver : public goby::acomms::ModemDriverBase
{
  public:
    UDPDriver();
    ~UDPDriver() override;

    void startup(const goby::acomms::protobuf::DriverConfig& cfg) override;
    void shutdown() override;
    void do_work() override;
    void handle_initiate_transmission(const goby::acomms::protobuf::ModemTransmission& m) override;

    void report(goby::acomms::protobuf::ModemReport* report) override;

  private:
    void start_send(const goby::acomms::protobuf::ModemTransmission& msg);
    void send_complete(const boost::system::error_code& error, std::size_t bytes_transferred);
    void start_receive();
    void receive_complete(const boost::system::error_code& error, std::size_t bytes_transferred);
    void receive_message(const goby::acomms::protobuf::ModemTransmission& m);

    const jaiabot::udp::protobuf::Config& config_extension()
    {
        return driver_cfg_.GetExtension(jaiabot::udp::protobuf::config);
    }

    // for multihub
    void update_active_hub(int hub_id, goby::acomms::protobuf::ModemTransmission* msg);
    void set_active_hub_peer(int hub_id);

  private:
    goby::acomms::protobuf::DriverConfig driver_cfg_;
    boost::asio::io_context io_context_;
    std::unique_ptr<boost::asio::ip::udp::socket> socket_;
    // modem id to endpoint
    std::multimap<int, boost::asio::ip::udp::endpoint> receivers_;
    boost::asio::ip::udp::endpoint sender_;

    // (16 bit length = 65535 - 8 byte UDP header - 20 byte IP
    static constexpr size_t UDP_MAX_PACKET_SIZE = 65507;

    std::array<char, UDP_MAX_PACKET_SIZE> receive_buffer_;

    // ids we are providing acks for, normally just our modem_id()
    std::set<unsigned> application_ack_ids_;

    std::uint32_t next_frame_{0};

    bool have_active_hub_{false};
    int active_hub_id_{-1};
    int hub_wifi_base_modem_id_{-1};
    int hub_wifi_modem_id_{-1};
};
} // namespace comms
} // namespace jaiabot
#endif
