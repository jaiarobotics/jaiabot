// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Ed Sanville <edsanville@gmail.com>
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
#include <algorithm>
#include <goby/zeromq/application/multi_thread.h>
#include "goby/util/sci.h" // for linear_interpolate

using namespace std;

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/lora/serial.h"
#include "jaiabot/messages/arduino.pb.h"
#include "jaiabot/messages/engineering.pb.h"
#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/low_control.pb.h"
#include "jaiabot/messages/thermistor.pb.h"
#include "jaiabot/version.h"

#define now_microseconds() (goby::time::SystemClock::now<goby::time::MicroTime>().value())

using goby::glog;
using jaiabot::protobuf::ControlSurfaces;

namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

constexpr goby::middleware::Group serial_in{"arduino::serial_in"};
constexpr goby::middleware::Group serial_out{"arduino::serial_out"};

namespace jaiabot
{
namespace apps
{
class ArduinoDriver : public zeromq::MultiThreadApplication<config::ArduinoDriverConfig>
{
  public:
    ArduinoDriver();

  private:
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;
    void check_last_report(goby::middleware::protobuf::ThreadHealth& health,
                           goby::middleware::protobuf::HealthState& health_state);
    void setBounds(const jaiabot::protobuf::Bounds& bounds);
    void publish_arduino_commands();
    void handle_control_surfaces(const ControlSurfaces& control_surfaces);
    std::vector<int> splitVersion(const std::string& version);
    bool isVersionLessThanOrEqual(const std::string& version1, const std::string& version2);
    int surfaceValueToMicroseconds(int input, int lower, int center, int upper);
    int calculateMotorMicroseconds(const int& input);

    int64_t lastAckTime_;

    uint64_t _time_last_command_received_ = 0;
    bool last_command_acked_{true};
    const uint64_t timeout_ = 5e6;

    jaiabot::protobuf::Bounds bounds_;

    // Motor
    int target_motor_ = 1500;
    int max_reverse_ = 1320;
    int motor_off_ = 1500;

    // Control surfaces
    int rudder_ = 1500;
    int port_elevator_ = 1500;
    int stbd_elevator_ = 1500;

    // Timeout
    int arduino_timeout_ = 5;

    // LED
    bool led_switch_on = true;

    // Bot rolled over
    bool bot_rolled_over_{false};

    // Version Table
    std::map<uint32_t, std::pair<std::string, std::string>> arduino_version_compatibility_;
    bool is_driver_connected_{false};
    bool is_driver_compatible_{false};
    bool is_settings_ack_{false};
    bool arduino_restarting_{false};
    std::string app_version_{VERSION_STRING};
    std::string delimiter_{"+"};

    // Used to check the time of the last arduino report
    goby::time::SteadyClock::time_point last_arduino_report_time_{std::chrono::seconds(0)};
    // Used to check the time the arduino restarted
    goby::time::SteadyClock::time_point last_arduino_restart_time_{std::chrono::seconds(0)};

