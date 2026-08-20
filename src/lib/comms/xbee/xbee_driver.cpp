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
#include <boost/bind/bind.hpp>                       // for bind_t, arg
#include <boost/function.hpp>                        // for function
#include <boost/signals2/signal.hpp>                 // for signal
#include <boost/system/error_code.hpp>               // for error_code
#include <boost/units/quantity.hpp>                  // for quantity

#include <google/protobuf/io/zero_copy_stream_impl.h>
#include <google/protobuf/text_format.h>

#include "goby/acomms/acomms_constants.h"          // for BROADCAST_ID
#include "goby/acomms/protobuf/modem_message.pb.h" // for ModemTransmi...
#include "goby/acomms/protobuf/udp_driver.pb.h"    // for Config, Conf...
#include "goby/middleware/marshalling/dccl.h"
#include "goby/time/convert.h"      // for SystemClock:...
#include "goby/time/system_clock.h" // for SystemClock
#include "goby/time/types.h"        // for MicroTime
#include "goby/util/as.h"           // for as
#include "goby/util/asio_compat.h"  // for io_context
#include "goby/util/binary.h"       // for hex_encode
#include "goby/util/debug_logger.h"
#include "goby/util/protobuf/io.h" // for operator<<

#include "jaiabot/comms/comms.h"
#include "jaiabot/messages/link.pb.h"

using goby::glog;
using goby::util::hex_encode;
using namespace goby::util::logger;
using namespace goby::acomms;

jaiabot::comms::XBeeDriver::XBeeDriver() = default;
jaiabot::comms::XBeeDriver::~XBeeDriver() = default;

const char* goby_driver_name() { return "xbee_driver"; }
goby::acomms::ModemDriverBase* goby_make_driver() { return new jaiabot::comms::XBeeDriver(); }

std::string encode_modem_id(const int32_t modem_id)
{
    if (modem_id == BROADCAST_ID)
    {
        return jaiabot::comms::XBeeDevice::broadcast;
    }
    else
    {
        return goby::util::as<std::string>(modem_id);
    }
}

int32_t decode_modem_id(const std::string& modem_id)
{
    if (modem_id == jaiabot::comms::XBeeDevice::broadcast)
    {
        return BROADCAST_ID;
    }
    else
    {
        return goby::util::as<int32_t>(modem_id);
    }
}

void jaiabot::comms::XBeeDriver::startup(const goby::acomms::protobuf::DriverConfig& cfg)
{
    driver_cfg_ = cfg;

    application_ack_ids_.clear();
    application_ack_ids_.insert(driver_cfg_.modem_id());
    auto network_id = config_extension().network_id();
    test_comms_ = config_extension().test_comms();
    auto xbee_info_location = config_extension().xbee_info_location();
    bool use_encryption = config_extension().use_xbee_encryption();
    bool is_in_sim = config_extension().is_in_sim();
    std::string encryption_password = config_extension().xbee_encryption_password();
    std::string mesh_unicast_retries = config_extension().xbee_mesh_unicast_retries();
    std::string unicast_mac_retries = config_extension().xbee_unicast_mac_retries();
    std::string network_delay_slots = config_extension().xbee_network_delay_slots();
    std::string broadcast_multi_transmits = config_extension().xbee_broadcast_multi_transmits();

    hub_xbee_base_modem_id_ = jaiabot::comms::hub_base_modem_id;
    hub_xbee_modem_id_ = jaiabot::comms::hub_modem_id(config_extension().subnet_mask(),
                                                      jaiabot::protobuf::LINK_XBEE);
    // if simulation, add XBee to Simulated XBee Network
    if (is_in_sim)
    {
        std::string create_cmd = "CREATE " + driver_cfg_.serial_port().substr(5);
        int fd = socket(AF_UNIX, SOCK_STREAM, 0);
        if (fd == -1)
        {
            perror("socket");
            return;
        }

        sockaddr_un addr{};
        addr.sun_family = AF_UNIX;
        strcpy(addr.sun_path, "/tmp/sxbsim.sock");

        const int retries = 5;
        int retry_count = 0;
        while (connect(fd, (sockaddr*)&addr, sizeof(addr)) == -1 && retry_count < retries)
        {
            if (errno == ENOENT || errno || ECONNREFUSED)
            {
                std::this_thread::sleep_for(std::chrono::milliseconds(500));
                ++retry_count;
            }
            else
            {
                perror("connect");
                close(fd);
                return;
            }
        }

        ssize_t bytes_sent = write(fd, create_cmd.c_str(), create_cmd.size());
        if (bytes_sent != static_cast<ssize_t>(create_cmd.size())) {
            perror("write");
        }
        
        char buffer[512];
        ssize_t bytes_read = read(fd, buffer, sizeof(buffer));
        // Blocks until response.

        close(fd);
    }

    device_.startup(driver_cfg_.serial_port(), driver_cfg_.serial_baud(),
                    encode_modem_id(driver_cfg_.modem_id()), network_id, xbee_info_location,
                    use_encryption, encryption_password, mesh_unicast_retries, unicast_mac_retries,
                    network_delay_slots, broadcast_multi_transmits, config_extension().fleet_id(),
                    config_extension().subnet_mask());
}

