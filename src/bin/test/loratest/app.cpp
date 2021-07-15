// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//
//
// This file is part of the JaiaBot Hydro Project Binaries
// ("The Jaia Binaries").
//
// The Jaia Binaries are free software: you can redistribute them and/or modify
// them under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// The Jaia Binaries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with the Jaia Binaries.  If not, see <http://www.gnu.org/licenses/>.


#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <dccl/codec.h>
#include <goby/middleware/io/line_based/serial.h>
#include <goby/zeromq/application/multi_thread.h>
#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/gpsd.pb.h>
#include <goby/util/constants.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/lora/serial.h"
#include "jaiabot/messages/feather.pb.h"
#include "jaiabot/messages/lora_test.pb.h"

using goby::glog;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

constexpr goby::middleware::Group serial_in{"serial_in"};
constexpr goby::middleware::Group serial_out{"serial_out"};

namespace jaiabot
{
namespace apps
{
class LoRaTest : public zeromq::MultiThreadApplication<config::LoRaTest>
{
  public:
    LoRaTest();

  private:
    void loop() override;
    void set_parameters();
    void send_msg(const jaiabot::protobuf::LoRaMessage& pb_msg);

  private:
    std::uint8_t test_index_ = 0;
    goby::middleware::protobuf::gpsd::TimePositionVelocity latest_gps_tpv_;

    bool feather_initialized_{false};
    dccl::Codec dccl_;

    bool expecting_packet_{false};
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::LoRaTest>(
        goby::middleware::ProtobufConfigurator<config::LoRaTest>(argc, argv));
}

// Main thread

double loop_freq = 0.1;

jaiabot::apps::LoRaTest::LoRaTest()
    : zeromq::MultiThreadApplication<config::LoRaTest>(loop_freq * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);
    glog.add_group("lora_test", goby::util::Colors::lt_magenta);
    glog.add_group("tdma", goby::util::Colors::lt_green);
    dccl_.load<protobuf::LoRaTestData>();
    
    using SerialThread = jaiabot::lora::SerialThreadLoRaFeather<serial_in, serial_out>;

    launch_thread<SerialThread>(cfg().serial());

    interthread().subscribe<serial_in>([this](const goby::middleware::protobuf::IOData& io) {
        auto& data = io.data();
        jaiabot::protobuf::LoRaMessage pb_msg;
        constexpr auto prefix_size = jaiabot::lora::SERIAL_MAGIC_BYTES + jaiabot::lora::SIZE_BYTES;
        pb_msg.ParseFromArray(&data[0] + prefix_size, data.size() - prefix_size);

        glog.is_verbose() && glog << group("main") << "Received: " << pb_msg.ShortDebugString()
                                  << std::endl;

        interprocess().publish<groups::lora_rx>(pb_msg);

        switch (pb_msg.type())
        {
            default: break;
            case jaiabot::protobuf::LoRaMessage::LORA_DATA:
            {
                protobuf::LoRaTestData test_data;
                dccl_.decode(pb_msg.data(), &test_data);
                glog.is_verbose() && glog << group("lora_test") << "Received payload: " << test_data.ShortDebugString()
                                          << std::endl;
                
                expecting_packet_ = false;
                interprocess().publish<groups::lora_rx>(test_data);

                
                protobuf::LoRaReport report;
                report.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
                report.set_status(protobuf::LoRaReport::GOOD_RECEPTION);
                *report.mutable_feather_msg() = pb_msg;
                *report.mutable_test_data() = test_data;
                *report.mutable_gps_tpv() = latest_gps_tpv_;
                interprocess().publish<groups::lora_report>(report);
                
                break;
            }
            
            case jaiabot::protobuf::LoRaMessage::FEATHER_READY:
                if (!feather_initialized_)
                    set_parameters();
                break;
            case jaiabot::protobuf::LoRaMessage::PARAMETERS_ACCEPTED:
                feather_initialized_ = true;
                break;
        }
    });

    interprocess().subscribe<goby::middleware::groups::gpsd::tpv>(
        [this](const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv) {
            latest_gps_tpv_ = tpv;
        });

    set_parameters();
}

void jaiabot::apps::LoRaTest::loop()
{
    if (!feather_initialized_)
        set_parameters();

    static int loop_index = std::floor(goby::time::SystemClock::now<goby::time::SITime>().value()*loop_freq);

    int tx_id = (loop_index % cfg().num_vehicles()) + 1;

    // we didn't receive a packet...
    if(expecting_packet_)
    {
        glog.is_warn() && glog << group("tdma") << "Did not receive any packet on the last slot" << std::endl;
        expecting_packet_ = false;

        protobuf::LoRaReport report;
        report.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
        report.set_status(protobuf::LoRaReport::NO_PACKET);
        interprocess().publish<groups::lora_report>(report);
    }
    
    glog.is_verbose() && glog << group("tdma") << "Transmitter: " << tx_id << std::endl;
    
    if (cfg().transmit() && (tx_id == cfg().src()))
    {
        protobuf::LoRaTestData test_data;
        test_data.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
        test_data.set_index(test_index_++);

        if (latest_gps_tpv_.has_location())
        {
            test_data.mutable_location()->set_lat_with_units(
                latest_gps_tpv_.location().lat_with_units());
            test_data.mutable_location()->set_lon_with_units(
                latest_gps_tpv_.location().lon_with_units());
        }
        else
        {
            test_data.mutable_location()->set_lat(goby::util::NaN<double>);
            test_data.mutable_location()->set_lon(goby::util::NaN<double>);
        }

        test_data.set_padding(std::string(52, 0xFF));

        std::string encoded;

        dccl_.encode(&encoded, test_data);
        interprocess().publish<groups::lora_tx>(test_data);
        glog.is_verbose() && glog << group("lora_test") << "Sending payload: " << test_data.ShortDebugString()
                                  << std::endl;
        
        jaiabot::protobuf::LoRaMessage pb_msg;
        pb_msg.set_src(cfg().src());
        pb_msg.set_dest(cfg().dest());
        pb_msg.set_data(encoded);
        pb_msg.set_type(jaiabot::protobuf::LoRaMessage::LORA_DATA);
        send_msg(pb_msg);
    }
    else
    {
        expecting_packet_ = true;
    }
    
    ++loop_index;
}

void jaiabot::apps::LoRaTest::set_parameters()
{
    jaiabot::protobuf::LoRaMessage pb_msg;
    pb_msg.set_src(cfg().src());
    pb_msg.set_dest(cfg().src());
    pb_msg.set_type(jaiabot::protobuf::LoRaMessage::SET_PARAMETERS);
    pb_msg.set_data("");
    pb_msg.set_modem_config(cfg().modem_config());
    pb_msg.set_tx_power(cfg().tx_power());

    send_msg(pb_msg);
}

void jaiabot::apps::LoRaTest::send_msg(const jaiabot::protobuf::LoRaMessage& pb_msg)
{
    auto io = std::make_shared<goby::middleware::protobuf::IOData>();

    glog.is_verbose() && glog << group("main") << "Sending: " << pb_msg.ShortDebugString()
                              << std::endl;

    std::string pb_encoded = pb_msg.SerializeAsString();

    std::uint16_t size = pb_encoded.size();
    std::string size_str = {static_cast<char>((size >> jaiabot::lora::BITS_IN_BYTE) & 0xFF),
                            static_cast<char>(size & 0xFF)};

    io->set_data(jaiabot::lora::SERIAL_MAGIC + size_str + pb_encoded);
    interthread().publish<serial_out>(io);

    interprocess().publish<groups::lora_tx>(pb_msg);
}