    // Original and extended map of resistance (Ohms) to temperature (°F)
    std::map<float, float> resistance_to_temperature_ = {
        {323839, -39}, {300974, -37}, {279880, -35}, {260410, -33}, {242427, -31},
        {225809, -29}, {210443, -27}, {196227, -25}, {183068, -23}, {170775, -21},
        {159488, -19}, {149024, -17}, {139316, -15}, {130306, -13}, {121939, -11},
        {114165, -9},  {106939, -7},  {100218, -5},  {93909, -3},   {88090, -1},
        {82670, 1},    {77620, 3},    {72911, 5},    {68518, 7},    {64419, 9},
        {60592, 11},   {57017, 13},   {53647, 15},   {50526, 17},   {47606, 19},
        {44874, 21},   {42317, 23},   {39921, 25},   {37676, 27},   {35573, 29},
        {33599, 31},   {31732, 33},   {29996, 35},   {28365, 37},   {26834, 39},
        {25395, 41},   {24042, 43},   {22770, 45},   {21573, 47},   {20446, 49},
        {19376, 51},   {18378, 53},   {17437, 55},   {16550, 57},   {15714, 59},
        {14925, 61},   {14180, 63},   {13478, 65},   {12814, 67},   {12182, 69},
        {11590, 71},   {11030, 73},   {10501, 75},   {10000, 77},   {9526, 79},
        {9078, 81},    {8653, 83},    {8251, 85},    {7866, 87},    {7505, 89},
        {7163, 91},    {6838, 93},    {6530, 95},    {6238, 97},    {5960, 99},
        {5697, 101},   {5447, 103},   {5207, 105},   {4981, 107},   {4766, 109},
        {4561, 111},   {4367, 113},   {4182, 115},   {4006, 117},   {3838, 119},
        {3679, 121},   {3525, 123},   {3380, 125},   {3242, 127},   {3111, 129},
        {2985, 131},   {2865, 133},   {2751, 135},   {2642, 137},   {2538, 139},
        {2438, 141},   {2343, 143},   {2252, 145},   {2165, 147},   {2082, 149},
        {2003, 151},   {1927, 153},   {1855, 155},   {1785, 157},   {1718, 159},
        {1655, 161},   {1594, 163},   {1536, 165},   {1480, 167},   {1427, 169},
        {1375, 171},   {1326, 173},   {1279, 175},   {1234, 177},   {1190, 179},
        {1149, 181},   {1109, 183},   {1070, 185},   {1034, 187},
        
        // Extrapolated values beyond 187°F (up to 300°F, increasing by 2°F)
        {1000, 189},   {970.2, 191},  {939.91, 193}, {910.34, 195}, {881.45, 197},
        {853.24, 199}, {825.71, 201}, {798.83, 203}, {772.61, 205}, {747.02, 207},
        {722.05, 209}, {697.69, 211}, {673.93, 213}, {650.77, 215}, {628.18, 217},
        {606.17, 219}, {584.72, 221}, {563.83, 223}, {543.48, 225}, {523.67, 227},
        {504.38, 229}, {485.61, 231}, {467.34, 233}, {449.57, 235}, {432.28, 237},
        {415.48, 239}, {399.14, 241}, {383.26, 243}, {367.84, 245}, {352.86, 247},
        {338.32, 249}, {324.21, 251}, {310.51, 253}, {297.22, 255}, {284.34, 257},
        {271.85, 259}, {259.75, 261}, {248.02, 263}, {236.68, 265}, {225.70, 267},
        {215.08, 269}, {204.82, 271}, {194.91, 273}, {185.34, 275}, {176.10, 277},
        {167.18, 279}, {158.59, 281}, {150.31, 283}, {142.34, 285}, {134.67, 287},
        {127.30, 289}, {120.22, 291}, {113.43, 293}, {106.91, 295}, {100.68, 297},
        {94.71, 299},  {89.01, 301},  {83.56, 303},  {78.36, 305},  {73.41, 307},
        {68.69, 309},  {64.20, 311},  {59.94, 313},  {55.90, 315},  {52.06, 317},
        {48.43, 319},  {45.00, 321},  {41.75, 323},  {38.70, 325},  {35.83, 327},
        {33.14, 329},  {30.61, 331},  {28.26, 333},  {26.07, 335},  {24.04, 337},
        {22.17, 339},  {20.44, 341},  {18.87, 343},  {17.43, 345},  {16.14, 347},
        {14.98, 349},  {13.95, 351}
    };
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::ArduinoDriver>(
        goby::middleware::ProtobufConfigurator<config::ArduinoDriverConfig>(argc, argv));
}

// Main thread

jaiabot::apps::ArduinoDriver::ArduinoDriver()
    : zeromq::MultiThreadApplication<config::ArduinoDriverConfig>(1.0 / 10.0 * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);
    glog.add_group("command", goby::util::Colors::green);
    glog.add_group("arduino", goby::util::Colors::blue);

    using SerialThread = jaiabot::lora::SerialThreadLoRaFeather<serial_in, serial_out>;
    launch_thread<SerialThread>(cfg().serial_arduino());

