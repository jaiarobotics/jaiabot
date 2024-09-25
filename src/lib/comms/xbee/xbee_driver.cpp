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
    std::string encryption_password = config_extension().xbee_encryption_password();
    std::string tx_power_level = config_extension().xbee_tx_power_level();
    std::string rf_data_rate = config_extension().xbee_rf_data_rate();
    std::string mesh_unicast_retries = config_extension().xbee_mesh_unicast_retries();
    std::string unicast_mac_retries = config_extension().xbee_unicast_mac_retries();
    std::string network_delay_slots = config_extension().xbee_network_delay_slots();
    std::string broadcast_multi_transmits = config_extension().xbee_broadcast_multi_transmits();

    device_.startup(driver_cfg_.serial_port(), driver_cfg_.serial_baud(),
                    encode_modem_id(driver_cfg_.modem_id()), network_id, xbee_info_location,
                    use_encryption, encryption_password, tx_power_level, rf_data_rate,
                    mesh_unicast_retries, unicast_mac_retries, network_delay_slots,
                    broadcast_multi_transmits);

    for (auto peer : config_extension().peers())
    {
        // For backwards compatibility with previously deployed fleets
        if (peer.has_node_id())
        {
            glog.is_warn() && glog << group(glog_out_group())
                                   << "Deprecated 'node_id' field in peers {} table: Use 'bot_id' "
                                      "or 'hub_id' instead"
                                   << std::endl;
            device_.add_peer(peer.node_id(), peer.serial_number());
        }
        else if (peer.has_bot_id())
        {
            device_.add_peer(std::to_string(jaiabot::comms::modem_id_from_bot_id(peer.bot_id())),
                             peer.serial_number());
        }
        else if (peer.has_hub_id())
        {
            hub_peers_[peer.hub_id()] = peer;

            if (config_extension().has_hub_id() &&
                peer.hub_id() ==
                    config_extension().hub_id()) // if this is a hub, add itself as the active hub
            {
                device_.add_peer(std::to_string(jaiabot::comms::hub_modem_id),
                                 peer.serial_number());
            }
        }
    }

    goby::acomms::protobuf::ModemTransmission init_hub_info;
    auto& hub_info =
        *init_hub_info.MutableExtension(jaiabot::protobuf::transmission)->mutable_hub();
    if (!read_hub_info_file(hub_info))
    {
        glog.is_debug1() && glog << "No valid hub info file yet, will wait for hub to subscribe."
                                 << std::endl;
    }
    else
    {
        glog.is_verbose() && glog << "Initializing hub info with: " << hub_info.ShortDebugString()
                                  << std::endl;

        set_active_hub_peer(hub_info.hub_id());
        signal_receive(init_hub_info);
    }
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
    if (msg.dest() == jaiabot::comms::hub_modem_id && !have_active_hub_)
    {
        glog.is_warn() && glog << group(glog_out_group())
                               << "Cannot send message to hub since we do not yet know which hub "
                                  "is active (waiting on hub broadcast)"
                               << std::endl;
    }
    else if (!(msg.frame_size() == 0 || msg.frame(0).empty()))
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
    if (config_extension().has_hub_id())
        packet.set_hub_id(config_extension().hub_id());

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

        if (packet->has_hub_id())
            update_active_hub(packet->hub_id(), out);

        return true;
    }
    catch (const std::exception& e)
    {
        glog.is_warn() && glog << group(glog_out_group())
                               << "Cannot parse modem message: " << e.what() << std::endl;
        return false;
    }
}

void jaiabot::comms::XBeeDriver::update_active_hub(int hub_id,
                                                   goby::acomms::protobuf::ModemTransmission* out)
{
    auto& hub_info = *out->MutableExtension(jaiabot::protobuf::transmission)->mutable_hub();
    hub_info.set_hub_id(hub_id);
    hub_info.set_modem_id(jaiabot::comms::hub_modem_id);

    if (!have_active_hub_ || active_hub_id_ != hub_id)
    {
        glog.is_verbose() && glog << group(glog_in_group())
                                  << "Updating active hub to hub_id: " << hub_id << std::endl;
        hub_info.set_changed(true);

        if (!write_hub_info_file(hub_info))
            glog.is_warn() && glog << "Could not write hub info to: "
                                   << config_extension().hub_info_location() << std::endl;

        set_active_hub_peer(hub_id);
    }
}

bool jaiabot::comms::XBeeDriver::read_hub_info_file(jaiabot::protobuf::HubInfo& hub_info)
{
    const char* hub_info_file = config_extension().hub_info_location().c_str();
    const int read_fd = open(hub_info_file, O_RDONLY);
    if (read_fd < 0)
        return false;

    google::protobuf::io::FileInputStream hub_info_is(read_fd);
    const bool success = google::protobuf::TextFormat::Parse(&hub_info_is, &hub_info);
    return success;
}

bool jaiabot::comms::XBeeDriver::write_hub_info_file(const jaiabot::protobuf::HubInfo& hub_info)
{
    const char* hub_info_file = config_extension().hub_info_location().c_str();
    const int write_fd = open(hub_info_file, O_WRONLY | O_TRUNC | O_CREAT, 0600);
    if (write_fd < 0)
        return false;

    google::protobuf::io::FileOutputStream hub_info_os(write_fd);
    const bool success = google::protobuf::TextFormat::Print(hub_info, &hub_info_os);
    return success;
}

void jaiabot::comms::XBeeDriver::set_active_hub_peer(int hub_id)
{
    active_hub_id_ = hub_id;
    have_active_hub_ = true;

    bool is_bot = !config_extension().has_hub_id();
    if (is_bot) // for bots, swap the serial number corresponding to the new active hub
    {
        auto hub_peer_it = hub_peers_.find(hub_id);
        if (hub_peer_it != hub_peers_.end())
        {
            device_.add_peer(std::to_string(jaiabot::comms::hub_modem_id),
                             hub_peer_it->second.serial_number());
        }
        else
        {
            glog.is_warn() &&
                glog << group(glog_in_group())
                     << "Failed to update active hub as we have no mapping for hub_id: " << hub_id
                     << " in the peers {} table" << std::endl;
        }
    }
}
