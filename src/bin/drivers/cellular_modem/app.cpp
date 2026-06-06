// Copyright 2026:
//   JaiaRobotics LLC
//
// This file is part of the JaiaBot Project Binaries
// ("The Jaia Binaries").
//
// The Jaia Binaries are free software: you can redistribute them and/or modify
// them under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.

#include <atomic>
#include <cerrno>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fcntl.h>
#include <mutex>
#include <optional>
#include <regex>
#include <sstream>
#include <stdexcept>
#include <string>
#include <sys/select.h>
#include <termios.h>
#include <thread>
#include <unistd.h>

#include <goby/middleware/marshalling/protobuf.h>
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/cellular_modem.pb.h"

using goby::glog;
using namespace goby::util::logger;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;

namespace
{
constexpr auto at_query_period = std::chrono::seconds(1);
constexpr auto publish_period_hz = 1 * si::hertz;
constexpr int modem_query_timeout_ms = 500;

int signal_bars_from_rssi(float rssi_dbm)
{
    if (rssi_dbm < -110)
        return 0;
    if (rssi_dbm < -100)
        return 1;
    if (rssi_dbm < -90)
        return 2;
    if (rssi_dbm < -80)
        return 3;
    if (rssi_dbm < -70)
        return 4;
    return 5;
}

std::string shell_quote(const std::string& input)
{
    std::string quoted{"'"};
    for (const char c : input)
    {
        if (c == '\'')
            quoted += "'\\''";
        else
            quoted += c;
    }
    quoted += "'";
    return quoted;
}

std::optional<std::string> run_command_capture_stdout(const std::string& command)
{
    FILE* pipe = popen(command.c_str(), "r");
    if (!pipe)
        return std::nullopt;

    std::string output;
    char buffer[128];
    while (fgets(buffer, sizeof(buffer), pipe)) output += buffer;

    const int rc = pclose(pipe);
    if (rc != 0)
        return std::nullopt;
    return output;
}

speed_t baud_to_speed(int baud)
{
    switch (baud)
    {
        case 9600: return B9600;
        case 19200: return B19200;
        case 38400: return B38400;
        case 57600: return B57600;
        case 115200: return B115200;
#ifdef B230400
        case 230400: return B230400;
#endif
        default: return B115200;
    }
}

struct SignalMetrics
{
    float rssi_dbm = NAN;
    std::optional<float> rsrp_dbm;
    std::optional<float> sinr_db;
};

class SerialPort
{
  public:
    SerialPort(const std::string& path, int baud)
    {
        fd_ = open(path.c_str(), O_RDWR | O_NOCTTY | O_NONBLOCK);
        if (fd_ < 0)
            throw std::runtime_error("failed to open " + path + ": " + std::strerror(errno));

        termios tty{};
        if (tcgetattr(fd_, &tty) != 0)
            throw std::runtime_error("tcgetattr failed");
        cfmakeraw(&tty);
        cfsetispeed(&tty, baud_to_speed(baud));
        cfsetospeed(&tty, baud_to_speed(baud));
        tty.c_cflag |= (CLOCAL | CREAD);
        tty.c_cflag &= ~CRTSCTS;
        tty.c_cflag &= ~CSTOPB;
        tty.c_cflag &= ~PARENB;
        tty.c_cflag &= ~CSIZE;
        tty.c_cflag |= CS8;
        tty.c_cc[VMIN] = 0;
        tty.c_cc[VTIME] = 0;
        if (tcsetattr(fd_, TCSANOW, &tty) != 0)
            throw std::runtime_error("tcsetattr failed");
        tcflush(fd_, TCIOFLUSH);
    }

    ~SerialPort()
    {
        if (fd_ >= 0)
            close(fd_);
    }