void jaiabot::comms::XBeeDriver::shutdown()
{
    glog.is_warn() && glog << group(glog_out_group()) << "Shutting down modem" << std::endl;
    device_.shutdown();
}

void jaiabot::comms::XBeeDriver::handle_initiate_transmission(
    const goby::acomms::protobuf::ModemTransmission& orig_msg)
{
    // buffer the message
    goby::acomms::protobuf::ModemTransmission msg = orig_msg;
    signal_modify_transmission(&msg);

    if (!msg.has_frame_start())
        msg.set_frame_start(next_frame_);

    static const int max_frame_bytes = xbee::protobuf::XBeePacket::descriptor()
                                           ->FindFieldByName("data")
                                           ->options()
                                           .GetExtension(dccl::field)
                                           .max_length();

    static const int max_num_frames = 1;
    msg.set_max_frame_bytes(max_frame_bytes);
    msg.set_max_num_frames(max_num_frames);

    signal_data_request(&msg);

    glog.is_debug1() && glog << group(glog_out_group())
                             << "After modification, initiating transmission with " << msg
                             << std::endl;

    static const int max_frame_counter = xbee::protobuf::XBeePacket::descriptor()
                                             ->FindFieldByName("frame_start")
                                             ->options()
                                             .GetExtension(dccl::field)
                                             .max();

    if (!(msg.frame_size() == 0 || msg.frame(0).empty()))
    {
        next_frame_ += msg.frame_size();
        if (next_frame_ > max_frame_counter)
            next_frame_ = 0;

        send_time_[msg.dest()] = goby::time::SteadyClock::now();
        number_of_bytes_to_send_ = msg.frame(0).size();
        glog.is_debug1() && glog << group(glog_out_group()) << "Start Send At: "
                                 << send_time_.at(msg.dest()).time_since_epoch().count()
                                 << ", Msg Size: " << number_of_bytes_to_send_ << std::endl;
        start_send(msg);
    }
}

void jaiabot::comms::XBeeDriver::do_work()
{
    device_.do_work();

    auto now = goby::time::SystemClock::now<goby::time::MicroTime>();

    auto test_comms = config_extension().test_comms();

    // // Deal with incoming packets
    for (auto packet : device_.get_packets())
    {
        goby::acomms::protobuf::ModemRaw raw_msg;
        raw_msg.set_raw(packet);
        signal_raw_incoming(raw_msg);

        goby::acomms::protobuf::ModemTransmission msg;
        if (parse_modem_message(packet, &msg))
        {
            glog.is_debug2() && glog << group(glog_in_group()) << "Received " << packet.size()
                                     << " bytes from " << msg.src() << std::endl;
            receive_message(msg);
        }
        else
        {
            glog.is_warn() && glog << group(glog_in_group()) << "Failed to parse incoming message"
                                   << std::endl;
        }

        if (test_comms_)
        {
            device_.send_diagnostic_commands();
        }
    }
}

