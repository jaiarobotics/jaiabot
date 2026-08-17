// This file was forked from Goby on Feb 26, 2025
// Original copyright follows:
//
// Copyright 2012-2023:
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

#include "udp_driver.h"

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
#include <boost/bind/bind.hpp>                       // for bind_t, arg
#include <boost/function.hpp>                        // for function
#include <boost/signals2/signal.hpp>                 // for signal
#include <boost/system/error_code.hpp>               // for error_code
#include <boost/units/quantity.hpp>                  // for quantity

#include <goby/acomms/acomms_constants.h>          // for BROADCAST_ID
#include <goby/acomms/protobuf/modem_message.pb.h> // for ModemTransmi...
#include <goby/time/convert.h>                     // for SystemClock:...
#include <goby/time/system_clock.h>                // for SystemClock
#include <goby/time/types.h>                       // for MicroTime
#include <goby/util/as.h>                          // for as
#include <goby/util/asio_compat.h>                 // for io_context
#include <goby/util/binary.h>                      // for hex_encode
#include <goby/util/debug_logger.h>
#include <goby/util/protobuf/io.h> // for operator<<

#include "jaiabot/comms/comms.h"

using goby::glog;
using goby::util::hex_encode;
using namespace goby::util::logger;

jaiabot::comms::UDPDriver::UDPDriver() = default;
jaiabot::comms::UDPDriver::~UDPDriver() = default;

const char* goby_driver_name() { return "jaiabot_wifi_driver"; }
goby::acomms::ModemDriverBase* goby_make_driver() { return new jaiabot::comms::UDPDriver(); }

void jaiabot::comms::UDPDriver::startup(const goby::acomms::protobuf::DriverConfig& cfg)
{
    driver_cfg_ = cfg;


    modem_start(driver_cfg_, false);

    socket_ = std::make_unique<boost::asio::ip::udp::socket>(io_context_);
    const auto& local = config_extension().local();
    auto protocol =
        config_extension().ipv6() ? boost::asio::ip::udp::v6() : boost::asio::ip::udp::v4();
    socket_->open(protocol);
    socket_->bind(boost::asio::ip::udp::endpoint(protocol, local.port()));

    receivers_.clear();
    for (const auto& remote : config_extension().remote()) { update_remote(remote); }
    
    application_ack_ids_.clear();
    application_ack_ids_.insert(driver_cfg_.modem_id());
    // allow application acks for additional modem ids (for spoofing another ID)
    for (unsigned id : config_extension().additional_application_ack_modem_id())
        application_ack_ids_.insert(id);

    start_receive();
    io_context_.restart();
}

void jaiabot::comms::UDPDriver::update_remote(
    const jaiabot::udp::protobuf::Config::EndPoint& remote, bool clear_existing /*= false*/)
{
    auto protocol =
        config_extension().ipv6() ? boost::asio::ip::udp::v6() : boost::asio::ip::udp::v4();

    glog.is(DEBUG1) && glog << group(glog_out_group())
                            << "Resolving receiver: " << remote.ShortDebugString() << std::endl;

    boost::asio::ip::udp::resolver resolver(io_context_);
    auto endpoint_iterator = resolver.resolve(
					      protocol, remote.ip(), goby::util::as<std::string>(remote.port()),
					      boost::asio::ip::resolver_base::numeric_service);
    const boost::asio::ip::udp::endpoint& receiver = endpoint_iterator.begin()->endpoint();

    if (clear_existing)
        receivers_.erase(remote.modem_id());

    receivers_.insert(std::make_pair(remote.modem_id(), receiver));

    glog.is(DEBUG1) && glog << group(glog_out_group())
                            << "Receiver endpoint is: " << receiver.address().to_string() << ":"
                            << receiver.port() << std::endl;
}

void jaiabot::comms::UDPDriver::shutdown()
{
    io_context_.stop();
    socket_.reset();
}

void jaiabot::comms::UDPDriver::handle_initiate_transmission(
    const goby::acomms::protobuf::ModemTransmission& orig_msg)
{
    // buffer the message
    goby::acomms::protobuf::ModemTransmission msg = orig_msg;
    signal_modify_transmission(&msg);

    if (!msg.has_frame_start())
        msg.set_frame_start(next_frame_);

    if (!msg.has_max_frame_bytes())
        msg.set_max_frame_bytes(config_extension().max_frame_size());
    signal_data_request(&msg);

    glog.is(DEBUG1) && glog << group(glog_out_group())
                            << "After modification, initiating transmission with " << msg
                            << std::endl;

    next_frame_ += msg.frame_size();

    if (!(msg.frame_size() == 0 || msg.frame(0).empty()))
        start_send(msg);
}

