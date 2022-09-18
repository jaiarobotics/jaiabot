#include "xbee.h"
#include "goby/util/debug_logger.h"
#include <boost/algorithm/string.hpp>
#include <boost/endian/conversion.hpp>
#include <iostream>

using goby::glog;

#define DEBUG 0

using namespace boost::algorithm;
using namespace std;
using namespace boost::asio;
using namespace boost::endian;
using xbee::protobuf::XBeePacket;

// Frame types

const byte frame_type_at_command_response = 0x88;
const byte frame_type_extended_transmit_status = 0x8b;
const byte frame_type_receive_packet = 0x90;
const byte frame_type_explicit_rx_indicator = 0x91;

// Utilities

// XBee frame checksum calculator
//   https://www.digi.com/resources/documentation/Digidocs/90002173/#tasks/t_calculate_checksum.htm?TocPath=Operate%2520in%2520API%2520mode%257C_____4

byte checksum(const string& data) {
    byte sum = 0;
    for (byte c: data) {
        sum += c;
    }
    return 0xff - sum;
}

// Hexadecimal representation string, for debugging only

string hexadecimal(const string& raw) {
    stringstream o;
    o << std::hex << "{ ";
    for (byte c: raw) {
        o << int(c) << "  ";
    }
    o << " }";
    return o.str();
}

// frame_data function encapsulates packet_data into a raw data frame for writing to the serial port
//   https://www.digi.com/resources/documentation/Digidocs/90002173/#reference/r_api_frame_format_900hp.htm?TocPath=Operate%2520in%2520API%2520mode%257C_____2

string frame_data(const string& packet_data) {
    string s(3, ' ');
    s[0] = 0x7e;

    uint16_t packet_length = native_to_big(uint16_t(packet_data.size()));
    s[1] = ((char *)&packet_length)[0];
    s[2] = ((char *)&packet_length)[1];
    s += packet_data;
    s += checksum(packet_data);
    return s;
}

// The XBee's broadcast address is described here:
//   https://www.digi.com/resources/documentation/Digidocs/90002173/#tasks/t_transmit_broadcast.htm?TocPath=Networking%2520methods%257C_____4
const NodeId XBeeDevice::broadcast = "BROADCAST";
const SerialNumber XBeeDevice::broadcast_serial_number = native_to_big((SerialNumber) 0x000000000000FFFF);

XBeeDevice::XBeeDevice()
{
    io = new io_service();
    port = new serial_port(*io);
}

void XBeeDevice::startup(const std::string& port_name, const int baud_rate,
                         const std::string& _my_node_id, const uint16_t network_id,
                         const bool p_should_discover_peers)
{
    my_node_id = _my_node_id;
    should_discover_peers = p_should_discover_peers;

    port->open(port_name);
    port->set_option(serial_port_base::baud_rate(baud_rate));

    // Setup the modem
    enter_command_mode();

    // Set the three configuration parameters, so we're on the same network as other XBee modems
    {
        stringstream cmd;
        cmd << "ATRE" << '\r';
        write(cmd.str());
        assert_ok();
    }

    {
        stringstream cmd;
        cmd << "ATHP=00" << '\r';
        write(cmd.str());
        assert_ok();
    }

    {
        stringstream cmd;
        glog.is_verbose() && glog << "Network ID: " << setw(4) << network_id << endl;
        cmd << "ATID=" << setw(4) << network_id << '\r';
        write(cmd.str());
        assert_ok();
    }

    {
        // Set the node_id to the modem_id
        stringstream cmd;
        cmd << "ATNI" << my_node_id << '\r';
        write(cmd.str());
        assert_ok();
    }

    {
        // Set modem to API mode (packets instead of a plain serial port)
        stringstream cmd;
        cmd << "ATAP=1" << '\r';
        write(cmd.str());
        assert_ok();
    }

    {
        stringstream cmd;
        cmd << "ATAO=0" << '\r';
        write(cmd.str());
        assert_ok();
    }

    exit_command_mode();

    get_maximum_payload_size();

    query_rssi();

    get_my_serial_number();

    do_work();

    return;
} // startup

