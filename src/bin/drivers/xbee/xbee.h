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

#include <map>    // for map
#include <string> // for string
#include <queue>
#include <boost/asio.hpp>   // for serial_port

#include "xbee.pb.h"

using namespace std;
typedef unsigned char byte;

// SerialNumber is an immutable value that uniquely identifies an XBee modem
//   The XBee can only address packets to serial numbers, not to the user-configurable NodeId
typedef uint64_t SerialNumber;

// NodeId is a user-configurable id for an XBee modem, which corresponds to the modem_id from Goby
typedef std::string NodeId;

// Packet structure for queuing up packets for transmit
struct Packet {
    NodeId dest;
    string data;

    Packet() { }
    Packet(const NodeId& dest, const string& data) : dest(dest), data(data) {}
};

class XBeeDevice
{
  public:
    XBeeDevice();
    void startup(const std::string& port_name, const int baud_rate, const NodeId& my_node_id,
                 const uint16_t network_id, const bool should_discover_peers);
    void shutdown();

    vector<NodeId> get_peers();

    void send_packet(const NodeId& dest, const std::string& s);

    vector<string> get_packets();

    void do_work();

    static const NodeId broadcast;

    uint16_t max_payload_size;

    // Adding a peer to the lookup table
    void add_peer(const NodeId node_id, const SerialNumber serial_number);

    // Get RSSI
    uint16_t get_rssi();
    // Query RSSI from Radio
    void query_rssi();

  private:
    static const SerialNumber broadcast_serial_number;
    
    boost::asio::io_service *io;
    boost::asio::serial_port *port;
    NodeId my_node_id;
    SerialNumber my_serial_number;
    byte frame_id;

    bool should_discover_peers = false;

    // Map of node_id onto serial number
    std::map<NodeId, SerialNumber> node_id_to_serial_number_map;
    std::map<SerialNumber, NodeId> serial_number_to_node_id_map;

    vector<string> received_packets;

    // Packet queue (for packets waiting for a serial number)
    deque<Packet> outbound_packet_queue;

    // Called during startup
    void get_my_serial_number();
    void get_maximum_payload_size();
    void broadcast_node_id();
    void network_discover();

    // Packet sending
    void _send_packet(const SerialNumber& dest, const xbee::protobuf::XBeePacket& packet);
    void send_packet(const SerialNumber& dest, const string& data);
    void send_node_id(const SerialNumber& dest, const bool xbee_address_entry_request);

    // Low level reads and writes
    void write(const std::string& raw);
    std::string read_until(const std::string& delimiter);
    size_t bytes_available();
    void read(void *ptr, const size_t n_bytes);

    // Command mode stuff
    void enter_command_mode();
    void assert_ok();
    void exit_command_mode();

    // Frame stuff
    string read_frame();

    // API mode stuff
    SerialNumber read_frame_discover_node_response(const NodeId& node_id);
    SerialNumber get_serial_number(const NodeId& node_id);

    // Processing frames
    void process_frame();
    void process_frame_if_available();
    void process_frame_extended_transmit_status(const string& response_string);
    void process_frame_at_command_response(const string& response_string);
    void process_frame_receive_packet(const string& response_string);
    void process_frame_node_identification_indicator(const string& response_string);

    // Processing queued packets
    void flush_packets_for_node(const NodeId& node_id);

    // RSSI value
    uint16_t rssi = 0;
};
#endif

