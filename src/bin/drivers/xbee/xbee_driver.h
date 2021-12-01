// Copyright 2011-2021:
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

#include "xbee.h"

#include <array>    // for array
#include <cstddef>  // for size_t
#include <cstdint>  // for uint32_t
#include <map>      // for multimap
#include <memory>   // for unique_ptr
#include <set>      // for set

#include "goby/acomms/modemdriver/driver_base.h" // for ModemDriverBase
#include "goby/acomms/protobuf/driver_base.pb.h" // for DriverConfig

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

class XBeeDriver : public ModemDriverBase
{
  public:
    XBeeDriver();
    ~XBeeDriver() override;

    void startup(const protobuf::DriverConfig& cfg) override;
    void shutdown() override;
    void do_work() override;
    void handle_initiate_transmission(const protobuf::ModemTransmission& m) override;

  private:
    void start_send(const protobuf::ModemTransmission& msg);
    void send_complete(const boost::system::error_code& error, std::size_t bytes_transferred);
    void start_receive();
    void receive_complete(const boost::system::error_code& error, std::size_t bytes_transferred);
    void receive_message(const protobuf::ModemTransmission& m);

  private:
    protobuf::DriverConfig driver_cfg_;

    XBeeDevice device_;

    // ids we are providing acks for, normally just our modem_id()
    std::set<unsigned> application_ack_ids_;

    std::uint32_t next_frame_{0};
};
} // namespace acomms
} // namespace goby
#endif