void XBeeDevice::shutdown() {
    // Setup the modem
    glog.is_verbose() && glog << "Shutting down xbee modem, returning to transparent mode" << endl;

    enter_command_mode();

    {
        // Set to another value, so it doesn't interfere with active bots
        stringstream cmd;
        cmd << "ATID=0001" << '\r';
        write(cmd.str());
        assert_ok();
    }

    {
        // Set the node_id to blank
        stringstream cmd;
        cmd << "ATNIunused\r";
        write(cmd.str());
        assert_ok();
    }

    {
        // Set modem to transparent mode
        stringstream cmd;
        cmd << "ATAP=0\r";
        write(cmd.str());
        assert_ok();
    }
    {
        // Set API Options
        stringstream cmd;
        cmd << "ATAO=0\r";
        write(cmd.str());
        assert_ok();
    }

    exit_command_mode();    
    port->close();
}

void XBeeDevice::get_maximum_payload_size() {
    // Send ND command
    string cmd = string("\x08") + *((char *) &frame_id) + string("NP");
    write(frame_data(cmd));
    frame_id++;
}

/*
DB (Last Packet RSSI)
This command applies to the XBee/XBee-PRO SX RF Module.
Reports the RSSI in -dBm of the last received RF data packet. DB returns a hexadecimal value for the -
dBm measurement.
For example, if DB returns 0x60, then the RSSI of the last packet received was -96 dBm.
The RSSI measurement is accurate within ±2 dB from approximately -50 dBm down to sensitivity.
DB only indicates the signal strength of the last hop. It does not provide an accurate quality
measurement for a multihop link.
If the XBee/XBee-PRO SX RF Module has been reset and has not yet received a packet, DB reports 0.
This value is volatile—the value does not persist in the device's memory after a power-up sequence.

Parameter range
0x28 - 0x6E (-40 dBm to -110 dBm) [read-only]
Default
0
*/
void XBeeDevice::query_rssi()
{
    // Send DB command
    string cmd = string("\x08") + *((char*)&frame_id) + string("DB");
    write(frame_data(cmd));
    frame_id++;
}

/*
ER (Receive Count Error)

This command applies to the XBee/XBee-PRO SX RF Module.
This count increments when a device receives a packet that contains integrity errors of some sort.
When the number reaches 0xFFFF, the firmware does not count further events.
To reset the counter to any 16-bit value, append a hexadecimal parameter to the command. This
value is volatile (the value does not persist in the device's memory after a power-up sequence).
Occasionally random noise can cause this value to increment.

The ER parameter is not reset by pin, serial port or cyclic sleep modes.
Default
N/A
*/
void XBeeDevice::query_er()
{
    // Send DB command
    string cmd = string("\x08") + *((char*)&frame_id) + string("ER");
    write(frame_data(cmd));
    frame_id++;
}

/*
GD (Good Packets Received)
This command applies to the XBee/XBee-PRO SX RF Module.
This count increments when a device receives a good frame with a valid MAC header on the RF
interface. Received MAC ACK packets do not increment this counter. Once the number reaches 0xFFFF,
it does not count further events.
To reset the counter to any 16-bit unsigned value, append a hexadecimal parameter to the command.
This value is volatile (the value does not persist in the device's memory after a power-up sequence).

Parameter range
0 - 0xFFFF
Default
N/A
*/
void XBeeDevice::query_gd()
{
    // Send DB command
    string cmd = string("\x08") + *((char*)&frame_id) + string("GD");
    write(frame_data(cmd));
    frame_id++;
}

/*
BC (Bytes Transmitted)

The number of RF bytes transmitted. The firmware counts bytes in every retry and retransmission. A
packet includes not only the payload, but also the preamble, the MAC header, the network header, the
application header, encryption overhead, and the CRC. The purpose of this count is to estimate
battery life by tracking time spent performing transmissions.
BC stops counting when it reaches a max value of 0xffffFFFF. But, you can reset the counter to any
32-bit value—for example 0—by appending a hexadecimal parameter to the command.

Parameter range
0 - 0xFFFFFFFF
Default
N/A (0 after reset)
*/
void XBeeDevice::query_bc()
{
    // Send DB command
    string cmd = string("\x08") + *((char*)&frame_id) + string("BC");
    write(frame_data(cmd));
    frame_id++;
}

