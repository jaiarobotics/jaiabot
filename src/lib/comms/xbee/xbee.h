// Copyright 2011-2021:
//   GobySoft, LLC (2013-)
//   Massachusetts Institute of Technology (2007-2014)
//   Community contributors (see AUTHORS file)
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Ed Sanville <edsanville@gmail.com>
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

#ifndef XBEE_H
#define XBEE_H

#include <boost/asio.hpp> // for serial_port
#include <map>            // for map
#include <queue>
#include <string> // for string

// basic file operations
#include <fstream>
#include <iostream>

#include <functional>

#include "xbee.pb.h"

namespace jaiabot
{
namespace comms
{
typedef unsigned char byte;

// SerialNumber is an immutable value that uniquely identifies an XBee modem
//   The XBee can only address packets to serial numbers, not to the user-configurable NodeId
typedef uint64_t SerialNumber;

// NodeId is a user-configurable id for an XBee modem, which corresponds to the modem_id from Goby
typedef std::string NodeId;

// Packet structure for queuing up packets for transmit
struct Packet
{
    NodeId dest;
    std::string data;

    Packet() {}
    Packet(const NodeId& dest, const std::string& data) : dest(dest), data(data) {}
};

class XBeeDevice
{
  public:
    XBeeDevice();
    void startup(const std::string& port_name, const int baud_rate, const NodeId& my_node_id,
                 const uint16_t network_id, const std::string& xbee_info_location,
                 const bool& use_encryption, const std::string& encryption_password,
                 const std::string& mesh_unicast_retries,
                 const std::string& unicast_mac_retries,
                 const std::string& network_delay_slots,
                 const std::string& broadcast_multi_transmits);
    void shutdown();

    std::vector<NodeId> get_peers();

    void send_packet(const NodeId& dest, const std::string& s);
    void send_test_links(const NodeId& dest, const NodeId& com_dest);

    std::vector<std::string> get_packets();

    void do_work();

    static const NodeId broadcast;

    uint16_t max_payload_size;

    // Adding a peer to the lookup table
    void add_peer(const NodeId node_id, const SerialNumber serial_number);

    // Get Diagnostics
    void send_diagnostic_commands();

  private:
    static const SerialNumber broadcast_serial_number;

    std::shared_ptr<boost::asio::io_context> io;
    boost::asio::serial_port* port;
    NodeId my_node_id;
    SerialNumber my_serial_number;
    byte frame_id;
    std::string glog_group;

    // Map of node_id onto serial number
    std::map<NodeId, SerialNumber> node_id_to_serial_number_map;
    std::map<SerialNumber, NodeId> serial_number_to_node_id_map;

    std::vector<std::string> received_packets;

    // Called during startup
    void get_my_serial_number();
    void get_maximum_payload_size();
    void broadcast_node_id();

    // Packet sending
    void send_packet(const SerialNumber& dest, const std::string& data);

    // Low level reads and writes
    void write(const std::string& raw);
    std::string read_until(const std::string& delimiter);
    size_t bytes_available();
    void read(void* ptr, const size_t n_bytes);
    void async_read_with_timeout(std::string& buffer, const std::string& delimiter,
                                 int timeout_seconds,
                                 std::function<void(const std::string&)> handler);
    
    // Convert string to hex
    std::string convertToHex(const std::string& str);

    // Command mode stuff
    void enter_command_mode();
    void assert_ok();
    void exit_command_mode();

    // Frame stuff
    std::string read_frame();

    // API mode stuff
    SerialNumber read_frame_discover_node_response(const NodeId& node_id);
    SerialNumber get_serial_number(const NodeId& node_id);
    std::string api_transmit_request(const SerialNumber& dest, const byte frame_id, const byte* ptr,
                                     const size_t length);
    std::string api_explicit_transmit_request(const SerialNumber& dest,
                                              const SerialNumber& com_dest, const byte frame_id);
    // Processing frames
    void process_frame();
    void process_frame_if_available();
    void process_frame_extended_transmit_status(const std::string& response_string);
    void process_frame_at_command_response(const std::string& response_string);
    void process_frame_receive_packet(const std::string& response_string);
    void process_frame_node_identification_indicator(const std::string& response_string);
    void process_frame_explicit_rx_indicator(const std::string& response_string);

    // Query RSSI from Radio
    void query_rssi();
    // Query Received Error Count
    void query_er();
    // Query Received Good Count
    void query_gd();
    // Query Bytes Transmitted
    void query_bc();
    // Query Transmission Failure Count
    void query_tr();

    // Check if we received diagnostics
    bool received_rssi_{false};
    bool received_er_{false};
    bool received_gd_{false};
    bool received_bc_{false};
    bool received_tr_{false};

    // RSSI fields
    uint16_t current_rssi_{0};
    uint16_t history_rssi_{0};
    int rssi_query_count_{1};
    uint16_t max_rssi_{0};
    uint16_t min_rssi_{150};
    uint16_t average_rssi_{0};

    // Bytes Transmitted
    uint32_t bytes_transmitted_{0};

    // Received Error Count
    uint16_t received_error_count_{0};

    // Received Good Count
    uint16_t received_good_count_{0};

    // Transmission Failure Count
    uint16_t transmission_failure_count_{0};

    std::string my_xbee_info_location_{""};
};
} // namespace comms
} // namespace jaiabot

#endif
