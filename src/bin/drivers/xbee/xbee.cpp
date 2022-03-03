#include "xbee.h"
#include <boost/algorithm/string.hpp>
#include <boost/endian/conversion.hpp>
#include <iostream>
#include "goby/util/debug_logger.h"

using goby::glog;

#define DEBUG 0

using namespace boost::algorithm;
using namespace std;
using namespace boost::asio;
using namespace boost::endian;

// Frame types

const byte frame_type_at_command_response = 0x88;
const byte frame_type_extended_transmit_status = 0x8b;
const byte frame_type_receive_packet = 0x90;
const byte frame_type_node_identification_indicator = 0x95;

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

void XBeeDevice::startup(const std::string& port_name, const int baud_rate, const std::string& _my_node_id)
{
    my_node_id = _my_node_id;
    
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
        cmd << "ATID=0007" << '\r';
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

    exit_command_mode();

    get_maximum_payload_size();

    get_my_serial_number();

    broadcast_node_id();

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

    exit_command_mode();    
    port->close();
}

void XBeeDevice::get_maximum_payload_size() {
    // Send ND command
    string cmd = string("\x08") + *((char *) &frame_id) + string("NP");
    write(frame_data(cmd));
    frame_id++;
}

void XBeeDevice::get_my_serial_number() {
    string cmd = string("\x08") + *((char *) &frame_id) + string("SH");
    write(frame_data(cmd));
    frame_id++;

    string cmd2 = string("\x08") + *((char *) &frame_id) + string("SL");
    write(frame_data(cmd2));
    frame_id++;
}

void XBeeDevice::broadcast_node_id() {
    // Send ND command
    string cmd = string("\x08") + *((char *) &frame_id) + string("CB") + '\x01';
    write(frame_data(cmd));
    frame_id++;
}

void XBeeDevice::network_discover() {
    // Send ND command
    string cmd = string("\x08") + *((char *) &frame_id) + string("ND");
    write(frame_data(cmd));
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
    boost::asio::read_until(*port, dynamic_buffer(data), delimiter);
#if DEBUG
    cout << "Read:  " << data << endl;
#endif
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
    }

    uint16_t response_size;
    read(&response_size, 2);
    response_size = big_to_native(response_size);
    glog.is_debug1() && glog << "Waiting for frame of size " << response_size << " bytes." << endl;

    auto response_buffer = new byte[response_size];
    read(response_buffer, response_size);

    auto response_string = string((const char *)response_buffer, response_size);
    byte cs = checksum(response_string);

    delete[] response_buffer;

    byte cs_correct;
    read(&cs_correct, 1);

    if (cs != cs_correct) {
        glog.is_warn() && glog << "ERROR: Incorrect checksum in frame data" << cs << " != " << cs_correct << endl;
        return "";
    }

#if DEBUG
    cout << "READ: " << hexadecimal(response_string) << endl;
#endif
    return response_string;
}


void XBeeDevice::do_work() {
    process_frame_if_available();
}


void XBeeDevice::process_frame_if_available() {
    while(bytes_available() > 0) {
        process_frame();
    }
}

