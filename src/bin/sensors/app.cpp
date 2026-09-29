// Copyright 2024:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//
//
// This file is part of the JaiaBot Project Binaries
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
#include <goby/middleware/io/cobs/serial.h>
#include <goby/zeromq/application/multi_thread.h>

#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/sensor/catalog.pb.h"
#include "jaiabot/messages/sensor/sensor_core.pb.h"

#include "config.pb.h"
#include "drivers/aml.h"
#include "drivers/atlas_scientific__oem_do.h"
#include "drivers/atlas_scientific__oem_ec.h"
#include "drivers/atlas_scientific__oem_ph.h"
#include "drivers/blue_robotics_bar30.h"
#include "drivers/turner__c_fluor.h"
#include "jaiabot/crc/crc32.h"
#include "jaiabot/groups.h"
#include "jaiabot/serial/mcu.h"

using goby::glog;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

// raw IOData
constexpr goby::middleware::Group mcu_serial_in{"jaiabot::sensors::mcu_serial_in"};
constexpr goby::middleware::Group mcu_serial_out{"jaiabot::sensors::mcu_serial_out"};

namespace jaiabot
{
namespace apps
{
class Sensors : public zeromq::MultiThreadApplication<config::Sensors>
{
  public:
    Sensors();

  private:
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;
    void query_metadata();
    void send_to_mcu(sensor::protobuf::SensorRequest request);
    void receive_from_mcu(const goby::middleware::protobuf::IOData& io_msg);
    void receive_metadata_from_mcu(const sensor::protobuf::Metadata& metadata);

  private:
    std::set<jaiabot::sensor::protobuf::Sensor> drivers_launched_;
    std::set<jaiabot::sensor::protobuf::Sensor> failed_initializations;
    std::map<jaiabot::sensor::protobuf::Sensor, jaiabot::protobuf::Error>
        initialization_error_names;
    std::map<jaiabot::sensor::protobuf::Sensor, jaiabot::protobuf::Warning>
        initialization_warning_names;
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::Sensors>(
        goby::middleware::ProtobufConfigurator<config::Sensors>(argc, argv));
}

// Main thread
jaiabot::apps::Sensors::Sensors()
    : zeromq::MultiThreadApplication<config::Sensors>(1.0 / 30.0 * si::hertz)
{
    using MCUSerialThread =
        goby::middleware::io::SerialThreadCOBS<mcu_serial_in, mcu_serial_out,
                                               goby::middleware::io::PubSubLayer::INTERTHREAD,
                                               goby::middleware::io::PubSubLayer::INTERTHREAD>;

    // receive data from MCU
    interthread().subscribe<mcu_serial_in>([this](const goby::middleware::protobuf::IOData& io_msg)
                                           { receive_from_mcu(io_msg); });

    // send requests from driver threads
    interthread().subscribe<jaiabot::groups::mcu_pb_data_out>(
        [this](const sensor::protobuf::SensorRequest& request) { send_to_mcu(request); });

    interprocess().subscribe<jaiabot::groups::mcu_command>(
        [this](const sensor::protobuf::SensorRequest& request) { send_to_mcu(request); });

    launch_thread<MCUSerialThread>(cfg().mcu_serial());

    initialization_error_names = {{jaiabot::sensor::protobuf::BLUE_ROBOTICS__BAR30,
                                   jaiabot::protobuf::ERROR__INIT_FAILED__BLUE_ROBOTICS__BAR30}};

    initialization_warning_names = {
        {jaiabot::sensor::protobuf::ATLAS_SCIENTIFIC__OEM_DO,
         jaiabot::protobuf::WARNING__INIT_FAILED__ATLAS_SCIENTIFIC__OEM_DO},
        {jaiabot::sensor::protobuf::ATLAS_SCIENTIFIC__OEM_EC,
         jaiabot::protobuf::WARNING__INIT_FAILED__ATLAS_SCIENTIFIC__OEM_EC},
        {jaiabot::sensor::protobuf::ATLAS_SCIENTIFIC__OEM_PH,
         jaiabot::protobuf::WARNING__INIT_FAILED__ATLAS_SCIENTIFIC__OEM_PH},
        {jaiabot::sensor::protobuf::TURNER__C_FLUOR,
         jaiabot::protobuf::WARNING__INIT_FAILED__TURNER__C_FLUOR},
        {jaiabot::sensor::protobuf::AML__SENSOR, jaiabot::protobuf::WARNING__INIT_FAILED__AML}};
}

void jaiabot::apps::Sensors::loop()
{
    if (drivers_launched_.size() == 0)
    {
        // keep querying the MCU until it responds with at least one sensor
        query_metadata();
    }
}

void jaiabot::apps::Sensors::health(goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);