/*
TR (Transmission Failure Count)
This command applies to the XBee/XBee-PRO SX RF Module.
This value is volatile—the value does not persist in the device's memory after a power-up sequence.

Parameter range
0 - 0xFFFF
Default
N/A
*/
void XBeeDevice::query_tr()
{
    // Send DB command
    string cmd = string("\x08") + *((char*)&frame_id) + string("TR");
    write(frame_data(cmd));
    frame_id++;
}

void XBeeDevice::send_diagnostic_commands()
{
    query_rssi();
    query_er();
    query_gd();
    query_bc();
    query_tr();
}

void XBeeDevice::get_my_serial_number() {
    string cmd = string("\x08") + *((char *) &frame_id) + string("SH");
    write(frame_data(cmd));
    frame_id++;

    string cmd2 = string("\x08") + *((char *) &frame_id) + string("SL");
    write(frame_data(cmd2));
    frame_id++;
}

void XBeeDevice::write(const string& raw) {
    // Write data
    port->write_some(buffer(raw.c_str(), raw.size()));
    glog.is_debug2() && glog << "Wrote: " << raw << endl;
    glog.is_debug2() && glog << "  hex: " << hexadecimal(raw) << endl;
}

string XBeeDevice::read_until(const string& delimiter) {
    string data;
    glog.is_debug2() && glog << "read_until: " << delimiter << endl;
    boost::asio::read_until(*port, dynamic_buffer(data), delimiter);
    glog.is_debug2() && glog << "read_until completed with: " << delimiter << endl;
    return data;
}

void XBeeDevice::read(void *ptr, const size_t n_bytes) {
    boost::asio::read(*port, buffer(ptr, n_bytes));
}

size_t XBeeDevice::bytes_available() {
    int n_bytes_available;
    if (-1 == ::ioctl(port->lowest_layer().native_handle(),
                     FIONREAD, &n_bytes_available))
    {
        boost::system::error_code error = boost::system::error_code(errno,
         boost::asio::error::get_system_category());
        glog.is_warn() && glog << "ERROR: " << error.message() << endl;
        return 0;
    }
    return size_t(n_bytes_available);
}


void XBeeDevice::enter_command_mode() {
    write("+++");
    sleep(1);
    // Read until we get the OK, in case some binary data comes through and interferes
    read_until("OK\r");
}

void XBeeDevice::assert_ok() {
    string input_line = read_until("\r");
    trim(input_line);
    if (input_line != "OK") {
        glog.is_warn() && glog << "ERROR, expecting OK, modem response: " << input_line << endl;
    }
    assert(input_line == "OK");
}

void XBeeDevice::exit_command_mode() {
    write("ATCN\r");
    sleep(1);
    // Read until we get the OK, in case some binary data comes through and interferes
    read_until("OK\r");
}

vector<NodeId> XBeeDevice::get_peers() {
    vector<NodeId> peers;

    for (auto peer: node_id_to_serial_number_map) {
        peers.push_back(peer.first);
    }

    return peers;
}


string XBeeDevice::read_frame() {
    byte start_delimiter;
    read(&start_delimiter, 1);
    if (start_delimiter != 0x7e) {
        glog.is_warn() && glog << "ERROR: Wrong start_delimiter for frame: " << start_delimiter << endl;
        return "";
    }

    uint16_t response_size;
    read(&response_size, 2);
    response_size = big_to_native(response_size);
    glog.is_debug1() && glog << "Waiting for frame of size " << response_size << " bytes." << endl;

    auto response_buffer = new byte[response_size];
    read(response_buffer, response_size);

    auto response_string = string((const char *)response_buffer, response_size);
    glog.is_debug1() && glog << "Read frame: " << hexadecimal(response_string) << endl;

    byte cs = checksum(response_string);

    delete[] response_buffer;

    byte cs_correct;
    read(&cs_correct, 1);

    if (cs != cs_correct) {
        glog.is_warn() && glog << "ERROR: Incorrect checksum in frame data" << cs << " != " << cs_correct << endl;
        return "";
    }
    else
    {
        glog.is_debug1() && glog << "Correct checksum" << endl;
    }

#if DEBUG
    cout << "READ: " << hexadecimal(response_string) << endl;
#endif
    return response_string;
}