void jaiabot::comms::XBeeDriver::receive_message(
    const goby::acomms::protobuf::ModemTransmission& msg)
{
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
    else if (msg.type() == goby::acomms::protobuf::ModemTransmission::ACK)
    {
        auto now = goby::time::SteadyClock::now();
        glog.is_debug1() && glog << group(glog_out_group())
                                 << "Received Ack At: " << now.time_since_epoch().count()
                                 << std::endl;
        if (test_comms_)
        {
            if (send_time_.count(msg.src()))
            {
                auto total_time = (now.time_since_epoch().count() -
                                   send_time_.at(msg.src()).time_since_epoch().count()) /
                                  1e+6;

                glog.is_verbose() &&
                    glog << group(glog_out_group())
                         << "Start Send at: " << send_time_.at(msg.src()).time_since_epoch().count()
                         << ", Received Ack At: " << now.time_since_epoch().count()
                         << ", Total Time in Seconds: " << total_time
                         << ", Total Bytes Sent: " << number_of_bytes_to_send_ << std::endl;
            }
        }
    }

    signal_receive(msg);
}

void jaiabot::comms::XBeeDriver::start_send(const goby::acomms::protobuf::ModemTransmission& msg)
{
    // send the message
    std::string bytes;

    try
    {
        serialize_modem_message(&bytes, msg);
    }
    catch (const std::exception& e)
    {
        glog.is_warn() && glog << group(glog_out_group())
                               << "Cannot serialize message: " << e.what() << std::endl;
        return;
    }

    glog.is_debug1() && glog << group(glog_out_group()) << "Sending hex (" << bytes.size()
                             << "B): " << goby::util::hex_encode(bytes) << std::endl;

    goby::acomms::protobuf::ModemRaw raw_msg;
    raw_msg.set_raw(bytes);
    signal_raw_outgoing(raw_msg);

    if (msg.has_dest())
    {
        device_.send_packet(encode_modem_id(msg.dest()), bytes);
    }

    signal_transmit_result(msg);
}

void jaiabot::comms::XBeeDriver::serialize_modem_message(
    std::string* out, const goby::acomms::protobuf::ModemTransmission& in)
{
    xbee::protobuf::XBeePacket packet;
    packet.set_src(in.src());
    packet.set_dest(in.dest());
    packet.set_type(in.type());
    if (in.has_ack_requested())
        packet.set_ack_requested(in.ack_requested());
    if (in.has_frame_start())
        packet.set_frame_start(in.frame_start());
    if (in.acked_frame_size())
        packet.set_acked_frame(in.acked_frame(0));

    if (in.frame_size())
        packet.set_data(in.frame(0));

    std::vector<char> packet_bytes = goby::middleware::SerializerParserHelper<
        xbee::protobuf::XBeePacket, goby::middleware::MarshallingScheme::DCCL>::serialize(packet);

    const int ID_SIZE = 2;
    *out = std::string(packet_bytes.begin() + ID_SIZE, packet_bytes.end());
}

std::string _create_header_bytes()
{
    // cache the DCCL ID bytes for use on receive
    xbee::protobuf::XBeePacket packet;
    packet.set_src(0);
    packet.set_dest(0);
    packet.set_type(goby::acomms::protobuf::ModemTransmission::DATA);
    const int ID_SIZE = 2;
    std::vector<char> bytes = goby::middleware::SerializerParserHelper<
        xbee::protobuf::XBeePacket,
        goby::middleware::MarshallingScheme::MarshallingScheme::DCCL>::serialize(packet);
    return std::string(bytes.begin(), bytes.begin() + ID_SIZE);
}

bool jaiabot::comms::XBeeDriver::parse_modem_message(std::string in,
                                                     goby::acomms::protobuf::ModemTransmission* out)
{
    try
    {
        static const std::string header_id_bytes = _create_header_bytes();
        std::string bytes = header_id_bytes + in;
        std::string::iterator actual_end;

        std::shared_ptr<xbee::protobuf::XBeePacket> packet =
            goby::middleware::SerializerParserHelper<
                xbee::protobuf::XBeePacket,
                goby::middleware::MarshallingScheme::DCCL>::parse(bytes.begin(), bytes.end(),
                                                                  actual_end);
        out->set_src(packet->src());
        out->set_dest(packet->dest());
        out->set_type(packet->type());
        if (packet->has_ack_requested())
            out->set_ack_requested(packet->ack_requested());

        if (packet->has_frame_start())
            out->set_frame_start(packet->frame_start());

        if (packet->has_acked_frame())
            out->add_acked_frame(packet->acked_frame());

        if (packet->has_data())
            out->add_frame(packet->data());

        return true;
    }
    catch (const std::exception& e)
    {
        glog.is_warn() && glog << group(glog_out_group())
                               << "Cannot parse modem message: " << e.what() << std::endl;
        return false;
    }
}
