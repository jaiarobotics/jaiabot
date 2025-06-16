#ifndef LIAISON_PRODUCTION_H
#define LIAISON_PRODUCTION_H

#include <Wt/WAbstractItemModel.h>
#include <Wt/WEvent.h>
#include <Wt/WPushButton.h>
#include <Wt/WSlider.h>
#include <boost/thread/mutex.hpp>
#include <boost/units/io.hpp>
#include <chrono>

#include "goby/zeromq/liaison/liaison_container.h"
#include <goby/middleware/frontseat/groups.h>
#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/frontseat_data.pb.h>
#include <goby/middleware/protobuf/gpsd.pb.h>

#include "jaiabot/groups.h"
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/low_control.pb.h"
#include "jaiabot/messages/salinity.pb.h"

#include "config.pb.h"
#include "jaiabot/messages/feather.pb.h"
#include "jaiabot/messages/pressure_temperature.pb.h"
namespace production
{

class LiaisonProduction : public Wt::WApplication
{
public:
    LiaisonProduction(const Wt::WEnvironment& env);

private:
    void setup_ui();
    void run_tests_loop();

    // UI Panels
    Wt::WGroupBox* diagnostics_box_;
    Wt::WGroupBox* motor_test_box_;
    Wt::WGroupBox* sea_trial_box_;
    Wt::WGroupBox* hygiene_box_;

    // Status displays
    Wt::WText* diagnostics_status_;
    Wt::WText* motor_status_;
    Wt::WText* sea_trial_status_;
    Wt::WText* hygiene_status_;

    // Update loop
    Wt::WTimer update_timer_;
};

} // namespace production

#endif // LIAISON_PRODUCTION_H