void XBeeDevice::do_work() {
    process_frame_if_available();
    if (received_rssi && received_er && received_gd && received_bc && received_tr)
    {
        glog.is_verbose() &&
            glog << "Current RSSI: " << current_rssi << ", Average RSSI: " << average_rssi
                 << ", Min RSSI: " << min_rssi << ", Max RSSI: " << max_rssi
                 << ", bytes_transmitted: " << bytes_transmitted << " bytes"
                 << ", received_error_count: " << received_error_count
                 << ", received_good_count: " << received_good_count
                 << ", transimission_failure_count: " << transimission_failure_count << endl;
        received_rssi = false;
        received_er = false;
        received_gd = false;
        received_bc = false;
        received_tr = false;
    }
}


void XBeeDevice::process_frame_if_available() {
    while(bytes_available() > 0) {
        process_frame();
    }
}

void XBeeDevice::process_frame() {
    auto response_string = read_frame();
    // Invalid frame data
    if (response_string.length() == 0)
        return;

    byte frame_type = ((byte*) response_string.c_str())[0];

    switch (frame_type) {
        case frame_type_extended_transmit_status:
            process_frame_extended_transmit_status(response_string);
            break;
        case frame_type_at_command_response:
            process_frame_at_command_response(response_string);
            break;
        case frame_type_receive_packet: process_frame_receive_packet(response_string); break;
        case frame_type_explicit_rx_indicator:
            process_frame_explicit_rx_indicator(response_string);
            break;
        default:
            cout << "Unknown frame_type = " << (int) frame_type << endl;
            break;
    }
}

void XBeeDevice::process_frame_at_command_response(const string& response_string) {
    struct Response {
        byte frame_type;
        byte frame_id;
        char at_command[2];
        byte command_status;
        byte command_data_start;
    };

    Response *response = (Response *) response_string.c_str();
    assert(response->frame_type == frame_type_at_command_response);
    string at_command = string((char *) &response->at_command, 2);

    if (at_command == "SH") {
        assert(response->command_status == 0);
        uint32_t upper_serial_number = big_to_native(*((uint32_t*)&response->command_data_start));
        my_serial_number |= ((SerialNumber)upper_serial_number << 32);
    }

    if (at_command == "SL") {
        assert(response->command_status == 0);
        uint32_t lower_serial_number = big_to_native(*((uint32_t*)&response->command_data_start));
        my_serial_number |= ((SerialNumber)lower_serial_number);
        glog.is_verbose() && glog << "serial_number= " << std::hex << my_serial_number << std::dec << " node_id= " << my_node_id  << " (this device)" << endl;

        // Broadcast our node_id, and request everyone else's node_id
        send_node_id(broadcast_serial_number, true);
    }

    if (at_command == "CB") {
        assert(response->command_status == 0);
        return;
    }

    if (at_command == "NP") {
        max_payload_size = big_to_native(*((uint16_t *) &response->command_data_start));
        glog.is_verbose() && glog << "Maximum payload: " << max_payload_size << " bytes" << endl;
        return;
    }

    if (at_command == "DB")
    {
        current_rssi = *((uint16_t*)&response->command_data_start);
        history_rssi += current_rssi;
        average_rssi = history_rssi / rssi_query_count;
        if (current_rssi > max_rssi)
        {
            max_rssi = current_rssi;
        }
        if (current_rssi < min_rssi)
        {
            min_rssi = current_rssi;
        }
        glog.is_debug3() && glog << "Current RSSI: " << current_rssi
                                 << ", Average RSSI: " << average_rssi << ", Min RSSI: " << min_rssi
                                 << ", Max RSSI: " << max_rssi << endl;
        rssi_query_count++;
        received_rssi = true;
    }

    if (at_command == "BC")
    {
        bytes_transmitted = *((uint32_t*)&response->command_data_start);
        glog.is_debug3() && glog << "bytes_transmitted: " << bytes_transmitted << " bytes" << endl;
        received_bc = true;
    }

    if (at_command == "ER")
    {
        received_error_count = *((uint16_t*)&response->command_data_start);
        glog.is_debug3() && glog << "received_error_count: " << received_error_count << endl;
        received_er = true;
    }

    if (at_command == "GD")
    {
        received_good_count = *((uint16_t*)&response->command_data_start);
        glog.is_debug3() && glog << "received_good_count: " << received_good_count << endl;
        received_gd = true;
    }

    if (at_command == "TR")
    {
        transimission_failure_count = *((uint16_t*)&response->command_data_start);
        glog.is_debug3() && glog << "transimission_failure_count: " << transimission_failure_count
                                 << endl;
        received_tr = true;
    }
}


