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
using jaiabot::comms::byte;
using jaiabot::comms::NodeId;
using jaiabot::comms::SerialNumber;
using xbee::protobuf::XBeePacket;

// Frame types

constexpr byte frame_type_at_command_response = 0x88;
constexpr byte frame_type_extended_transmit_status = 0x8b;
constexpr byte frame_type_receive_packet = 0x90;
constexpr byte frame_type_explicit_rx_indicator = 0x91;

// Utilities

// XBee frame checksum calculator
//   https://www.digi.com/resources/documentation/Digidocs/90002173/#tasks/t_calculate_checksum.htm?TocPath=Operate%2520in%2520API%2520mode%257C_____4

byte checksum(const string& data)
{
    byte sum = 0;
    for (byte c : data) { sum += c; }
    return 0xff - sum;
}

// Hexadecimal representation string, for debugging only

string hexadecimal(const string& raw)
{
    stringstream o;
    o << std::hex << "{ ";
    for (byte c : raw) { o << int(c) << "  "; }
    o << " }";
    return o.str();
}

// frame_data function encapsulates packet_data into a raw data frame for writing to the serial port
//   https://www.digi.com/resources/documentation/Digidocs/90002173/#reference/r_api_frame_format_900hp.htm?TocPath=Operate%2520in%2520API%2520mode%257C_____2

string frame_data(const string& packet_data)
{
    string s(3, ' ');
    s[0] = 0x7e;

    uint16_t packet_length = native_to_big(uint16_t(packet_data.size()));
    s[1] = ((char*)&packet_length)[0];
    s[2] = ((char*)&packet_length)[1];
    s += packet_data;
    s += checksum(packet_data);
    return s;
}

// The XBee's broadcast address is described here:
//   https://www.digi.com/resources/documentation/Digidocs/90002173/#tasks/t_transmit_broadcast.htm?TocPath=Networking%2520methods%257C_____4
const NodeId jaiabot::comms::XBeeDevice::broadcast = "BROADCAST";
const SerialNumber jaiabot::comms::XBeeDevice::broadcast_serial_number =
    native_to_big((SerialNumber)0x000000000000FFFF);

jaiabot::comms::XBeeDevice::XBeeDevice()
{
    io = std::make_shared<io_context>();
    port = new serial_port(*io);
}