    // Creating Compatible Version Table
    for (auto row : cfg().arduino_version_table())
    {
        uint32_t arduino_version = row.arduino_version();
        std::string compatible_from = row.app_versions_compatible_from();
        std::string compatible_to = row.app_versions_compatible_to();

        glog.is_verbose() && glog << group("arduino") << "arduino_version : " << arduino_version
                                  << std::endl;
        glog.is_verbose() && glog << group("arduino") << "compatible_from : " << compatible_from
                                  << std::endl;
        glog.is_verbose() && glog << group("arduino") << "compatible_to : " << compatible_to
                                  << std::endl;
        // Insert new arduino version
        arduino_version_compatibility_.insert(
            std::make_pair(arduino_version, std::make_pair(compatible_from, compatible_to)));
    }

    // Let's just get the major, minor, and patch number without git hash
    app_version_ = app_version_.substr(0, app_version_.find(delimiter_));

    glog.is_verbose() && glog << group("main") << "\tarduino driver version: " << app_version_
                              << std::endl;

    // Setup our bounds configuration
    setBounds(cfg().bounds());

    // Publish to meatadata group to record bounds file used
    interprocess().publish<groups::metadata>(bounds_);

    // Subscribe to engineering commands for:
    // * bounds config changes
    interprocess().subscribe<jaiabot::groups::engineering_command>(
        [this](const jaiabot::protobuf::Engineering& engineering) {
            if (engineering.has_bounds())
            {
                setBounds(engineering.bounds());
            }
        });

    // Convert a ControlSurfaces command into an ArduinoCommand, and send to Arduino
    interprocess().subscribe<groups::low_control>(
        [this](const jaiabot::protobuf::LowControl& low_control) {
            if (low_control.has_control_surfaces())
            {
                glog.is_debug1() && glog << group("command")
                                         << "Received command: " << low_control.ShortDebugString()
                                         << std::endl;

                handle_control_surfaces(low_control.control_surfaces());
            }
        });
    // Get an ArduinoResponse
    interthread().subscribe<serial_in>([this](const goby::middleware::protobuf::IOData& io) {
        try
        {
            auto arduino_response = lora::parse<jaiabot::protobuf::ArduinoResponse>(io);

            jaiabot::protobuf::ArduinoDebug arduino_debug;

            if (arduino_response.status_code() == protobuf::ArduinoStatusCode::STARTUP)
            {
                if (is_settings_ack_)
                {
                    // Reset to check compatibility again
                    is_driver_connected_ = false;
                    is_driver_compatible_ = false;

                    // Reset to false because the arduino restarted
                    // Ensures that we set our bounds
                    is_settings_ack_ = false;

                    // Set true so we can zero out
                    // the arduino commands
                    arduino_restarting_ = true;

                    // Set the restart time
                    last_arduino_restart_time_ = goby::time::SteadyClock::now();

                    glog.is_debug2() && glog << group("main") << "Restarting: " << std::endl;

                    arduino_debug.set_arduino_restarted(true);
                    interprocess().publish<groups::arduino_debug>(arduino_debug);
                }
            }

            glog.is_debug2() &&
                glog << group("main") << "Arduino Driver Connected: " << is_driver_connected_
                     << "Arduino Driver Compatible: " << is_driver_compatible_
                     << ", Arduino Version: " << arduino_response.version()
                     << ", Arduino Driver Has Verision: "
                     << arduino_version_compatibility_.count(arduino_response.version())
                     << std::endl;

            // Check if the driver is compatible
            if (!is_driver_connected_ &&
                arduino_version_compatibility_.count(arduino_response.version()))
            {
                is_driver_connected_ = true;
                auto compatible_from =
                    arduino_version_compatibility_.at(arduino_response.version()).first;
                auto compatible_to =
                    arduino_version_compatibility_.at(arduino_response.version()).second;

                // If the compatible_from version is less than or equal to the
                // app_version_ and if the app_version_ is less
                // than or equal to the compatible_to version
                if (isVersionLessThanOrEqual(compatible_from, app_version_) &&
                    isVersionLessThanOrEqual(app_version_, compatible_to) && !is_settings_ack_)
                {
                    glog.is_debug2() && glog << group("main") << "Arduino Driver is compatible!"
                                             << std::endl;
                    is_driver_compatible_ = true;
                }
            }

            // Check if the driver is compatible
            if (is_driver_compatible_)
            {
                // Set the settings ack to true to begin comms
                if (arduino_response.status_code() == protobuf::ArduinoStatusCode::SETTINGS)
                {
                    glog.is_debug2() && glog << group("main") << "Settings were Ack by arduino"
                                             << std::endl;
                    is_settings_ack_ = true;
                }

                // Check for ack statuses
                if (arduino_response.status_code() == protobuf::ArduinoStatusCode::ACK)
                {
                    // Check to see if arduino has finished restarting
                    if (arduino_restarting_ &&
                        last_arduino_restart_time_ +
                                std::chrono::seconds(cfg().arduino_restart_timeout_seconds()) <
                            goby::time::SteadyClock::now())
                    {
                        // Finished startup process
                        arduino_restarting_ = false;

                        glog.is_debug2() && glog << group("main") << "Finsihed Restarting"
                                                 << std::endl;
                    }
                }
            }

            glog.is_debug1() && glog << group("arduino") << "Received from Arduino: "
                                     << arduino_response.ShortDebugString() << std::endl;

            if (arduino_response.has_thermistor_voltage())
            {
                float voltage = arduino_response.thermistor_voltage();
                float resistance = 10000 * voltage / (5 - voltage);
                float temperature =
                    goby::util::linear_interpolate(resistance, resistance_to_temperature_);
                float temperature_celsius = (temperature - 32) / 1.8;

                jaiabot::protobuf::Thermistor thermistor_msg;
                thermistor_msg.set_temperature(temperature_celsius);
                thermistor_msg.set_resistance(resistance);
                thermistor_msg.set_voltage(voltage);
                interprocess().publish<groups::thermistor>(thermistor_msg);
            }

            interprocess().publish<groups::arduino_to_pi>(arduino_response);
            last_arduino_report_time_ = goby::time::SteadyClock::now();
            last_command_acked_ = true;
        }
        catch (const std::exception& e) //all exceptions thrown by the standard*  library
        {
            glog.is_warn() && glog << group("arduino")
                                   << "Arduino Response Parsing Failed: Exception Was Caught: "
                                   << e.what() << std::endl;
        }
        catch (...)
        {
            glog.is_warn() && glog << group("arduino")
                                   << "Arduino Response Parsing Failed: Exception Was Caught!"
                                   << std::endl;
        } // Catch all
    });

