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
using goby::glog;

using namespace std;
using namespace boost::units;

#include "config.pb.h"
using namespace jaiabot::config;

#include "jaiabot/groups.h"
using jaiabot::groups::camera;
constexpr goby::middleware::Group serial_in{"camera::serial_in"};
constexpr goby::middleware::Group serial_out{"camera::serial_out"};

#include "jaiabot/lora/serial_crc32.h"
using namespace jaiabot::serial;

#include "jaiabot/messages/camera_driver.pb.h"
using namespace jaiabot::protobuf;

namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;


namespace jaiabot
{
namespace apps
{
class CameraDriver : public zeromq::MultiThreadApplication<CameraDriverConfig>
{
  public:
    CameraDriver();

  private:
    void loop() override;
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::CameraDriver>(
        goby::middleware::ProtobufConfigurator<CameraDriverConfig>(argc, argv));
}

// Main thread

jaiabot::apps::CameraDriver::CameraDriver()
    : zeromq::MultiThreadApplication<CameraDriverConfig>(1.0 / 10.0 * si::hertz)
{
    using SerialThread = SerialThreadCRC32<serial_in, serial_out>;

    launch_thread<SerialThread>(cfg().serial_camera());

    interthread().subscribe<serial_in>([this](const goby::middleware::protobuf::IOData& io) {
        try
        {
            auto data = decode_frame(io.data());
            glog.is_debug2() && glog << "Received " << data.length() << " bytes." << std::endl;

            auto response = CameraResponse();
            response.ParseFromString(data);

            glog.is_verbose() && glog << "CameraResponse: " << response.ShortDebugString()
                                      << std::endl;

            interprocess().publish<camera>(response);
        }
        catch (const std::exception& e) //all exceptions thrown by the standard*  library
        {
            glog.is_warn() && glog << group("response")
                                   << "Camera Response Parsing Failed: Exception Was Caught: "
                                   << e.what() << std::endl;
        }
        catch (...)
        {
            glog.is_warn() && glog << group("response")
                                   << "Camera Response Parsing Failed: Exception Was Caught!"
                                   << std::endl;
        } // Catch all
    });

    interprocess().subscribe<camera>([this](const CameraCommand& message) {
        glog.is_verbose() && glog << "CameraCommand: " << message.ShortDebugString() << std::endl;

        auto io_data = encode_frame(message.SerializeAsString());
        interthread().publish<serial_out>(io_data);
    });
}

void jaiabot::apps::CameraDriver::loop() {}