void jaiabot::comms::XBeeDevice::startup(const std::string& port_name, const int baud_rate,
                                         const std::string& _my_node_id, const uint16_t network_id,
                                         const std::string& xbee_info_location,
                                         const bool& use_encryption,
                                         const std::string& encryption_password,
                                         const std::string& mesh_unicast_retries,
                                         const std::string& unicast_mac_retries,
                                         const std::string& network_delay_slots,
                                         const std::string& broadcast_multi_transmits)
{
    std::string enable_encryption = "0";
    if (use_encryption)
    {
        enable_encryption = "1";
    }

    my_node_id = _my_node_id;
    my_xbee_info_location_ = xbee_info_location;
    glog_group = "xbee id" + my_node_id;
    glog.add_group(glog_group, goby::util::Colors::yellow);

    port->open(port_name);
    port->set_option(serial_port_base::baud_rate(baud_rate));

    // Setup the modem
    enter_command_mode();

    // Set the configuration parameters, so we're on the same network as other XBee modems
    {
        /*
        Restore Defaults
        Restore device parameters to factory defaults.
        */
        stringstream cmd;
        cmd << "ATRE" << '\r';
        write(cmd.str());
        assert_ok();
    }

    {
        /*
        Preamble ID
        The preamble ID for which the device communicates. Only devices with matching preamble IDs can
        communicate with each other. Different preamble IDs minimize interference between multiple sets of
        devices operating in the same vicinity. When receiving a packet, the device checks this before the
        network ID, as it is encoded in the preamble, and the network ID is encoded in the MAC header.
        Parameter range - 0 - 9 (usually), Default = 0
        */
        stringstream cmd;
        cmd << "ATHP=00" << '\r';
        write(cmd.str());
        assert_ok();
    }

    {
        /*
        Network ID
        Set or read the user network identifier.
        Devices must have the same network identifier to communicate with each other.
        Devices can only communicate with other devices that have the same network identifier and channel
        configured.
        When receiving a packet, the device check this after the preamble ID. If you are using Original
        equipment manufacturer (OEM) network IDs, 0xFFFF uses the factory value.
        Parameter range - 0 - 0x7FFF, Default = 0x7FFF
        */
        stringstream cmd;
        glog.is_verbose() && glog << group(glog_group) << "Network ID: " << setw(4) << network_id
                                  << endl;
        cmd << "ATID=" << setw(4) << network_id << '\r';
        write(cmd.str());
        assert_ok();
    }

    {
        /*
        Node Identifier
        Stores the node identifier string for a device, which is a user-defined name or description of the
        device. This can be up to 20 ASCII characters.
        n XCTU prevents you from exceeding the string limit of 20 characters for this command. If you
        are using another software application to send the string, you can enter longer strings, but the
        software on the device returns an error.
        Parameter range - A string of case-sensitive ASCII printable characters from 0 to 20 bytes in length. A carriage return
            or a comma automatically ends the command. Default = 0x20 (an ASCII space character)
        */
        stringstream cmd;
        cmd << "ATNI" << my_node_id << '\r';
        write(cmd.str());
        assert_ok();
    }

    {
        /*
        API Enable
        Set or read the API mode setting. The device can format the RF packets it receives into API frames and
        send them out the serial port.
        When you enable API, you must format the serial data as API frames because Transparent operating
        mode is disabled.
        Enables API Mode. The device ignores this command when using SPI. API mode 1 is always used.
        Parameter range - 0 - 2, Default = 0
        */
        stringstream cmd;
        cmd << "ATAP=1" << '\r';
        write(cmd.str());
        assert_ok();
    }

    {
        /*
        API Options
        The API data frame output format for RF packets received.
        Use AO to enable different API output frames.
        Parameter range - 0 - 2, Default = 0
        */
        stringstream cmd;
        cmd << "ATAO=0" << '\r';
        write(cmd.str());
        assert_ok();
    }

    {
        /*
        AES Encryption Key
        Sets the 256-bit network security key value that the device uses for encryption and decryption.
        This command is write-only. If you attempt to read KY, the device returns an OK status.
        Set this command parameter the same on all devices in a network.
        Parameter range - 256-bit value (64 Hexadecimal digits), Default = 0
        */
        stringstream cmd;
        glog.is_verbose() && glog << group(glog_group)
                                  << "Encryption Password: " << encryption_password << endl;
        cmd << "ATKY=" + encryption_password << '\r';
        write(cmd.str());
        assert_ok();
    }

    {
        /*
        Encryption Enable
        Enable or disable 256-bit Advanced Encryption Standard (AES) encryption.
        Set this command parameter the same on all devices in a network.
        1 = encryption enabled
        Parameter range - 0 - 1, Default = 0
        */
        stringstream cmd;
        glog.is_verbose() && glog << group(glog_group) << "Enable Encryption: " << enable_encryption
                                  << endl;
        cmd << "ATEE=" + enable_encryption << '\r';
        write(cmd.str());
        assert_ok();
    }

    {
        /*
        Mesh Unicast Retries
        Set or read the maximum number of network packet delivery attempts. If MR is non-zero, the packets
        a device sends request a network acknowledgment, and can be resent up to MR+1 times if the device
        does not receive an acknowledgment.
        Changing this value dramatically changes how long a route request takes.
        We recommend that you set this value to 1.
        Parameter range - 0 - 7 mesh unicast retries, Default = 1
        */
        stringstream cmd;
        glog.is_verbose() && glog << group(glog_group) << "Mesh Unicast Retries: " << mesh_unicast_retries
                                  << endl;
        cmd << "ATMR" << mesh_unicast_retries << '\r'; 
        write(cmd.str());
        assert_ok();
    }

    {
        /*
        Unicast Mac Retries
        Set or read the maximum number of MAC level packet delivery attempts for unicasts. If RR is nonzero,
        the sent unicast packets request an acknowledgment from the recipient. Unicast packets can be
        retransmitted up to RR times if the transmitting device does not receive a successful
        acknowledgment.
        Parameter range - 0 - 0xF, Default = 0xA (10 retries)
        */
        stringstream cmd;
        glog.is_verbose() && glog << group(glog_group) << "Unicast Mac Retries: " << unicast_mac_retries
                                  << endl;
        cmd << "ATRR" << unicast_mac_retries << '\r';
        write(cmd.str());
        assert_ok();
    }

    {
        /*
        Network Delay slots
        Set or read the maximum random number of network delay slots before rebroadcasting a network
        packet.
        Parameter range - 1 - 0x5 network delay slots, Default = 3
        */
        stringstream cmd;
        glog.is_verbose() && glog << group(glog_group) << "Network Delay slots: " << network_delay_slots
                                  << endl;
        cmd << "ATNN" << network_delay_slots << '\r';
        write(cmd.str());
        assert_ok();
    }

    {
        /*
        Broadcast Multi Transmits
        Set or read the number of additional MAC-level broadcast transmissions. All broadcast packets are
        transmitted MT+1 times to ensure they are received.
        Parameter range - 0 - 5, Default = 3
        */
        stringstream cmd;
        glog.is_verbose() && glog << group(glog_group) << "Broadcast Multi Transmits: " << broadcast_multi_transmits
                                  << endl;
        cmd << "ATMT" << broadcast_multi_transmits << '\r'; 
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

void jaiabot::comms::XBeeDevice::shutdown()
{
    // Setup the modem
    glog.is_verbose() && glog << group(glog_group)
                              << "Shutting down xbee modem, returning to transparent mode" << endl;

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
        // Set modem API options to 0 (not explicit frames)
        stringstream cmd;
        cmd << "ATAO=0\r";
        write(cmd.str());
        assert_ok();
    }
    {
        /*
        Enables or disables Advanced Encryption Standard (AES) encryption.
        Set this command parameter the same on all devices in a network.
        1 = encryption enabled
        */
        stringstream cmd;
        cmd << "ATEE=0" << '\r';
        write(cmd.str());
        assert_ok();
    }

    exit_command_mode();
    port->close();
}

void jaiabot::comms::XBeeDevice::get_maximum_payload_size()
{
    // Send ND command
    string cmd = string("\x08") + *((char*)&frame_id) + string("NP");
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
void jaiabot::comms::XBeeDevice::query_rssi()
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
void jaiabot::comms::XBeeDevice::query_er()
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
void jaiabot::comms::XBeeDevice::query_gd()
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
void jaiabot::comms::XBeeDevice::query_bc()
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
void jaiabot::comms::XBeeDevice::query_tr()
{
    // Send DB command
    string cmd = string("\x08") + *((char*)&frame_id) + string("TR");
    write(frame_data(cmd));
    frame_id++;
}

void jaiabot::comms::XBeeDevice::send_diagnostic_commands()
{
    query_rssi();
    query_er();
    query_gd();
    query_bc();
    query_tr();
}

void jaiabot::comms::XBeeDevice::get_my_serial_number()
{
    string cmd = string("\x08") + *((char*)&frame_id) + string("SH");
    write(frame_data(cmd));
    frame_id++;

    string cmd2 = string("\x08") + *((char*)&frame_id) + string("SL");
    write(frame_data(cmd2));
    frame_id++;
}

void jaiabot::comms::XBeeDevice::write(const string& raw)
{
    // Write data
    port->write_some(buffer(raw.c_str(), raw.size()));
    glog.is_debug2() && glog << group(glog_group) << "Wrote: " << raw << endl;
    glog.is_debug2() && glog << group(glog_group) << "  hex: " << hexadecimal(raw) << endl;
}

string jaiabot::comms::XBeeDevice::read_until(const string& delimiter)
{
    string data;
    glog.is_debug2() && glog << group(glog_group) << "read_until: " << delimiter
                             << " (hex: " << hexadecimal(delimiter) << ")" << endl;
    boost::asio::read_until(*port, dynamic_buffer(data), delimiter);
    glog.is_debug2() && glog << group(glog_group) << "read_until completed with: " << delimiter
                             << endl;
    return data;
}

void jaiabot::comms::XBeeDevice::read(void* ptr, const size_t n_bytes)
{
    boost::asio::read(*port, buffer(ptr, n_bytes));
}

size_t jaiabot::comms::XBeeDevice::bytes_available()
{
    int n_bytes_available;
    if (-1 == ::ioctl(port->lowest_layer().native_handle(), FIONREAD, &n_bytes_available))
    {
        boost::system::error_code error =
            boost::system::error_code(errno, boost::asio::error::get_system_category());
        glog.is_warn() && glog << group(glog_group) << "ERROR: " << error.message() << endl;
        return 0;
    }
    return size_t(n_bytes_available);
}

void jaiabot::comms::XBeeDevice::enter_command_mode()
{
    std::string buffer;
    std::string delimiter = "B-Bypass";
    int timeout_seconds = 5;
    
    // Triggers menu to appear for bypass
    write("\r");

    this->async_read_with_timeout(
            buffer, delimiter, timeout_seconds, [this](const std::string& result) {
                      
                glog.is_debug1() && glog << group(glog_group) << "Result: " << result 
                                       << "\nResult is empty: " << result.empty()
                                       << std::endl;

                if (result.find("B-Bypass") != std::string::npos || 
                        result == "timeout")
                {
                    // If bypass appears then send b to bypass
                    if (result.find("B-Bypass") != std::string::npos) 
                    {
                        // Send b to bypass
                        write("b");

                        sleep(1);
                    }
                    
                    // Send +++ to enter command mode
                    write("+++");

                    sleep(1);

                    // Wait for ok to proceed
                    read_until("OK\r");

                    // Stop io context to exit and continue
                    io->stop();
                    
                    return;
                }
                else
                {
                    // Log an error and retry
                    glog.is_warn() && glog << group(glog_group) << "ERROR Result: " << result 
                                    << "| ERROR Result Hex: " << convertToHex(result)
                                    << std::endl;
                    
                    enter_command_mode();
                } 
                
            });
}

/**
 * @brief Asynchronously reads data from a serial port until a delimiter is encountered, with a timeout.
 *
 * This function initiates an asynchronous read operation on the specified serial port.
 * It reads data until the specified delimiter is encountered or the timeout period expires.
 * A handler function is called with the read data when the operation completes,
 * or with an appropriate error message if the operation fails or times out.
 *
 * @param buffer Reference to the buffer for storing the read data.
 * @param delimiter The delimiter indicating the end of the data.
 * @param timeout_seconds The timeout period in seconds.
 * @param handler The handler function to be called when the operation completes.
 *                It should accept a single parameter of type const std::string&,
 *                representing the read data or an error message.
 */
void jaiabot::comms::XBeeDevice::async_read_with_timeout(
    std::string& buffer, const std::string& delimiter, int timeout_seconds,
    std::function<void(const std::string&)> handler)
{
    // Clear the buffer before starting the read operation
    buffer.clear();

    // Create a shared pointer to manage the lifetime of the deadline timer
    auto timer = std::make_shared<boost::asio::deadline_timer>(*io);

    // Set the expiration time of the timer
    timer->expires_from_now(boost::posix_time::seconds(timeout_seconds));

    // Set up the timer's asynchronous wait operation
    timer->async_wait([&](const boost::system::error_code& ec) {
        if (!ec)
        {
            // Timer expired, handle timeout
            handler("timeout");
        }
    });

    // Initiate an asynchronous read operation on the serial port
    boost::asio::async_read_until(
        *port, boost::asio::dynamic_buffer(buffer), delimiter,
        [&](const boost::system::error_code& ec, std::size_t bytes_transferred) {
            if (!ec)
            {
                // Cancel the timer if read is successful
                timer->cancel();
                // Call the handler with the read data
                handler(buffer);
            }
            else
            {
                // Handle read error
                handler("read_error");
            }
        });
    
    // Wait for either the read operation to complete or the timeout to occur
    io->run();
}

/**
 * @brief Function to convert the string to a hexadecimal formatted string
 * 
 * @param std::string String to convert into hex
 * @return std::string Hex string
 */
std::string jaiabot::comms::XBeeDevice::convertToHex(const std::string& str) 
{
    std::ostringstream hexStream;
    for (unsigned char c : str) {
        hexStream << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(c) << " ";
    }
    return hexStream.str();
}

void jaiabot::comms::XBeeDevice::assert_ok()
{
    string input_line = read_until("\r");
    trim(input_line);
    if (input_line != "OK")
    {
        glog.is_warn() && glog << group(glog_group)
                               << "ERROR, expecting OK, modem response: " << input_line << endl;
    }
    assert(input_line == "OK");
}

void jaiabot::comms::XBeeDevice::exit_command_mode()
{
    write("ATCN\r");
    sleep(1);
    // Read until we get the OK, in case some binary data comes through and interferes
    read_until("OK\r");
}

vector<NodeId> jaiabot::comms::XBeeDevice::get_peers()
{
    vector<NodeId> peers;

    for (auto peer : node_id_to_serial_number_map) { peers.push_back(peer.first); }

    return peers;
}

string jaiabot::comms::XBeeDevice::read_frame()
{
    byte start_delimiter;
    read(&start_delimiter, 1);
    if (start_delimiter != 0x7e)
    {
        glog.is_warn() && glog << group(glog_group)
                               << "ERROR: Wrong start_delimiter for frame: " << start_delimiter
                               << endl;
        return "";
    }

    uint16_t response_size;
    read(&response_size, 2);
    response_size = big_to_native(response_size);
    glog.is_debug1() && glog << group(glog_group) << "Waiting for frame of size " << response_size
                             << " bytes." << endl;

    auto response_buffer = new byte[response_size];
    read(response_buffer, response_size);

    auto response_string = string((const char*)response_buffer, response_size);
    glog.is_debug1() && glog << group(glog_group) << "Read frame: " << hexadecimal(response_string)
                             << endl;

    byte cs = checksum(response_string);

    delete[] response_buffer;

    byte cs_correct;
    read(&cs_correct, 1);

    if (cs != cs_correct)
    {
        glog.is_warn() && glog << group(glog_group) << "ERROR: Incorrect checksum in frame data"
                               << cs << " != " << cs_correct << endl;
        return "";
    }
    else
    {
        glog.is_debug1() && glog << group(glog_group) << "Correct checksum" << endl;
    }

#if DEBUG
    cout << "READ: " << hexadecimal(response_string) << endl;
#endif
    return response_string;
}

void jaiabot::comms::XBeeDevice::do_work()
{
    process_frame_if_available();

    if (received_rssi_ && received_er_ && received_gd_ && received_bc_ && received_tr_)
    {
        glog.is_verbose() && glog << group(glog_group) << "Current RSSI: " << current_rssi_
                                  << ", Average RSSI: " << average_rssi_
                                  << ", Min RSSI: " << min_rssi_ << ", Max RSSI: " << max_rssi_
                                  << ", bytes_transmitted: " << bytes_transmitted_ << " bytes"
                                  << ", received_error_count: " << received_error_count_
                                  << ", received_good_count: " << received_good_count_
                                  << ", transmission_failure_count: " << transmission_failure_count_
                                  << endl;
        received_rssi_ = false;
        received_er_ = false;
        received_gd_ = false;
        received_bc_ = false;
        received_tr_ = false;
    }
}

void jaiabot::comms::XBeeDevice::process_frame_if_available()
{
    while (bytes_available() > 0) { process_frame(); }
}

void jaiabot::comms::XBeeDevice::process_frame()
{
    auto response_string = read_frame();
    // Invalid frame data
    if (response_string.length() == 0)
        return;

    byte frame_type = ((byte*)response_string.c_str())[0];

    switch (frame_type)
    {
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
        default: cout << "Unknown frame_type = " << (int)frame_type << endl; break;
    }
}

void jaiabot::comms::XBeeDevice::process_frame_at_command_response(const string& response_string)
{
    struct Response
    {
        byte frame_type;
        byte frame_id;
        char at_command[2];
        byte command_status;
        byte command_data_start;
    };

    Response* response = (Response*)response_string.c_str();
    assert(response->frame_type == frame_type_at_command_response);
    string at_command = string((char*)&response->at_command, 2);

    if (at_command == "SH")
    {
        assert(response->command_status == 0);
        uint32_t upper_serial_number = big_to_native(*((uint32_t*)&response->command_data_start));
        my_serial_number |= ((SerialNumber)upper_serial_number << 32);
    }

    if (at_command == "SL")
    {
        assert(response->command_status == 0);
        uint32_t lower_serial_number = big_to_native(*((uint32_t*)&response->command_data_start));
        my_serial_number |= ((SerialNumber)lower_serial_number);
        glog.is_verbose() && glog << group(glog_group) << "serial_number= " << std::hex
                                  << my_serial_number << std::dec << " node_id= " << my_node_id
                                  << " (this device)" << endl;
        glog.is_verbose() && glog << group(glog_group)
                                  << "File location: " << my_xbee_info_location_ << endl;

        // Write to xbee_info file our serial number and node id for the radio
        // This is currently read in by the jaiabot_metadata app
        std::ofstream xbeeFile;
        xbeeFile.open(my_xbee_info_location_);
        xbeeFile << "  node_id: '" << my_node_id << "'\n";
        xbeeFile << "  serial_number: "
                 << "'0x00" << std::hex << my_serial_number << "'\n";
        xbeeFile.close();
    }

    if (at_command == "CB")
    {
        assert(response->command_status == 0);
        return;
    }

    if (at_command == "NP")
    {
        assert(response->command_status == 0);
        max_payload_size = big_to_native(*((uint16_t*)&response->command_data_start));
        glog.is_verbose() && glog << group(glog_group) << "Maximum payload: " << max_payload_size
                                  << " bytes" << endl;
        return;
    }

    if (at_command == "DB")
    {
        assert(response->command_status == 0);
        current_rssi_ = *((uint16_t*)&response->command_data_start);

        if (current_rssi_ >= 40 && current_rssi_ <= 110)
        {
            history_rssi_ += current_rssi_;
            average_rssi_ = history_rssi_ / rssi_query_count_;
            if (current_rssi_ > max_rssi_)
            {
                max_rssi_ = current_rssi_;
            }
            if (current_rssi_ < min_rssi_)
            {
                min_rssi_ = current_rssi_;
            }
            glog.is_debug3() && glog << group(glog_group) << "Current RSSI: " << current_rssi_
                                     << ", Average RSSI: " << average_rssi_
                                     << ", Min RSSI: " << min_rssi_ << ", Max RSSI: " << max_rssi_
                                     << endl;
            rssi_query_count_++;
            received_rssi_ = true;
        }
    }

    if (at_command == "BC")
    {
        assert(response->command_status == 0);
        bytes_transmitted_ = *((uint32_t*)&response->command_data_start);
        glog.is_debug3() && glog << group(glog_group) << "bytes_transmitted: " << bytes_transmitted_
                                 << " bytes" << endl;
        received_bc_ = true;
    }

    if (at_command == "ER")
    {
        assert(response->command_status == 0);
        received_error_count_ = *((uint16_t*)&response->command_data_start);
        glog.is_debug3() && glog << group(glog_group)
                                 << "received_error_count: " << received_error_count_ << endl;
        received_er_ = true;
    }

    if (at_command == "GD")
    {
        assert(response->command_status == 0);
        received_good_count_ = *((uint16_t*)&response->command_data_start);
        glog.is_debug3() && glog << group(glog_group)
                                 << "received_good_count: " << received_good_count_ << endl;
        received_gd_ = true;
    }

    if (at_command == "TR")
    {
        assert(response->command_status == 0);
        transmission_failure_count_ = *((uint16_t*)&response->command_data_start);
        glog.is_debug3() && glog << group(glog_group)
                                 << "transmission_failure_count: " << transmission_failure_count_
                                 << endl;
        received_tr_ = true;
    }
}

void jaiabot::comms::XBeeDevice::process_frame_extended_transmit_status(
    const string& response_string)
{
    struct TransmitStatus
    {
        byte frame_type;
        byte frame_id;
        uint16_t reserved;
        byte transmit_retry_count;
        byte delivery_status;
        byte discovery_status;
    };

    auto response = (const TransmitStatus*)response_string.c_str();
    auto response_size = response_string.size();

    assert(response->frame_type == 0x8b);
    assert(response_size == 7);

    glog.is_debug2() && glog << group(glog_group)
                             << "Transmit status = " << (int)response->delivery_status
                             << ", retry count = " << (int)response->transmit_retry_count
                             << ", discovery_status = " << (int)response->discovery_status << endl;
}

void jaiabot::comms::XBeeDevice::process_frame_receive_packet(const string& response_string)
{
    struct ReceivePacket
    {
        byte frame_type;
        byte src[8];
        byte reserved[2];
        byte options;
        byte received_data_start;
    };

    glog.is_debug1() && glog << group(glog_group) << "Packet frame" << endl;

    auto response = (const ReceivePacket*)response_string.c_str();
    auto response_size = response_string.size();
    auto data_size = response_size - 12;

    auto serialized_packet = string((char*)&response->received_data_start, data_size);
    glog.is_debug1() && glog << group(glog_group)
                             << "Received datagram length=" << serialized_packet.length()
                             << ", data=" << hexadecimal(serialized_packet) << endl;
    received_packets.push_back(serialized_packet);
}

void jaiabot::comms::XBeeDevice::process_frame_explicit_rx_indicator(const string& response_string)
{
    glog.is_debug1() && glog << group(glog_group) << "Packet frame explicit_rx_indicator" << endl;
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
        glog << group(glog_group) << "frame_type = " << (int)response->frame_type
             << ", src = " << hexadecimal(src) << ", dest_address = " << hexadecimal(dst)
             << ", payload_size = " << std::atoi(hexadecimal(payload_size).c_str())
             << ", iterations = " << std::atoi(hexadecimal(iterations).c_str())
             << ", success = " << std::atoi(hexadecimal(success).c_str())
             << ", retries = " << std::atoi(hexadecimal(result).c_str())
             << ", result = " << std::atoi(hexadecimal(result).c_str())
             << ", RR = " << (int)response->RR << ", maxRSSI = " << (int)response->maxRSSI
             << ", minRSSI = " << (int)response->minRSSI << ", avgRSSI = " << (int)response->avgRSSI
             << endl;
}

vector<string> jaiabot::comms::XBeeDevice::get_packets()
{
    auto packets = received_packets;
    received_packets.clear();
    return packets;
}

string jaiabot::comms::XBeeDevice::api_transmit_request(const SerialNumber& dest,
                                                        const byte frame_id, const byte* ptr,
                                                        const size_t length)
{
    auto data_string = string((const char*)ptr, length);
    auto dest_big_endian = native_to_big(dest);
    auto dest_string = string((const char*)&dest_big_endian, sizeof(dest_big_endian));
    glog.is_debug2() && glog << group(glog_group)
                             << "   TX REQ for data:" << hexadecimal(data_string) << endl;
    glog.is_debug2() && glog << group(glog_group) << "   dest: " << hexadecimal(dest_string)
                             << endl;

    // Frame Type: Transmit Request (0x10)
    string frame_type = string("\x10", 1);                      

    // Frame ID
    string frame_id_string = string((char*)&frame_id, 1);

    // 16-bit Network Address (0xFFFE)
    string network_address = string("\xff\xfe", 2);   

    // Broadcast Radius (0 = max hops)
    string broadcast_radius = string("\x00", 1);               

    // Directed broadcast mode (TO = 0x80)
    string transmit_options = string("\x80", 1);

    // Construct the full frame by combining the parts
    string frame = frame_type
                 + frame_id_string
                 + dest_string
                 + network_address
                 + broadcast_radius
                 + transmit_options
                 + data_string;

    return frame;
}

// This function is used to send a test between two links
// This currently does not work as intended
// Test comms (https://www.digi.com/resources/documentation/digidocs/pdfs/90001477.pdf page 181)
string jaiabot::comms::XBeeDevice::api_explicit_transmit_request(const SerialNumber& dest,
                                                                 const SerialNumber& com_dest,
                                                                 const byte frame_id)
{
    auto dest_big_endian = native_to_big(dest);
    auto dest_string = string((const char*)&dest_big_endian, sizeof(dest_big_endian));
    auto com_dest_big_endian = native_to_big(com_dest);
    auto com_dest_string = string((const char*)&com_dest_big_endian, sizeof(com_dest_big_endian));
    glog.is_debug2() && glog << group(glog_group) << "   Explicit TX REQ for data:" << endl;
    glog.is_debug2() && glog << group(glog_group) << "   dest: " << hexadecimal(dest_string)
                             << endl;
    glog.is_debug2() && glog << group(glog_group)
                             << "   command dest: " << hexadecimal(com_dest_string) << endl;
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

    glog.is_debug2() && glog << group(glog_group)
                             << "   Explicit Frame: " << hexadecimal(explicit_trans_frame) << endl;

    return explicit_trans_frame;
}

SerialNumber jaiabot::comms::XBeeDevice::get_serial_number(const NodeId& node_id)
{
    try
    {
        auto serial_number = node_id_to_serial_number_map.at(node_id);
        return serial_number;
    }
    catch (exception& error)
    {
        // Unknown serial_number at this time
        return 0;
    }
}

void jaiabot::comms::XBeeDevice::send_packet(const SerialNumber& dest, const std::string& data)
{
    write(
        frame_data(api_transmit_request(dest, frame_id, (const byte*)data.c_str(), data.length())));
    frame_id++;
}

// Test comms (https://www.digi.com/resources/documentation/digidocs/pdfs/90001477.pdf page 181)
void jaiabot::comms::XBeeDevice::send_test_links(const NodeId& dest, const NodeId& com_dest)
{
    glog.is_debug2() && glog << group(glog_group)
                             << "send_test_links: dest: " << get_serial_number(dest)
                             << ", com dest: " << get_serial_number(com_dest) << endl;
    string packet = frame_data(api_explicit_transmit_request(
        get_serial_number(dest), get_serial_number(com_dest), frame_id));
    write(packet);
    frame_id++;
}

// Public interface
void jaiabot::comms::XBeeDevice::send_packet(const NodeId& dest, const string& data)
{
    glog.is_debug2() && glog << group(glog_group) << "send_packet to NodeId: " << dest << endl;

    SerialNumber dest_ser;

    auto packet = Packet(dest, data);

    if (dest == broadcast)
    {
        dest_ser = broadcast_serial_number;
    }
    else
    {
        dest_ser = get_serial_number(dest);

        if (dest_ser == 0)
        {
            glog.is_warn() && glog << group(glog_group)
                                   << "No serial number yet for NodeId: " << dest
                                   << ", cannot send message" << endl;
            return;
        }
    }

    send_packet(dest_ser, data);
}

void jaiabot::comms::XBeeDevice::add_peer(const NodeId node_id, const SerialNumber serial_number)
{
    glog.is_verbose() && glog << group(glog_group) << "serial_number= " << std::hex << serial_number
                              << std::dec << " node_id= " << node_id << endl;

    node_id_to_serial_number_map[node_id] = serial_number;
    serial_number_to_node_id_map[serial_number] = node_id;
}