    interprocess().subscribe<groups::imu>([this](const jaiabot::protobuf::IMUData& imu_data) {
        if (imu_data.has_bot_rolled_over())
        {
            bot_rolled_over_ = imu_data.bot_rolled_over();
        }
    });
}

/**
 * @brief Updates the bounds configuration for the Arduino actuators
 * 
 * @param bounds - the new bounds configuration to use
 */
void jaiabot::apps::ArduinoDriver::setBounds(const jaiabot::protobuf::Bounds& bounds)
{
    bounds_.MergeFrom(bounds);

    glog.is_debug1() && glog << "Setting bounds to " << bounds.ShortDebugString() << endl;

    if (bounds_.motor().has_max_reverse())
    {
        max_reverse_ = bounds_.motor().max_reverse();
    }

    // Publish an engineering_status message, so the current bounds can be queried in engineering_status
    interprocess().publish<jaiabot::groups::engineering_status>(bounds);

    is_settings_ack_ = false; // Ensures that we re-send our bounds to the Arduino
}

/**
 * @brief Splits the version major, minor, and patch into a integer vector
 * 
 * @param version - string used to store major, minor, patch (ex: 1.1.1)
 * @return std::vector<int> - major, minor, patch created from the version string
 */
std::vector<int> jaiabot::apps::ArduinoDriver::splitVersion(const std::string& version)
{
    std::vector<int> components;
    std::istringstream ss(version);
    std::string component;

    while (getline(ss, component, '.')) { components.push_back(std::stoi(component)); }

    return components;
}

/**
 * @brief Check to see if a major, minor, patch version is less than or
 * equal to another version.
 * 
 * @param version1 - string used to check against version 2 (ex: 1.1.1)
 * @param version2 - string used to determine is version 1 is less than or equal (ex: 1.2.1)
 * @return true - if the version 1 is less than or equal to version 2
 * @return false - if the version 1 is greater than version 2
 */
bool jaiabot::apps::ArduinoDriver::isVersionLessThanOrEqual(const std::string& version1,
                                                            const std::string& version2)
{
    glog.is_debug2() && glog << group("main") << "isVersionLessThanOrEqual() Version1: " << version1
                             << "\nVersion2: " << version2 << std::endl;
    // If we receive a empty string then
    // return true because we are accepting all
    // versions
    if (version1 == "" || version2 == "")
    {
        glog.is_debug2() && glog << group("main")
                                 << "isVersionLessThanOrEqual() Return true, empty string "
                                 << std::endl;
        return true;
    }

    std::vector<int> v1 = splitVersion(version1);
    std::vector<int> v2 = splitVersion(version2);

    size_t minSize = std::min(v1.size(), v2.size());

    for (size_t i = 0; i < minSize; ++i)
    {
        if (v1[i] < v2[i])
        {
            glog.is_debug2() &&
                glog << group("main")
                     << "isVersionLessThanOrEqual() Return true, because version is less or equal "
                     << "\nV1: " << v1[i] << "\nV2: " << v2[i] << std::endl;
            return true;
        }
        else if (v1[i] > v2[i])
        {
            glog.is_debug2() &&
                glog << group("main")
                     << "isVersionLessThanOrEqual() Return false, because version is greater "
                     << "\nV1: " << v1[i] << "\nV2: " << v2[i] << std::endl;
            return false;
        }
    }

    // If all compared components are equal,
    // Then the versions are the same
    return v1.size() == v2.size();
}

int jaiabot::apps::ArduinoDriver::surfaceValueToMicroseconds(int input, int lower, int center,
                                                             int upper)
{
    double microseconds = 0.0;

    if (bot_rolled_over_)
    {
        input = input * -1;
    }

    if (input > 0)
    {
        microseconds = center + (input / 100.0) * (upper - center);
    }
    else
    {
        microseconds = center + (input / 100.0) * (center - lower);
    }

    return microseconds;
}

/**
 * @brief Converts motor percentage to microseconds
 * 
 * @param input Throttle percentage
 * @return int Microseconds for the ESC to take in
 */
int jaiabot::apps::ArduinoDriver::calculateMotorMicroseconds(const int& input)
{
    return motor_off_ + (input / 100.0) * 400;
}

void jaiabot::apps::ArduinoDriver::handle_control_surfaces(const ControlSurfaces& control_surfaces)
{
    if (control_surfaces.has_motor())
    {
        target_motor_ = calculateMotorMicroseconds(control_surfaces.motor());

        // Do not go lower than max_reverse
        if (target_motor_ < max_reverse_)
        {
            target_motor_ = max_reverse_;
        }
    }

    if (control_surfaces.has_rudder())
    {
        rudder_ = surfaceValueToMicroseconds(control_surfaces.rudder(), bounds_.rudder().lower(),
                                             bounds_.rudder().center(), bounds_.rudder().upper());
    }

    if (control_surfaces.has_stbd_elevator())
    {
        stbd_elevator_ =
            surfaceValueToMicroseconds(control_surfaces.stbd_elevator(), bounds_.strb().lower(),
                                       bounds_.strb().center(), bounds_.strb().upper());
    }

    if (control_surfaces.has_port_elevator())
    {
        port_elevator_ =
            surfaceValueToMicroseconds(control_surfaces.port_elevator(), bounds_.port().lower(),
                                       bounds_.port().center(), bounds_.port().upper());
    }

    if (control_surfaces.has_timeout())
    {
        arduino_timeout_ = control_surfaces.timeout();
    }

    //pulls the data from on message to another
    if (control_surfaces.has_led_switch_on())
    {
        led_switch_on = control_surfaces.led_switch_on();
    }

    _time_last_command_received_ = now_microseconds();

    publish_arduino_commands();
}

void jaiabot::apps::ArduinoDriver::loop() {}

/**
 * @brief Used to send commands to the arduino
 * 
 */
void jaiabot::apps::ArduinoDriver::publish_arduino_commands()
{
    jaiabot::protobuf::ArduinoCommand arduino_cmd;
    jaiabot::protobuf::ArduinoActuators arduino_actuators;
    jaiabot::protobuf::ArduinoSettings arduino_settings;

    if (!is_settings_ack_)
    {
        arduino_settings.set_forward_start(bounds_.motor().forwardstart());
        arduino_settings.set_reverse_start(bounds_.motor().reversestart());

        *arduino_cmd.mutable_settings() = arduino_settings;
    }
    else if (is_settings_ack_ && is_driver_compatible_)
    {
        arduino_actuators.set_timeout(arduino_timeout_);

        // If command is too old, then zero the Arduino
        if ((_time_last_command_received_ != 0 &&
             now_microseconds() - _time_last_command_received_ > timeout_) ||
            arduino_restarting_)
        {
            arduino_actuators.set_motor(motor_off_);
            arduino_actuators.set_rudder(bounds_.rudder().center());
            arduino_actuators.set_stbd_elevator(bounds_.strb().center());
            arduino_actuators.set_port_elevator(bounds_.port().center());
            arduino_actuators.set_led_switch_on(false);

            *arduino_cmd.mutable_actuators() = arduino_actuators;
        }
        else
        {
            // Don't use motor values of less power than the start bounds
            int corrected_motor;

            if (target_motor_ > motor_off_)
                corrected_motor = max(target_motor_, bounds_.motor().forwardstart());
            else if (target_motor_ == motor_off_)
                corrected_motor = target_motor_;
            else if (target_motor_ < motor_off_)
                corrected_motor = min(target_motor_, bounds_.motor().reversestart());

            arduino_actuators.set_motor(corrected_motor);
            arduino_actuators.set_rudder(rudder_);
            arduino_actuators.set_stbd_elevator(stbd_elevator_);
            arduino_actuators.set_port_elevator(port_elevator_);
            arduino_actuators.set_led_switch_on(led_switch_on);

            *arduino_cmd.mutable_actuators() = arduino_actuators;
        }
    }

    glog.is_debug1() && glog << group("arduino")
                             << "Arduino Command: " << arduino_cmd.ShortDebugString() << std::endl;

    // Publish interthread, so we can log it
    interprocess().publish<jaiabot::groups::arduino_from_pi>(arduino_cmd);

    // Send the command to the Arduino
    auto raw_output = lora::serialize(arduino_cmd);
    interthread().publish<serial_out>(raw_output);

    last_command_acked_ = false;
}

void jaiabot::apps::ArduinoDriver::health(goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.set_name(this->app_name());
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    check_last_report(health, health_state);

    health.set_state(health_state);
}

void jaiabot::apps::ArduinoDriver::check_last_report(
    goby::middleware::protobuf::ThreadHealth& health,
    goby::middleware::protobuf::HealthState& health_state)
{
    if (!is_driver_connected_)
    {
        health_state = goby::middleware::protobuf::HEALTH__FAILED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__ARDUINO_CONNECTION_FAILED);
    }
    else
    {
        if (!is_driver_compatible_)
        {
            health_state = goby::middleware::protobuf::HEALTH__FAILED;
            health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                ->add_error(protobuf::ERROR__VERSION__MISMATCH_ARDUINO);
        }
    }

    if (last_arduino_report_time_ + std::chrono::seconds(cfg().arduino_report_timeout_seconds()) <
            goby::time::SteadyClock::now() &&
        !last_command_acked_)
    {
        glog.is_warn() && glog << "Timeout on arduino" << std::endl;

        jaiabot::protobuf::ArduinoDebug arduino_debug;
        arduino_debug.set_arduino_not_responding(true);
        interprocess().publish<groups::arduino_debug>(arduino_debug);

        // Pulbish to arduino to attempt to get a response
        publish_arduino_commands();

        health_state = goby::middleware::protobuf::HEALTH__FAILED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__MISSING_DATA__ARDUINO_REPORT);
    }
}