    for (const jaiabot::sensor::protobuf::Sensor& sensor : failed_initializations)
    {
        if (initialization_error_names.count(sensor) == 1)
        {
            health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                ->add_error(initialization_error_names.at(sensor));
        }
        else if (initialization_warning_names.count(sensor) == 1)
        {
            health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                ->add_warning(initialization_warning_names.at(sensor));
        }
    }
}

void jaiabot::apps::Sensors::query_metadata()
{
    sensor::protobuf::SensorRequest request;
    request.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    request.set_request_metadata(true);
    send_to_mcu(request);
}

void jaiabot::apps::Sensors::send_to_mcu(sensor::protobuf::SensorRequest request)
{
    glog.is_verbose() && glog << "Send data to MCU: " << request.ShortDebugString() << std::endl;
    auto io_msg = jaiabot::serial::encode_for_mcu(request);
    glog.is_debug1() && glog << "Sending bytes to MCU: " << goby::util::hex_encode(io_msg->data())
                             << std::endl;
    interthread().publish<mcu_serial_out>(io_msg);
}

void jaiabot::apps::Sensors::receive_from_mcu(const goby::middleware::protobuf::IOData& io_msg)
{
    glog.is_debug1() && glog << "Received bytes from MCU: " << goby::util::hex_encode(io_msg.data())
                             << std::endl;
    try
    {
        auto sensor_data = jaiabot::serial::decode_from_mcu<sensor::protobuf::SensorData>(io_msg);
        glog.is_verbose() && glog << "Received data from MCU: " << sensor_data.ShortDebugString()
                                  << std::endl;
        // publish for appropriate thread and for logging
        interprocess().publish<jaiabot::groups::mcu_pb_data_in>(sensor_data);

        if (sensor_data.has_metadata())
            receive_metadata_from_mcu(sensor_data.metadata());
    }
    catch (std::exception& e)
    {
        glog.is_warn() && glog << "Failed to decode message from MCU: " << e.what() << std::endl;
    }
}

void jaiabot::apps::Sensors::receive_metadata_from_mcu(const sensor::protobuf::Metadata& metadata)
{
    if (drivers_launched_.count(metadata.sensor()))
    {
        glog.is_warn() && glog << "Driver already launched for sensor: "
                               << sensor::protobuf::Sensor_Name(metadata.sensor())
                               << ", not launching another." << std::endl;

        return;
    }

    if (metadata.init_failed())
    {
        failed_initializations.insert(metadata.sensor());
        return;
    }

    if (metadata.has_payload_board_version())
    {
        glog.is_verbose() && glog << "BIO Payload Software Version: "
                                  << metadata.payload_board_version() << std::endl;
    }

    switch (metadata.sensor())
    {
        case sensor::protobuf::ATLAS_SCIENTIFIC__OEM_EC:
            launch_thread<AtlasScientificOEMECDriver>(cfg().ec());
            break;

        case sensor::protobuf::BLUE_ROBOTICS__BAR30:
            launch_thread<BlueRoboticsBar30Driver>(cfg().bar30());
            break;

        case sensor::protobuf::ATLAS_SCIENTIFIC__OEM_PH:
            launch_thread<AtlasScientificOEMPHDriver>(cfg().ph());
            break;

        case sensor::protobuf::ATLAS_SCIENTIFIC__OEM_DO:
            launch_thread<AtlasScientificOEMDODriver>(cfg().dissolved_oxygen());
            break;

        case sensor::protobuf::TURNER__C_FLUOR:
            launch_thread<TurnerCFluorDriver>(cfg().fluorometer());
            break;

        case sensor::protobuf::AML__SENSOR: launch_thread<AMLSensorDriver>(cfg().aml()); break;

        default:
            glog.is_warn() && glog << "Driver not implemented for sensor: "
                                   << sensor::protobuf::Sensor_Name(metadata.sensor()) << std::endl;
    }

    drivers_launched_.insert(metadata.sensor());
}