void XBeeDevice::flush_packets_for_node(const NodeId& node_id) {
    for (auto it = outbound_packet_queue.begin(); it != outbound_packet_queue.end(); ) {
        auto& packet = *it;

        if (packet.dest == node_id) {
            try {
                auto serial_number = node_id_to_serial_number_map.at(packet.dest);
                send_packet(serial_number, packet.data);
            } catch (exception& error) {
                glog.is_warn() && glog << "WARNING: No cached serial_number for node_id " << node_id << " still." << endl;
                return;
            }
            it = outbound_packet_queue.erase(it);
        }
        else {
            it++;
        }
    }
}


void XBeeDevice::process_frame_extended_transmit_status(const string& response_string) {
    struct TransmitStatus {
        byte frame_type;
        byte frame_id;
        uint16_t reserved;
        byte transmit_retry_count;
        byte delivery_status;
        byte discovery_status;
    };

    auto response = (const TransmitStatus*) response_string.c_str();
    auto response_size = response_string.size();

    assert(response->frame_type == 0x8b);
    assert(response_size == 7);

    glog.is_debug2() && glog << "Transmit status = " << (int) response->delivery_status << ", retry count = " << (int) response->transmit_retry_count << ", discovery_status = " << (int) response->discovery_status << endl;
}

void XBeeDevice::process_frame_receive_packet(const string& response_string) {
    struct ReceivePacket {
        byte frame_type;
        byte src[8];
        byte reserved[2];
        byte options;
        byte received_data_start;
    };

    glog.is_debug1() && glog << "Packet frame" << endl;

    auto response = (const ReceivePacket*) response_string.c_str();
    auto response_size = response_string.size();
    auto data_size = response_size - 12;

    auto serialized_packet = string((char*)&response->received_data_start, data_size);
    glog.is_debug1() && glog << "Received XBeePacket raw data length=" << serialized_packet.length()
                             << endl;

    XBeePacket packet;
    if (packet.ParseFromString(serialized_packet))
    {
        glog.is_debug1() && glog << "Parsed packet of length " << serialized_packet.length()
                                 << endl;

        if (packet.has_xbee_address_entry() && should_discover_peers)
        {
            auto xbee_address_entry = packet.xbee_address_entry();
            auto node_id = xbee_address_entry.node_id();
            auto serial_number = xbee_address_entry.serial_number();

            add_peer(node_id, serial_number);

            // Remote is requesting our xbee_address_entry
            if (packet.has_xbee_address_entry_request() && packet.xbee_address_entry_request())
            {
                auto src = *((SerialNumber*)response->src);
                glog.is_verbose() &&
                    glog << "Responding to xbee_address_entry_request for serial_number= "
                         << std::hex << src << std::dec << std::endl;
                send_node_id(src, false);
            }
        }

        if (packet.has_data())
        {
            received_packets.push_back(packet.data());
            glog.is_debug1() && glog << "Received datagram data=" << hexadecimal(packet.data())
                                     << endl;
        }
    }
    else
    {
        glog.is_warn() && glog << "Could not deserialize packet" << endl;
    }
}