void XBeeDevice::process_frame() {
    auto response_string = read_frame();

    byte frame_type = ((byte*) response_string.c_str())[0];

    switch (frame_type) {
        case frame_type_extended_transmit_status:
            process_frame_extended_transmit_status(response_string);
            break;
        case frame_type_at_command_response:
            process_frame_at_command_response(response_string);
            break;
        case frame_type_receive_packet:
            process_frame_receive_packet(response_string);
            break;
        case frame_type_node_identification_indicator:
            process_frame_node_identification_indicator(response_string);
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

    if (at_command == "ND") {
        assert(response->command_status == 0);

        string command_data = string((char *) &response->command_data_start, response_string.size() - 5);

        struct NodeInfo {
            byte junk[2];
            byte serial_number[8];
            char node_id_start;
        };

        NodeInfo *info = (NodeInfo *) command_data.c_str();
        SerialNumber serial_number = *((SerialNumber *) info->serial_number);
        NodeId node_id = string(&info->node_id_start);

        glog.is_verbose() && glog << "NodeInfo node_id=" << node_id << " serial_number=" << std::hex << serial_number << std::dec << endl;

        node_id_to_serial_number_map[node_id] = serial_number;
        serial_number_to_node_id_map[serial_number] = node_id;
        flush_packets_for_node(node_id);

        return;
    }

    if (at_command == "SH") {
        assert(response->command_status == 0);
        uint32_t upper_serial_number = *((uint32_t *)&response->command_data_start);
        my_serial_number |= (SerialNumber)upper_serial_number;
    }

    if (at_command == "SL") {
        assert(response->command_status == 0);
        uint32_t lower_serial_number = *((uint32_t *)&response->command_data_start);
        my_serial_number |= ((SerialNumber) lower_serial_number << 32);
        glog.is_verbose() && glog << "serial_number= " << std::hex << my_serial_number << std::dec << " node_id= " << my_node_id  << " (this device)" << endl;
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

}


void XBeeDevice::flush_packets_for_node(const NodeId& node_id) {
    for (auto it = outbound_packet_queue.begin(); it != outbound_packet_queue.end(); ) {
        auto& packet = *it;

        if (packet.dest == node_id) {
            try {
                auto serial_number = node_id_to_serial_number_map.at(packet.dest);
                send_packet(serial_number, (byte *) packet.data.c_str(), packet.data.size());
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

    auto response = (const ReceivePacket*) response_string.c_str();
    auto response_size = response_string.size();
    auto data_size = response_size - 12;

    auto packet = string((char *) &response->received_data_start, data_size);
    received_packets.push_back(packet);

    glog.is_debug2() && glog << "Received datagram data=" << hexadecimal(packet) << endl;
}

void XBeeDevice::process_frame_node_identification_indicator(const string& response_string) {
    struct Info {
        byte frame_type;
        byte src[8];
        byte reserved[2];
        byte options;
        byte reserved2[2];
        byte remote_serial_number[8];
        byte node_id_start;
    };

    auto info = (const Info*) response_string.c_str();
    NodeId node_id = string((char *) &info->node_id_start);
    SerialNumber serial_number = *((SerialNumber *) &info->remote_serial_number);

    if (node_id_to_serial_number_map.find(node_id) == node_id_to_serial_number_map.end() ||
        node_id_to_serial_number_map[node_id] != serial_number) {
        node_id_to_serial_number_map[node_id] = serial_number;
        serial_number_to_node_id_map[serial_number] = node_id;


        broadcast_node_id();

        
        glog.is_verbose() && glog << "serial_number= " << std::hex << serial_number << std::dec << " node_id= " << node_id << endl;
    }

    flush_packets_for_node(node_id);
}

vector<string> XBeeDevice::get_packets() {
    auto packets = received_packets;
    received_packets.clear();
    return packets;
}


string api_transmit_request(const SerialNumber& dest, const byte frame_id, const byte* ptr, const size_t length) {
    auto data_string = string((const char *) ptr, length);
    auto serial_number_string = string((const char *)&dest, sizeof(SerialNumber));
    glog.is_debug2() && glog << "   TX REQ for data:" << hexadecimal(data_string) << endl;
    glog.is_debug2() && glog << "   dest: " << hexadecimal(serial_number_string) << endl;
    string s = string("\x10") + string((char *) &frame_id, 1) + serial_number_string + string("\xff\xfe\x00\x00", 4) + data_string;
    return s;
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

void XBeeDevice::send_packet(const SerialNumber& dest, const byte* ptr, const size_t length) {
    write(frame_data(api_transmit_request(dest, frame_id, ptr, length)));
    frame_id ++;
}

void XBeeDevice::send_packet(const NodeId& dest, const byte* ptr, const size_t length) {
    SerialNumber dest_ser;

    auto packet = Packet(dest, string((char *) ptr, length));

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

    send_packet(dest_ser, ptr, length);
}

void XBeeDevice::send_packet(const NodeId& dest, const string& s) {
    send_packet(dest, (const byte *)s.c_str(), s.size());
}