    std::string query(const std::string& command, int timeout_ms)
    {
        tcflush(fd_, TCIOFLUSH);
        const std::string wire = command + "\r";
        if (write(fd_, wire.data(), wire.size()) < 0)
            throw std::runtime_error("serial write failed");

        std::string response;
        const auto deadline =
            std::chrono::steady_clock::now() + std::chrono::milliseconds(timeout_ms);
        while (std::chrono::steady_clock::now() < deadline)
        {
            const auto remaining = std::chrono::duration_cast<std::chrono::microseconds>(
                deadline - std::chrono::steady_clock::now());
            timeval tv{};
            tv.tv_sec = remaining.count() / 1000000;
            tv.tv_usec = remaining.count() % 1000000;
            fd_set readfds;
            FD_ZERO(&readfds);
            FD_SET(fd_, &readfds);
            const int ready = select(fd_ + 1, &readfds, nullptr, nullptr, &tv);
            if (ready > 0 && FD_ISSET(fd_, &readfds))
            {
                char buf[128];
                const ssize_t n = read(fd_, buf, sizeof(buf));
                if (n > 0)
                {
                    response.append(buf, n);
                    if (response.find("\r\nOK\r\n") != std::string::npos ||
                        response.find("\nOK\r") != std::string::npos ||
                        response.find("ERROR") != std::string::npos)
                    {
                        return response;
                    }
                }
            }
            else if (ready < 0 && errno != EINTR)
            {
                throw std::runtime_error("serial select failed");
            }
        }
        throw std::runtime_error("AT command timeout");
    }

  private:
    int fd_{-1};
};

std::optional<SignalMetrics> parse_qcsq(const std::string& response)
{
    std::regex qcsq_re(
        R"(\+QCSQ:\s*"LTE"\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+))");
    std::smatch match;
    if (!std::regex_search(response, match, qcsq_re))
        return std::nullopt;

    SignalMetrics metrics;
    metrics.rssi_dbm = std::stof(match[1].str());
    metrics.rsrp_dbm = std::stof(match[2].str());
    metrics.sinr_db = std::stof(match[3].str());
    return metrics;
}

std::optional<SignalMetrics> parse_csq(const std::string& response)
{
    std::regex csq_re(R"(\+CSQ:\s*(\d+)\s*,\s*(\d+))");
    std::smatch match;
    if (!std::regex_search(response, match, csq_re))
        return std::nullopt;
    const int raw = std::stoi(match[1].str());
    if (raw < 0 || raw > 31)
        return std::nullopt;

    SignalMetrics metrics;
    metrics.rssi_dbm = -113 + (2 * raw);
    return metrics;
}

struct PingResult
{
    bool reachable = false;
    uint32_t ping_ms = 0;
};

PingResult ping_once(const std::string& host)
{
    PingResult result;
    const auto output =
        run_command_capture_stdout("ping -n -c 1 -W 1 " + shell_quote(host) + " 2>/dev/null");
    if (!output)
        return result;

    std::regex time_re(R"(time[=<]([0-9]+(?:\.[0-9]+)?)\s*ms)");
    std::smatch match;
    if (std::regex_search(*output, match, time_re))
    {
        result.reachable = true;
        result.ping_ms = static_cast<uint32_t>(std::lround(std::stod(match[1].str())));
    }
    return result;
}

std::optional<float> curl_speed_mbps(const std::string& command)
{
    const auto output = run_command_capture_stdout(command);
    if (!output)
        return std::nullopt;
    try
    {
        const double bytes_per_second = std::stod(*output);
        return static_cast<float>((bytes_per_second * 8.0) / 1000000.0);
    }
    catch (...)
    {
        return std::nullopt;
    }
}
} // namespace

namespace jaiabot
{
namespace apps
{
class CellularModemDriver : public zeromq::MultiThreadApplication<config::CellularModemDriver>
{
  public:
    CellularModemDriver();
    ~CellularModemDriver();

  private:
    void loop() override;
    void fast_probe_loop();
    void throughput_probe_loop();

  private:
    std::atomic<bool> running_{true};
    std::thread fast_probe_thread_;
    std::thread throughput_probe_thread_;

