// Copyright 2024:
//   JaiaRobotics LLC
// File authors:
//   Matt Ferro <matt.ferro@jaia.tech>
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

#include "goby/util/sci.h" // for linear_interpolate
#include <boost/units/io.hpp>
#include <goby/middleware/io/udp_point_to_point.h>

#include "jaiabot/messages/arduino.pb.h"
#include "jaiabot/messages/motor.pb.h"

#include "system_thread.h"

#include "jaiabot/groups.h"

using goby::glog;

#define now_microseconds() (goby::time::SystemClock::now<goby::time::MicroTime>().value())

constexpr int thermistor_ohms_neutral = 10000;
constexpr int thermistor_voltage = 5;

constexpr int32_t MOTOR_MICROS_BIN = 50;   // Bin size for motor microseconds
constexpr int32_t MOTOR_OFF_MICROS = 1500; // Value at which the motor is off (neutral)
constexpr std::chrono::seconds MOTOR_USAGE_REPORT_INTERVAL{15};

jaiabot::apps::MotorStatusThread::MotorStatusThread(const jaiabot::config::MotorStatusConfig& cfg)
    : HealthMonitorThread(cfg, "motor_status", 5.0 * boost::units::si::hertz)
{
    open_vehicle_database();
    load_motor_usage_from_db();

    status_.set_motor_harness_type(cfg.motor_harness_type());

    interthread().subscribe<jaiabot::groups::motor_udp_in>(
        [this](const goby::middleware::protobuf::IOData& data) {
            jaiabot::protobuf::Motor motor;
            if (!motor.ParseFromString(data.data()))
            {
                glog.is_warn() && glog << "Couldn't deserialize Motor message from UDP packet"
                                       << std::endl;
                return;
            }
            glog.is_debug2() && glog << "Publishing Motor message: " << motor.ShortDebugString()
                                     << std::endl;

            rpm_value_ = motor.rpm();
            last_motor_rpm_report_time_ = goby::time::SteadyClock::now();
        });

    interprocess().subscribe<jaiabot::groups::power_board_pb_data_in>(
        [this](const jaiabot::protobuf::PowerBoardResponse& power_board_response) {
            if (power_board_response.has_thermistor_voltage())
            {
                float voltage = power_board_response.thermistor_voltage();
                float resistance =
                    thermistor_ohms_neutral * voltage / (thermistor_voltage - voltage);
                float temperature =
                    goby::util::linear_interpolate(resistance, resistance_to_temperature_);
                float temperature_celsius = (temperature - 32) / 1.8;

                status_.mutable_thermistor()->set_temperature(temperature_celsius);
                status_.mutable_thermistor()->set_resistance(resistance);
                status_.mutable_thermistor()->set_voltage(voltage);

                last_motor_thermistor_report_time_ = goby::time::SteadyClock::now();
            }

            if (power_board_response.has_motor())
            {
                if (power_board_response.motor() > MOTOR_OFF_MICROS)
                {
                    // motor is spinning in forward direction
                    status_.set_rpm(std::abs(rpm_value_));
                }
                else if (power_board_response.motor() < MOTOR_OFF_MICROS)
                {
                    // motor is spinning in reverse direction
                    status_.set_rpm(-std::abs(rpm_value_));
                }
                else
                {
                    // motor is off
                    status_.set_rpm(0);
                }
            }

            log_usage(power_board_response);
        });
}

void jaiabot::apps::MotorStatusThread::issue_status_summary()
{
    send_rpm_query();
    update_total_motor_usage();
    glog.is_debug2() && glog << group(thread_name()) << "Status: " << status_.DebugString()
                             << std::endl;
    interprocess().publish<jaiabot::groups::motor_status>(status_);
}

void jaiabot::apps::MotorStatusThread::send_rpm_query()
{
    glog.is_debug2() && glog << group(thread_name()) << "Sending RPM Query: " << std::endl;
    // send an empty packet to provide the python driver with a return address
    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    io_data->set_data("hello\n");
    interthread().publish<jaiabot::groups::motor_udp_out>(io_data);
}