void jaiabot::comms::UDPDriver::do_work() { io_context_.poll(); }

void jaiabot::comms::UDPDriver::receive_message(
    const goby::acomms::protobuf::ModemTransmission& orig_msg)
{
    // make a copy so we can update the hub info if necessary
    goby::acomms::protobuf::ModemTransmission msg = orig_msg;

    if (msg.type() != goby::acomms::protobuf::ModemTransmission::ACK && msg.ack_requested() &&
        application_ack_ids_.count(msg.dest()))
    {
        // make any acks
        goby::acomms::protobuf::ModemTransmission ack;
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

void jaiabot::comms::UDPDriver::start_send(const goby::acomms::protobuf::ModemTransmission& msg)
{
    // send the message
    std::string bytes;
    msg.SerializeToString(&bytes);

    glog.is(DEBUG1) && glog << group(glog_out_group())
                            << "Sending hex: " << goby::util::hex_encode(bytes) << std::endl;

    goby::acomms::protobuf::ModemRaw raw_msg;
    raw_msg.set_raw(bytes);
    signal_raw_outgoing(raw_msg);

    auto send = [&](const boost::asio::ip::udp::endpoint& receiver) {
        socket_->async_send_to(boost::asio::buffer(bytes), receiver,
                               boost::bind(&UDPDriver::send_complete, this, boost::placeholders::_1,
                                           boost::placeholders::_2));
    };

    auto broadcast_receivers = receivers_.equal_range(goby::acomms::BROADCAST_ID);
    for (auto it = broadcast_receivers.first; it != broadcast_receivers.second; ++it)
        send(it->second);

    if (msg.has_dest() && msg.dest() != goby::acomms::BROADCAST_ID)
    {
        auto directed_receivers = receivers_.equal_range(msg.dest());
        for (auto it = directed_receivers.first; it != directed_receivers.second; ++it)
            send(it->second);
    }

    signal_transmit_result(msg);
}

void jaiabot::comms::UDPDriver::send_complete(const boost::system::error_code& error,
                                              std::size_t bytes_transferred)
{
    if (error)
    {
        glog.is(DEBUG1) && glog << group(glog_out_group()) << warn
                                << "Send error: " << error.message() << std::endl;
        return;
    }

    glog.is(DEBUG1) && glog << group(glog_out_group()) << "Sent " << bytes_transferred << " bytes."
                            << std::endl;
}

void jaiabot::comms::UDPDriver::start_receive()
{
    socket_->async_receive_from(boost::asio::buffer(receive_buffer_), sender_,
                                boost::bind(&UDPDriver::receive_complete, this,
                                            boost::placeholders::_1, boost::placeholders::_2));
}

void jaiabot::comms::UDPDriver::receive_complete(const boost::system::error_code& error,
                                                 std::size_t bytes_transferred)
{
    if (error)
    {
        glog.is(DEBUG1) && glog << group(glog_in_group()) << warn
                                << "Receive error: " << error.message() << std::endl;
        start_receive();
        return;
    }

    goby::acomms::protobuf::ModemRaw raw_msg;
    raw_msg.set_raw(std::string(&receive_buffer_[0], bytes_transferred));
    signal_raw_incoming(raw_msg);

    glog.is(DEBUG1) && glog << group(glog_in_group()) << "Received " << bytes_transferred
                            << " bytes from " << sender_.address().to_string() << ":"
                            << sender_.port() << std::endl;

    goby::acomms::protobuf::ModemTransmission msg;
    msg.ParseFromArray(&receive_buffer_[0], bytes_transferred);
    receive_message(msg);

    start_receive();
}

void jaiabot::comms::UDPDriver::report(goby::acomms::protobuf::ModemReport* report)
{
    goby::acomms::ModemDriverBase::report(report);

    report->set_link_state((socket_ && socket_->is_open())
                               ? goby::acomms::protobuf::ModemReport::LINK_AVAILABLE
                               : goby::acomms::protobuf::ModemReport::LINK_NOT_AVAILABLE);

    report->set_link_quality(goby::acomms::protobuf::ModemReport::QUALITY_UNKNOWN);
}