    std::mutex mutex_;
    PingResult latest_ping_;
    std::optional<SignalMetrics> latest_signal_;
    std::optional<float> fresh_download_mbps_;
    std::optional<float> fresh_upload_mbps_;
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::CellularModemDriver>(
        goby::middleware::ProtobufConfigurator<config::CellularModemDriver>(argc, argv));
}

jaiabot::apps::CellularModemDriver::CellularModemDriver()
    : zeromq::MultiThreadApplication<config::CellularModemDriver>(publish_period_hz)
{
    glog.add_group("cellular", goby::util::Colors::green);
    fast_probe_thread_ = std::thread(&CellularModemDriver::fast_probe_loop, this);
    if (!cfg().throughput_host().empty())
        throughput_probe_thread_ = std::thread(&CellularModemDriver::throughput_probe_loop, this);
}

jaiabot::apps::CellularModemDriver::~CellularModemDriver()
{
    running_ = false;
    if (fast_probe_thread_.joinable())
        fast_probe_thread_.join();
    if (throughput_probe_thread_.joinable())
        throughput_probe_thread_.join();
}

void jaiabot::apps::CellularModemDriver::loop()
{
    protobuf::CellularModemReport report;
    report.set_utime(goby::time::SystemClock::now<goby::time::MicroTime>().value());

    std::lock_guard<std::mutex> lock(mutex_);
    report.set_ping_ms(latest_ping_.ping_ms);
    report.set_internet_reachable(latest_ping_.reachable && latest_signal_.has_value());
    if (latest_signal_)
    {
        report.set_rssi_dbm(latest_signal_->rssi_dbm);
        report.set_signal_bars(signal_bars_from_rssi(latest_signal_->rssi_dbm));
        if (latest_signal_->rsrp_dbm)
            report.set_rsrp_dbm(*latest_signal_->rsrp_dbm);
        if (latest_signal_->sinr_db)
            report.set_sinr_db(*latest_signal_->sinr_db);
    }
    if (fresh_download_mbps_)
    {
        report.set_download_mbps(*fresh_download_mbps_);
        fresh_download_mbps_.reset();
    }
    if (fresh_upload_mbps_)
    {
        report.set_upload_mbps(*fresh_upload_mbps_);
        fresh_upload_mbps_.reset();
    }

    interprocess().publish<groups::cellular_modem>(report);
}

void jaiabot::apps::CellularModemDriver::fast_probe_loop()
{
    while (running_)
    {
        PingResult ping = ping_once(cfg().ping_host());
        std::optional<SignalMetrics> signal;

        try
        {
            SerialPort serial(cfg().serial_port(), cfg().serial_baud());
            signal = parse_qcsq(serial.query("AT+QCSQ", modem_query_timeout_ms));
            if (!signal)
                signal = parse_csq(serial.query("AT+CSQ", modem_query_timeout_ms));
            if (!signal)
                glog.is_warn() && glog << group("cellular")
                                       << "Modem signal response could not be parsed" << std::endl;
        }
        catch (const std::exception& e)
        {
            glog.is_warn() && glog << group("cellular") << "Modem query failed: " << e.what()
                                   << std::endl;
        }

        {
            std::lock_guard<std::mutex> lock(mutex_);
            latest_ping_ = ping;
            latest_signal_ = signal;
            if (!signal)
                latest_ping_.reachable = false;
        }

        for (int i = 0; running_ && i < 10; ++i) std::this_thread::sleep_for(at_query_period / 10);
    }
}

void jaiabot::apps::CellularModemDriver::throughput_probe_loop()
{
    while (running_)
    {
        const std::string host = cfg().throughput_host();
        const std::string quoted_download_url = shell_quote(host + "/probe/1mb.bin");
        const std::string quoted_upload_url = shell_quote(host + "/probe/upload");
        const auto download =
            curl_speed_mbps("curl -o /dev/null -s -w '%{speed_download}' --max-time 15 " +
                            quoted_download_url + " 2>/dev/null");
        const auto upload =
            curl_speed_mbps("dd if=/dev/zero bs=512k count=1 2>/dev/null | curl -s -w "
                            "'%{speed_upload}' --max-time 15 -X POST --data-binary @- " +
                            quoted_upload_url + " 2>/dev/null");

        if (download || upload)
        {
            std::lock_guard<std::mutex> lock(mutex_);
            fresh_download_mbps_ = download;
            fresh_upload_mbps_ = upload;
        }
        else
        {
            glog.is_warn() && glog << group("cellular") << "Throughput probe failed" << std::endl;
        }

        for (int i = 0; running_ && i < cfg().throughput_probe_interval_seconds(); ++i)
            std::this_thread::sleep_for(std::chrono::seconds(1));
    }
}
