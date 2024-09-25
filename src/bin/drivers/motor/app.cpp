#include <goby/middleware/marshalling/protobuf.h>
#include <numeric>
// this space intentionally left blank
#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/moos.pb.h"
#include "jaiabot/messages/motor.pb.h"
#include <boost/units/absolute.hpp>
#include <boost/units/io.hpp>
#include <dccl/codec.h>
#include <goby/middleware/io/udp_point_to_point.h>
#include <goby/util/constants.h>
#include <goby/util/seawater/units.h>
#include <goby/zeromq/application/multi_thread.h>
using goby::glog;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;
namespace jaiabot
{
namespace apps
{
constexpr goby::middleware::Group motor_udp_in{"motor_udp_in"};
constexpr goby::middleware::Group motor_udp_out{"motor_udp_out"};
class MotorDriver : public zeromq::MultiThreadApplication<config::MotorDriver>
{
  public:
    MotorDriver();

  private:
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;
    void check_last_report(goby::middleware::protobuf::ThreadHealth& health,
                           goby::middleware::protobuf::HealthState& health_state);

  private:
    dccl::Codec dccl_;
    goby::time::SteadyClock::time_point last_motor_report_time_{std::chrono::seconds(0)};
    bool helm_ivp_in_mission_{false};
};
} // namespace apps
} // namespace jaiabot
int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::MotorDriver>(
        goby::middleware::ProtobufConfigurator<config::MotorDriver>(argc, argv));
}
// Main thread
jaiabot::apps::MotorDriver::MotorDriver()
    : zeromq::MultiThreadApplication<config::MotorDriver>(10 * si::hertz)
{
    using MotorUDPThread = goby::middleware::io::UDPPointToPointThread<motor_udp_in, motor_udp_out>;
    launch_thread<MotorUDPThread>(cfg().udp_config());
    interthread().subscribe<motor_udp_in>([this](const goby::middleware::protobuf::IOData& data) {
        jaiabot::protobuf::Motor motor;
        if (!motor.ParseFromString(data.data()))
        {
            glog.is_warn() && glog << "Couldn't deserialize Motor message from UDP packet"
                                   << std::endl;
            return;
        }
        glog.is_debug2() && glog << "Publishing Motor message: " << motor.ShortDebugString()
                                 << std::endl;
        interprocess().publish<groups::motor>(motor);
        last_motor_report_time_ = goby::time::SteadyClock::now();
    });
    interprocess().subscribe<jaiabot::groups::moos>([this](const protobuf::MOOSMessage& moos_msg) {
        if (moos_msg.key() == "JAIABOT_MISSION_STATE")
        {
            if (moos_msg.svalue() == "IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT")
            {
                helm_ivp_in_mission_ = true;
            }
            else
            {
                helm_ivp_in_mission_ = false;
            }
        }
    });
}
void jaiabot::apps::MotorDriver::loop()
{
    // Just send an empty packet to provide the python driver with a return address
    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    io_data->set_data("hello\n");
    interthread().publish<motor_udp_out>(io_data);
}
void jaiabot::apps::MotorDriver::health(goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.set_name(this->app_name());
    auto health_state = goby::middleware::protobuf::HEALTH__OK;
    check_last_report(health, health_state);
    health.set_state(health_state);
}
void jaiabot::apps::MotorDriver::check_last_report(
    goby::middleware::protobuf::ThreadHealth& health,
    goby::middleware::protobuf::HealthState& health_state)
{
    if (last_motor_report_time_ + std::chrono::seconds(cfg().motor_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on motor driver" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(protobuf::WARNING__NOT_RESPONDING__JAIABOT_MOTOR_DRIVER);
    }
}