void XBeeDevice::process_frame_explicit_rx_indicator(const string& response_string)
{
    glog.is_debug1() && glog << "Packet frame explicit_rx_indicator" << endl;
    struct Rx_Indicator
    {
        byte frame_type;
        byte src[8];
        byte reserved[2];
        byte src_endpoint;
        byte dst_endpoint;
        byte cluster_id[2];
        byte profile_id[2];
        byte options;
        byte dest_address[8];
        byte payload_size[2];
        byte iterations[2];
        byte success[2];
        byte retries[2];
        byte result;
        byte RR;
        byte maxRSSI;
        byte minRSSI;
        byte avgRSSI;
    };

    auto response = (const Rx_Indicator*)response_string.c_str();
    auto response_size = response_string.size();
    string src = string((char*)&response->src, 8);
    string dst = string((char*)&response->dest_address, 8);
    string payload_size = string((char*)&response->payload_size, 2);
    string iterations = string((char*)&response->iterations, 2);
    string success = string((char*)&response->success, 2);
    string result = string((char*)&response->result, 2);

    assert(response->frame_type == 0x91);

    glog.is_debug2() &&
        glog << "frame_type = " << (int)response->frame_type << ", src = " << hexadecimal(src)
             << ", dest_address = " << hexadecimal(dst)
             << ", payload_size = " << std::atoi(hexadecimal(payload_size).c_str())
             << ", iterations = " << std::atoi(hexadecimal(iterations).c_str())
             << ", success = " << std::atoi(hexadecimal(success).c_str())
             << ", retries = " << std::atoi(hexadecimal(result).c_str())
             << ", result = " << std::atoi(hexadecimal(result).c_str())
             << ", RR = " << (int)response->RR << ", maxRSSI = " << (int)response->maxRSSI
             << ", minRSSI = " << (int)response->minRSSI << ", avgRSSI = " << (int)response->avgRSSI
             << endl;
}

vector<string> XBeeDevice::get_packets() {
    auto packets = received_packets;
    received_packets.clear();
    return packets;
}


string api_transmit_request(const SerialNumber& dest, const byte frame_id, const byte* ptr, const size_t length) {
    auto data_string = string((const char *) ptr, length);
    auto dest_big_endian = native_to_big(dest);
    auto dest_string = string((const char*)&dest_big_endian, sizeof(dest_big_endian));
    glog.is_debug2() && glog << "   TX REQ for data:" << hexadecimal(data_string) << endl;
    glog.is_debug2() && glog << "   dest: " << hexadecimal(dest_string) << endl;
    string s = string("\x10") + string((char*)&frame_id, 1) + dest_string +
               string("\xff\xfe\x00\x00", 4) + data_string;
    return s;
}

// This function is used to send a test between two links
// This currently does not work as intended
// Test comms (https://www.digi.com/resources/documentation/digidocs/pdfs/90001477.pdf page 181)
string api_explicit_transmit_request(const SerialNumber& dest, const SerialNumber& com_dest,
                                     const byte frame_id)
{
    auto dest_big_endian = native_to_big(dest);
    auto dest_string = string((const char*)&dest_big_endian, sizeof(dest_big_endian));
    auto com_dest_big_endian = native_to_big(com_dest);
    auto com_dest_string = string((const char*)&com_dest_big_endian, sizeof(com_dest_big_endian));
    glog.is_debug2() && glog << "   Explicit TX REQ for data:" << endl;
    glog.is_debug2() && glog << "   dest: " << hexadecimal(dest_string) << endl;
    glog.is_debug2() && glog << "   command dest: " << hexadecimal(com_dest_string) << endl;
    string frame_type = string("\x11", 1);
    string frame_id_str = string((char*)&frame_id, 1);
    string frame_dest = dest_string;
    string frame_reserved = string("\xff\xfe", 2);
    string frame_src_endpoint = string("\xe6", 1);
    string frame_dst_endpoint = string("\xe6", 1);
    string frame_cluster_id = string("\x00\x14", 2);
    string frame_profile_id = string("\xc1\x05", 2);
    string frame_broad_rad = string("\x00", 1);
    string frame_trans_opt = string("\x00", 1);
    string frame_com_dest = com_dest_string;           // command destination
    string frame_com_pay_size = string("\x00\x28", 2); // 40 bytes
    string frame_com_iters =
        string("\x00\x01", 2); // 0x0064 100 packets to send 0x03E8 1000 packets to send

    string explicit_trans_frame = frame_type + frame_id_str + frame_dest + frame_reserved +
                                  frame_src_endpoint + frame_dst_endpoint + frame_cluster_id +
                                  frame_profile_id + frame_broad_rad + frame_trans_opt +
                                  frame_com_dest + frame_com_pay_size + frame_com_iters;

    glog.is_debug2() && glog << "   Explicit Frame: " << hexadecimal(explicit_trans_frame) << endl;

    return explicit_trans_frame;
}