void jaiabot::apps::MotorStatusThread::health(goby::middleware::protobuf::ThreadHealth& health)
{
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    if (last_motor_rpm_report_time_ +
            std::chrono::seconds(cfg().motor_rpm_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on RPM listener" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(protobuf::WARNING__NOT_RESPONDING__JAIABOT_RPM_LISTENER);
    }

    if (last_motor_thermistor_report_time_ +
            std::chrono::seconds(cfg().motor_thermistor_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on thermistor data" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(protobuf::WARNING__NOT_RESPONDING__JAIABOT_ARDUINO_MOTOR_TEMP);
    }

    health.set_state(health_state);
}

void jaiabot::apps::MotorStatusThread::open_vehicle_database()
{
    char* err_msg = nullptr;

    int rc = sqlite3_open(cfg().vehicle_db_path().c_str(), &vehicle_db_);
    if (rc != SQLITE_OK)
    {
        glog.is_warn() && glog << "Can't open database: " << sqlite3_errmsg(vehicle_db_)
                               << std::endl;
        sqlite3_close(vehicle_db_);
        vehicle_db_ = nullptr;
        return;
    }

    char sql[] = "CREATE TABLE IF NOT EXISTS motor_usage("
                 "tail_serial_number TEXT, "
                 "motor_micros INTEGER, "
                 "avg_rpm REAL,"
                 "usage_duration_seconds REAL,"
                 "UNIQUE(tail_serial_number, motor_micros));";

    rc = sqlite3_exec(vehicle_db_, sql, 0, 0, &err_msg);
    if (rc != SQLITE_OK)
    {
        glog.is_warn() && glog << "SQL error: " << err_msg << std::endl;
        sqlite3_free(err_msg);
        sqlite3_close(vehicle_db_);
        vehicle_db_ = nullptr;
        return;
    }

    glog.is_verbose() && glog << "Database created successfully." << std::endl;
}

void jaiabot::apps::MotorStatusThread::log_motor(int32_t motor_micros,
                                                 double usage_duration_seconds, float rpm)
{
    char* err_msg = nullptr;

    if (vehicle_db_ == nullptr)
    {
        glog.is_debug1() && glog << "Database is not open." << std::endl;
        return;
    }

    int32_t binned_motor_micros =
        (motor_micros / MOTOR_MICROS_BIN) * MOTOR_MICROS_BIN; // Bin the motor microseconds

    // Get the current values for motor_micros, usage_duration_seconds, and avg_rpm from the database for the binned_motor_micros
    std::string query =
        "SELECT usage_duration_seconds, avg_rpm FROM motor_usage WHERE tail_serial_number = '" +
        cfg().tail_serial_number() + "' AND motor_micros = " + std::to_string(binned_motor_micros);
    sqlite3_stmt* stmt;
    int rc = sqlite3_prepare_v2(vehicle_db_, query.c_str(), -1, &stmt, nullptr);
    if (rc != SQLITE_OK)
    {
        glog.is_warn() && glog << "SQL error: " << sqlite3_errmsg(vehicle_db_) << std::endl;
        sqlite3_finalize(stmt);
        return;
    }

    rc = sqlite3_step(stmt);

    // Values to insert or update in the database
    double total_usage_duration_seconds;
    double new_avg_rpm;

    if (rc == SQLITE_ROW)
    {
        double existing_usage_duration_seconds = sqlite3_column_double(stmt, 0);
        double existing_avg_rpm = sqlite3_column_double(stmt, 1);
        // Update the avg_rpm using a weighted average
        total_usage_duration_seconds = existing_usage_duration_seconds + usage_duration_seconds;
        new_avg_rpm =
            (existing_avg_rpm * existing_usage_duration_seconds + rpm * usage_duration_seconds) /
            total_usage_duration_seconds;
        sqlite3_finalize(stmt);
    }
    else if (rc == SQLITE_DONE)
    {
        // No existing entry, so we will insert a new one
        total_usage_duration_seconds = usage_duration_seconds;
        new_avg_rpm = rpm;
        sqlite3_finalize(stmt);
    }
    else if (rc != SQLITE_DONE)
    {
        glog.is_warn() && glog << "SQL error: " << sqlite3_errmsg(vehicle_db_) << std::endl;
        sqlite3_finalize(stmt);
        return;
    }

    std::string sql = "INSERT OR REPLACE INTO motor_usage (tail_serial_number, motor_micros, "
                      "usage_duration_seconds, avg_rpm) VALUES ('" +
                      cfg().tail_serial_number() + "', " + std::to_string(binned_motor_micros) +
                      ", " + std::to_string(total_usage_duration_seconds) + ", " +
                      std::to_string(new_avg_rpm) + ");";

    rc = sqlite3_exec(vehicle_db_, sql.c_str(), 0, 0, &err_msg);
    if (rc != SQLITE_OK)
    {
        glog.is_warn() && glog << "SQL error: " << err_msg << std::endl;
        sqlite3_free(err_msg);
        return;
    }
    else
    {
        glog.is_debug1() && glog << "Database updated successfully." << std::endl;
    }

    auto& cached_bin = motor_usage_cache_[binned_motor_micros];
    cached_bin.set_motor_micros(binned_motor_micros);
    cached_bin.set_usage_time_seconds(total_usage_duration_seconds);
    cached_bin.set_average_rpm(new_avg_rpm);
}

void jaiabot::apps::MotorStatusThread::load_motor_usage_from_db()
{
    if (vehicle_db_ == nullptr)
    {
        glog.is_debug1() && glog << "Database is not open." << std::endl;
        return;
    }

    std::string query = "SELECT motor_micros, usage_duration_seconds, avg_rpm FROM motor_usage "
                        "WHERE tail_serial_number = '" +
                        cfg().tail_serial_number() + "';";
    sqlite3_stmt* stmt;
    int rc = sqlite3_prepare_v2(vehicle_db_, query.c_str(), -1, &stmt, nullptr);
    if (rc != SQLITE_OK)
    {
        glog.is_warn() && glog << "SQL error: " << sqlite3_errmsg(vehicle_db_) << std::endl;
        sqlite3_finalize(stmt);
        return;
    }

    while (true)
    {
        rc = sqlite3_step(stmt);

        if (rc == SQLITE_DONE)
        {
            break; // No more rows
        }
        else if (rc != SQLITE_ROW)
        {
            glog.is_warn() && glog << "SQL error: " << sqlite3_errmsg(vehicle_db_) << std::endl;
            sqlite3_finalize(stmt);
            return;
        }

        int32_t motor_micros = sqlite3_column_int(stmt, 0);
        auto& cached_bin = motor_usage_cache_[motor_micros];
        cached_bin.set_motor_micros(motor_micros);
        cached_bin.set_usage_time_seconds(sqlite3_column_double(stmt, 1));
        cached_bin.set_average_rpm(sqlite3_column_double(stmt, 2));
    }

    sqlite3_finalize(stmt);
}

void jaiabot::apps::MotorStatusThread::update_total_motor_usage()
{
    if (goby::time::SteadyClock::now() < next_motor_usage_report_time_)
    {
        return; // Only update every 15 seconds
    }

    next_motor_usage_report_time_ = goby::time::SteadyClock::now() + MOTOR_USAGE_REPORT_INTERVAL;

    jaiabot::protobuf::MotorUsageReport usage_report;
    usage_report.set_bot_vin(cfg().bot_vin());
    usage_report.set_tail_serial_number(cfg().tail_serial_number());
    double total_running_time_seconds = 0;
    for (const auto& bin : motor_usage_cache_)
    {
        *usage_report.add_motor_usage_bins() = bin.second;
        if (bin.first != MOTOR_OFF_MICROS)
        {
            total_running_time_seconds += bin.second.usage_time_seconds();
        }
    }
    usage_report.set_total_running_time_seconds(total_running_time_seconds);

    interprocess().publish<jaiabot::groups::motor_usage_report>(usage_report);
}

void jaiabot::apps::MotorStatusThread::log_usage(
    const jaiabot::protobuf::PowerBoardResponse& power_board_response)
{
    // Log the motor usage
    static jaiabot::protobuf::PowerBoardResponse previous_response;
    static int64_t previous_response_time = 0;

    if (power_board_response.has_motor())
    {
        if (previous_response_time != 0 && previous_response.has_motor())
        {
            double previous_response_duration_seconds =
                (now_microseconds() - previous_response_time) / 1e6;
            log_motor(previous_response.motor(), previous_response_duration_seconds, rpm_value_);
        }

        previous_response = power_board_response;
        previous_response_time = now_microseconds();
    }
}

jaiabot::apps::MotorStatusThread::~MotorStatusThread()
{
    if (vehicle_db_ != nullptr)
    {
        sqlite3_close(vehicle_db_);
    }
}
