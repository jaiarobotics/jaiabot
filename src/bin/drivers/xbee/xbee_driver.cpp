// Copyright 2012-2021:
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

#include "xbee_driver.h"

#include <list>    // for operator!=
#include <memory>  // for unique_ptr
#include <ostream> // for basic_ostream
#include <string>  // for string, oper...
#include <utility> // for pair, make_pair

#include <boost/asio/basic_datagram_socket.hpp>      // for basic_datagr...
#include <boost/asio/buffer.hpp>                     // for buffer, muta...
#include <boost/asio/ip/address.hpp>                 // for address
#include <boost/asio/ip/basic_endpoint.hpp>          // for basic_endpoint
#include <boost/asio/ip/basic_resolver.hpp>          // for basic_resolv...
#include <boost/asio/ip/basic_resolver_entry.hpp>    // for basic_resolv...
#include <boost/asio/ip/basic_resolver_iterator.hpp> // for basic_resolv...
#include <boost/bind.hpp>                            // for bind_t, arg
#include <boost/function.hpp>                        // for function
#include <boost/signals2/signal.hpp>                 // for signal
#include <boost/system/error_code.hpp>               // for error_code
#include <boost/units/quantity.hpp>                  // for quantity

#include "goby/acomms/acomms_constants.h"          // for BROADCAST_ID
#include "goby/acomms/protobuf/modem_message.pb.h" // for ModemTransmi...
#include "goby/acomms/protobuf/udp_driver.pb.h"    // for Config, Conf...
#include "goby/time/convert.h"                     // for SystemClock:...
#include "goby/time/system_clock.h"                // for SystemClock
#include "goby/time/types.h"                       // for MicroTime
#include "goby/util/as.h"                          // for as
#include "goby/util/asio_compat.h"                 // for io_context
#include "goby/util/binary.h"                      // for hex_encode
#include "goby/util/debug_logger.h"
#include "goby/util/protobuf/io.h" // for operator<<

using goby::glog;
using goby::util::hex_encode;
using namespace goby::util::logger;
using namespace goby::acomms;

goby::acomms::XBeeDriver::XBeeDriver() = default;
goby::acomms::XBeeDriver::~XBeeDriver() = default;

const char* goby_driver_name() { return "xbee_driver"; }
goby::acomms::ModemDriverBase* goby_make_driver() { return new XBeeDriver(); }

string encode_modem_id(const int32_t modem_id) {
    if (modem_id == BROADCAST_ID) {
        return XBeeDevice::broadcast;
    }
    else {
        return goby::util::as<string>(modem_id);
    }
}

int32_t decode_modem_id(const string& modem_id) {
    if (modem_id == XBeeDevice::broadcast) {
        return BROADCAST_ID;
    }
    else {
        return goby::util::as<int32_t>(modem_id);
    }
}


void goby::acomms::XBeeDriver::startup(const protobuf::DriverConfig& cfg)
{
    driver_cfg_ = cfg;

    application_ack_ids_.clear();
    application_ack_ids_.insert(driver_cfg_.modem_id());
    auto config_extension = driver_cfg_.GetExtension(xbee::protobuf::config);
    auto network_id = config_extension.network_id();
    auto discover_peers = config_extension.discover_peers();

    device_.startup(driver_cfg_.serial_port(), driver_cfg_.serial_baud(),
                    encode_modem_id(driver_cfg_.modem_id()), network_id, discover_peers);

    for (auto peer : config_extension.peers())
    { device_.add_peer(peer.node_id(), peer.serial_number()); }
}

void goby::acomms::XBeeDriver::shutdown()
{
    glog.is_warn() && glog << "Shutting down modem" << endl;
    device_.shutdown();
}

void goby::acomms::XBeeDriver::handle_initiate_transmission(
    const protobuf::ModemTransmission& orig_msg)
{
    // buffer the message
    protobuf::ModemTransmission msg = orig_msg;
    signal_modify_transmission(&msg);

    if (!msg.has_frame_start())
        msg.set_frame_start(next_frame_);

    msg.set_max_frame_bytes(device_.max_payload_size - 40);
    msg.set_max_num_frames(1);

    signal_data_request(&msg);

    glog.is_debug1() && glog << group(glog_out_group())
                            << "After modification, initiating transmission with " << msg
                            << std::endl;

    next_frame_ += msg.frame_size();

    if (!(msg.frame_size() == 0 || msg.frame(0).empty()))
        start_send(msg);
}

void goby::acomms::XBeeDriver::do_work() {
    device_.do_work();

    auto now = goby::time::SystemClock::now<goby::time::MicroTime>();

    auto config_extension = driver_cfg_.GetExtension(xbee::protobuf::config);
    auto test_comms = config_extension.test_comms();
    auto query_rssi = config_extension.query_rssi();
    auto test_comm_period = config_extension.test_comm_period();

    if (test_comms)
    {
        auto test_comms_dest_id = config_extension.test_comms_dest_id();
        auto test_comms_com_dest_id = config_extension.test_comms_com_dest_id();
        auto test_comms_time_now = goby::time::SteadyClock::now();

        if (test_comm_last_sent_ + std::chrono::seconds(test_comm_period) < test_comms_time_now)
        {
            glog.is_debug2() && glog << group(glog_in_group())
                                     << "Sending Test packet to node: " << test_comms_dest_id
                                     << ", Command dest is set to node: " << test_comms_com_dest_id
                                     << std::endl;
            device_.send_test_links(encode_modem_id(test_comms_dest_id),
                                    encode_modem_id(test_comms_com_dest_id));
            test_comm_last_sent_ = test_comms_time_now;
        }
    }

    if (query_rssi)
    {
        device_.query_rssi();
    }

    // // Deal with incoming packets
    for (auto packet: device_.get_packets()) {
        protobuf::ModemRaw raw_msg;
        raw_msg.set_raw(packet);
        signal_raw_incoming(raw_msg);

        protobuf::ModemTransmission msg;
        msg.ParseFromArray(&packet[0], packet.size());

        glog.is_debug2() && glog << group(glog_in_group()) << "Received " << packet.size()
                                 << " bytes from " << msg.src() << std::endl;

        receive_message(msg);
    }
}

void goby::acomms::XBeeDriver::receive_message(const protobuf::ModemTransmission& msg)
{
    if (msg.type() != protobuf::ModemTransmission::ACK && msg.ack_requested() &&
        application_ack_ids_.count(msg.dest()))
    {
        // make any acks
        protobuf::ModemTransmission ack;
        ack.set_type(goby::acomms::protobuf::ModemTransmission::ACK);
        ack.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
        ack.set_src(msg.dest());
        ack.set_dest(msg.src());
        for (int i = msg.frame_start(), n = msg.frame_size() + msg.frame_start(); i < n; ++i)
            ack.add_acked_frame(i);
        start_send(ack);
    }

    signal_receive(msg);
}

void goby::acomms::XBeeDriver::start_send(const protobuf::ModemTransmission& msg)
{
    // send the message
    std::string bytes;
    msg.SerializeToString(&bytes);

    glog.is_debug1() && glog << group(glog_out_group())
                            << "Sending hex: " << goby::util::hex_encode(bytes) << std::endl;

    protobuf::ModemRaw raw_msg;
    raw_msg.set_raw(bytes);
    signal_raw_outgoing(raw_msg);

    if (msg.has_dest())
    {
        device_.send_packet(encode_modem_id(msg.dest()), bytes);
    }

    signal_transmit_result(msg);
}