SerialNumber XBeeDevice::get_serial_number(const NodeId& node_id) {
    try {
        auto serial_number = node_id_to_serial_number_map.at(node_id);
        return serial_number;
    } catch (exception& error) {
        // Unknown serial_number at this time
        return 0;
    }
}

void XBeeDevice::_send_packet(const SerialNumber& dest, const XBeePacket& packet)
{
    string serialized_packet;

    if (packet.SerializeToString(&serialized_packet))
    {
        write(frame_data(api_transmit_request(
            dest, frame_id, (const byte*)serialized_packet.c_str(), serialized_packet.length())));
        frame_id++;
    }
    else
    {
        glog.is_warn() && glog << "Could not serialize packet for transmission:  "
                               << packet.ShortDebugString() << endl;
    }
}

// Test comms (https://www.digi.com/resources/documentation/digidocs/pdfs/90001477.pdf page 181)
void XBeeDevice::send_test_links(const NodeId& dest, const NodeId& com_dest)
{
    glog.is_debug2() && glog << "send_test_links: dest: " << get_serial_number(dest)
                             << ", com dest: " << get_serial_number(com_dest) << endl;
    string packet = frame_data(api_explicit_transmit_request(
        get_serial_number(dest), get_serial_number(com_dest), frame_id));
    write(packet);
    frame_id++;
}

void XBeeDevice::send_node_id(const SerialNumber& dest, const bool xbee_address_entry_request)
{
    if (!should_discover_peers)
    {
        return;
    }

    auto packet = XBeePacket();
    auto xbee_address_entry = packet.mutable_xbee_address_entry();
    xbee_address_entry->set_node_id(my_node_id);
    xbee_address_entry->set_serial_number(my_serial_number);
    packet.set_xbee_address_entry_request(xbee_address_entry_request);
    _send_packet(dest, packet);
}

void XBeeDevice::send_packet(const SerialNumber& dest, const string& data)
{
    auto packet = XBeePacket();
    packet.set_data(data);
    _send_packet(dest, packet);
}

// Public interface
void XBeeDevice::send_packet(const NodeId& dest, const string& data)
{
    glog.is_debug2() && glog << "send_packet to NodeId" << endl;

    SerialNumber dest_ser;

    auto packet = Packet(dest, data);

    if (dest == broadcast) {
        dest_ser = broadcast_serial_number;
    }
    else {
        dest_ser = get_serial_number(dest);

        if (dest_ser == 0) {
            // We don't have the destination serial number yet, so queue this data for later
            outbound_packet_queue.push_back(packet);
            return;
        }
    }

    send_packet(dest_ser, data);
}

void XBeeDevice::add_peer(const NodeId node_id, const SerialNumber serial_number)
{
    glog.is_verbose() && glog << "serial_number= " << std::hex << serial_number << std::dec
                              << " node_id= " << node_id << endl;

    node_id_to_serial_number_map[node_id] = serial_number;
    serial_number_to_node_id_map[serial_number] = node_id;

    flush_packets_for_node(node_id);
}
