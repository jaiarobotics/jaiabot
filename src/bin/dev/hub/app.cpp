// Copyright 2021:
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
#include <goby/zeromq/application/multi_thread.h>
#include <goby/middleware/protobuf/gpsd.pb.h>
#include <goby/middleware/gpsd/groups.h>
#include <goby/util/constants.h>
#include <goby/util/geodesy.h>
#include <boost/units/io.hpp>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/lora/serial.h"
#include "jaiabot/messages/vehicle_command.pb.h"

using goby::glog;
using namespace std;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

constexpr goby::middleware::Group serial_in{"test::xbee::serial_in"};
constexpr goby::middleware::Group serial_out{"test::xbee::serial_out"};

namespace jaiabot
{
namespace apps
{
class ControlSurfacesTest : public zeromq::MultiThreadApplication<config::ControlSurfacesTest>
{
  public:
    ControlSurfacesTest();

  private:
    std::unique_ptr<goby::util::UTMGeodesy> geodesy_;
    goby::middleware::protobuf::gpsd::TimePositionVelocity latest_gps_tpv_;

    void loop() override;
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::ControlSurfacesTest>(
        goby::middleware::ProtobufConfigurator<config::ControlSurfacesTest>(argc, argv));
}

// Main thread

jaiabot::apps::ControlSurfacesTest::ControlSurfacesTest()
    : zeromq::MultiThreadApplication<config::ControlSurfacesTest>(10 * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);
    glog.add_group("debug", goby::util::Colors::red);

    using SerialThread = jaiabot::lora::SerialThreadLoRaFeather<serial_in, serial_out>;
    launch_thread<SerialThread>(cfg().serial_radio());

    // Subscribe to gps
    interprocess().subscribe<goby::middleware::groups::gpsd::tpv>(
        [this](const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv) {
            glog.is_debug1() && glog << group("main") << "Received from gpsd: " << tpv.ShortDebugString() << std::endl;

            if (!geodesy_)
            {
                // if valid fix, use this for the Geodesy datum
                if (tpv.mode() == goby::middleware::protobuf::gpsd::TimePositionVelocity::Mode2D ||
                    tpv.mode() == goby::middleware::protobuf::gpsd::TimePositionVelocity::Mode3D)
                {
                    geodesy_.reset(new goby::util::UTMGeodesy(
                        {tpv.location().lat_with_units(), tpv.location().lon_with_units()}));

                    glog.is_debug1() && glog << group("debug") << "Geodesy defined!" << endl;
                }
                else {
                    glog.is_warn() && glog << group("debug") << "TPV not in valid mode, so no geodesy defined!  Mode = " << tpv.mode() << endl;
                }
            }
            latest_gps_tpv_ = tpv;
        });


    // command from Liaison -> XBee
    interprocess().subscribe<groups::vehicle_command>(
        [this](const jaiabot::protobuf::VehicleCommand& pb_msg) {
            glog.is_debug1() && glog << group("main")
                                      << "Sending: " << pb_msg.ShortDebugString()
                                      << std::endl;
            auto io = lora::serialize(pb_msg);
            interthread().publish<serial_out>(io);
        });

    // ack from Xbee -> Liaison
    interthread().subscribe<serial_in>([this](
                                           const goby::middleware::protobuf::IOData& io) {
        auto pb_msg = lora::parse<jaiabot::protobuf::ControlAck>(io);

        glog.is_debug1() && glog << group("debug") << "has_location() = " << pb_msg.has_location() << endl;
        glog.is_debug1() && glog << group("debug") << "  lat = " << pb_msg.location().lat_with_units() << endl;
        glog.is_debug1() && glog << group("debug") << "  lon = " << pb_msg.location().lon_with_units() << endl;

        if (geodesy_ &&
            latest_gps_tpv_.has_location() &&
            pb_msg.has_location())
        {
            auto our_xy = geodesy_->convert({latest_gps_tpv_.location().lat_with_units(),
                                             latest_gps_tpv_.location().lon_with_units()});
            auto their_xy = geodesy_->convert({pb_msg.location().lat_with_units(),
                                               pb_msg.location().lon_with_units()});
            auto dx = our_xy.x - their_xy.x;
            auto dy = our_xy.y - their_xy.y;
            auto range = boost::units::sqrt(dx * dx + dy * dy);
            glog.is_debug1() && glog << group("debug") << "Calculated range = " << range << endl;
            pb_msg.set_range_with_units(range);
        }

        if (!geodesy_) {
            glog.is_warn() && glog << group("debug") << "No geodesy defined yet!" << endl;
        }

        if (!latest_gps_tpv_.has_location()) {
            glog.is_warn() && glog << group("debug") << "Box has no GPS lock!" << endl;
        }

        if (!pb_msg.has_location()) {
            glog.is_warn() && glog << group("debug") << "Bot has no GPS lock!" << endl;
        }

        glog.is_warn() && glog << group("debug") << "BOX publishing ControlAck" << endl;
        interprocess().publish<groups::control_ack>(pb_msg);
    });

}

void jaiabot::apps::ControlSurfacesTest::loop() {}
