// Copyright 2026:
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

#include <boost/units/io.hpp>

#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/gpsd.pb.h>
#include <goby/middleware/protobuf/io.pb.h>
#include <goby/util/linebasedcomms/gps_sentence.h>
#include <goby/util/sci.h>
#include <goby/util/seawater.h>

#include "jaiabot/groups.h"
#include "jaiabot/messages/simulator.pb.h"
#include "jaiabot/messages/storm.pb.h"
#include "jaiabot/messages/storm_mcu.pb.h"
#include "jaiabot/messages/udp_gateway.pb.h"
#include "jaiabot/serial/mcu.h"

#include "storm_sim_thread.h"

using goby::glog;

namespace degree = boost::units::degree;
namespace si = boost::units::si;
using boost::units::quantity;

std::ostream& jaiabot::apps::operator<<(std::ostream& os, const StormSimThread::StormSimState& s)
{
    os << "stage=" << protobuf::StormMissionSimulatorStage_Name(s.stage)
       << ", air altitude=" << -s.nav.depth << ", parachute_attached=" << std::boolalpha
       << s.parachute_attached << ", in_tube=" << std::boolalpha << s.in_tube;
    return os;
}

jaiabot::apps::StormSimThread::StormSimThread(const jaiabot::config::StormSimThread& cfg)
    : SimulatorThread<jaiabot::config::StormSimThread>(cfg, "storm_simulator",
                                                       0 * boost::units::si::hertz),
      air_datum_dt_(goby::time::convert_duration<goby::time::SteadyClock::duration>(
          1.0f / cfg.air_data_sample_rate_with_units()))

{
    glog.add_group("storm", goby::util::Colors::magenta);

    interthread().subscribe<dive_nav>([this](std::shared_ptr<const SimNav> dv_nav)
                                      { handle_dive_nav(dv_nav); });

    for (auto failure : cfg.failures())
        failures_.try_emplace(failure.type(), std::bernoulli_distribution(failure.probability()));

    interthread().subscribe<sim_oceanography>(
        [this](std::shared_ptr<const SimOceanography> air_data)
        {
            auto now = goby::time::SteadyClock::now();
            if (now >= next_air_datum_time_)
            {
                air_descent_data_.push_back(air_data);
                next_air_datum_time_ += air_datum_dt_;
            }
        });

    interthread().subscribe<groups::storm_mcu_serial_in>(
        [this](const goby::middleware::protobuf::IOData& io_msg)
        {
            try
            {
                auto req = jaiabot::serial::decode_from_mcu<protobuf::StormMCURequest>(io_msg);
                mcu_rx(req);
            }
            catch (std::exception& e)
            {
                glog.is_warn() && glog
                                      << "Failed to decode message from storm manager: " << e.what()
                                      << std::endl;
            }
        });
}

void jaiabot::apps::StormSimThread::handle_dive_nav(std::shared_ptr<const SimNav> dv_nav)
{
    auto now = goby::time::SteadyClock::now();

    glog.is_debug1() && glog << group("storm") << "[dive_nav] x: " << dv_nav->x
                             << ", y: " << dv_nav->y << ", depth: " << dv_nav->depth << std::endl;
    if (!initial_nav_set_)
    {
        state_.nav = *dv_nav;
        state_.nav.depth = -cfg().launch_altitude_with_units();
        state_.nav.pitch = decltype(state_.nav.pitch)(cfg().pitch_during_air_descent_with_units());
        glog.is_verbose() && glog << group("storm") << "Initial nav set to: x: " << dv_nav->x
                                  << ", y: " << dv_nav->y << ", depth: " << dv_nav->depth
                                  << std::endl;
        last_nav_process_time_ = now;

        initial_nav_set_ = true;
    }

    std::shared_ptr<SimNav> stm_nav;

    glog.is_debug1() && glog << group("storm") << "[state] " << state_ << std::endl;

    quantity<si::time> dt(
        std::chrono::duration_cast<std::chrono::microseconds>(now - last_nav_process_time_)
            .count() *
        si::micro * si::seconds);

    switch (state_.stage)
    {
        case protobuf::AIR_DESCENT:
            compute_air_descent(now, dt);
            stm_nav.reset(new SimNav(state_.nav));
            break;
        case protobuf::IN_WATER:
            if (state_.parachute_attached || state_.in_tube)
            {
                compute_in_water_nav(now, dt);
                stm_nav.reset(new SimNav(state_.nav));
            }
            break;
    }

    if (stm_nav)
    {
        interthread().publish<storm_nav>(stm_nav);

        //        std::stringstream reset_ss;
        //        reset_ss << "x=" << stm_nav->x.value() << ",y=" << stm_nav->y.value()
        //                 << ",depth=" << stm_nav->depth.value() << ",speed=0,heading=0";
        //        interthread().publish<to_moos>(std::make_pair(std::string("USM_RESET"), reset_ss.str()));
    }
    else // once free of tube and parachute, we just forward the usual nav
    {
        interthread().publish<storm_nav>(dv_nav);
    }

    last_nav_process_time_ = now;
}

void jaiabot::apps::StormSimThread::compute_air_descent(
    const goby::time::SteadyClock::time_point& now, const quantity<si::time>& dt)
{
    state_.nav.depth += cfg().air_descent_rate_with_units() * dt;

    // TODO - add wind drift vector if relevant

    // hit the water
    if (state_.nav.depth >= 0 * si::meters)
    {
        state_.stage = protobuf::IN_WATER;
        state_.nav.depth = 0 * si::meters;
        state_.in_water_start = now;
        state_.air_descent_end = goby::time::SystemClock::now();

        // stop recording "air data"
        interthread().unsubscribe<sim_oceanography, SimOceanography>();
    }
}

void jaiabot::apps::StormSimThread::compute_in_water_nav(
    const goby::time::SteadyClock::time_point& now, const quantity<si::time>& dt)
{
    auto duration_in_water =
        goby::time::convert_duration<quantity<si::time>>(now - state_.in_water_start);

    // check for parachute release
    if (state_.parachute_attached && !state_.parachute_deattach_attempted &&
        duration_in_water > cfg().delay().parachute_detachment_with_units())
    {
        if (failures_.count(config::StormSimThread::PARACHUTE_NOT_DETACHED_UNRESOLVABLE))
        {
            // if coin flip succeeds, parachute stays attached
            state_.parachute_attached = failures_.at(
                config::StormSimThread::PARACHUTE_NOT_DETACHED_UNRESOLVABLE)(generator_);
        }
        else
        {
            state_.parachute_attached = false;
        }
        state_.parachute_deattach_attempted = true;
    }

    // check for tube release
    if (state_.in_tube && !state_.tube_release_attempted &&
        duration_in_water > cfg().delay().tube_release_with_units())
    {
        if (failures_.count(config::StormSimThread::STUCK_IN_TUBE_UNRESOLVABLE))
        {
            // if coin flip succeeds, stays in tube
            state_.in_tube =
                failures_.at(config::StormSimThread::STUCK_IN_TUBE_UNRESOLVABLE)(generator_);
        }
        else
        {
            state_.in_tube = false;
        }
        state_.tube_release_attempted = true;
    }

    if (state_.in_tube)
    {
        // sinking ...
        quantity<si::velocity> sink_rate =
            state_.parachute_attached ? cfg().in_tube_sink_rates().with_parachute_with_units()
                                      : cfg().in_tube_sink_rates().without_parachute_with_units();
        state_.nav.depth += sink_rate * dt;
    }
    else
    {
        if (state_.parachute_attached)
        {
            // tangled in parachute on surface?
            state_.nav.depth = 0;
            state_.nav.speed_over_ground = 0;
        }
        else
        {
            // normal mission
        }
    }
}

void jaiabot::apps::StormSimThread::mcu_rx(const protobuf::StormMCURequest& mcu_req)
{
    glog.is_debug1() && glog << group("storm") << "[mcu_req] " << mcu_req.ShortDebugString()
                             << std::endl;

    switch (mcu_req.type())
    {
        case protobuf::StormMCURequest::AIR_DESCENT_METADATA_REQUEST:
            send_air_descent_metadata();
            break;
        case protobuf::StormMCURequest::AIR_DESCENT_DATA_REQUEST:
            send_air_descent_data(mcu_req.packet_index());
            break;
        case protobuf::StormMCURequest::SLEEP_REQUEST:
        {
            protobuf::StormMCUResponse sleep_response;
            sleep_response.set_sleep_initiated(true);
            interthread().publish<groups::storm_mcu_serial_out>(
                jaiabot::serial::encode_for_mcu(sleep_response));
        }
        break;
    }
}

void jaiabot::apps::StormSimThread::send_air_descent_metadata()
{
    protobuf::StormMCUResponse metadata_response;
    auto& metadata = *metadata_response.mutable_air_descent_metadata();
    metadata.set_start_time_with_units(
        goby::time::convert<goby::time::MicroTime>(state_.air_descent_start));
    metadata.set_end_time_with_units(
        goby::time::convert<goby::time::MicroTime>(state_.air_descent_end));
    metadata.set_sample_rate_with_units(cfg().air_data_sample_rate_with_units());

    const int samples_per_packet = jaiabot::protobuf::StormAirDescentData::descriptor()
                                       ->FindFieldByName("sample")
                                       ->options()
                                       .GetExtension(dccl::field)
                                       .max_repeat();

    int num_samples = air_descent_data_.size();
    int num_packets = num_samples / samples_per_packet;
    if (num_samples % samples_per_packet != 0)
        num_packets += 1;

    metadata.set_num_packets(num_packets);

    interthread().publish<groups::storm_mcu_serial_out>(
        jaiabot::serial::encode_for_mcu(metadata_response));
}

void jaiabot::apps::StormSimThread::send_air_descent_data(int packet_index)
{
    protobuf::StormMCUResponse data_response;
    auto& data = *data_response.mutable_air_descent_data();
    data.set_packet_index(packet_index);

    const int samples_per_packet = jaiabot::protobuf::StormAirDescentData::descriptor()
                                       ->FindFieldByName("sample")
                                       ->options()
                                       .GetExtension(dccl::field)
                                       .max_repeat();

    int num_samples = air_descent_data_.size();

    for (int s = 0; s < samples_per_packet; ++s)
    {
        auto i = (packet_index * samples_per_packet + s);
        if (i >= num_samples)
            break;
        auto& samp = *data.add_sample();
        samp.set_temperature_with_units(air_descent_data_[i]->temperature);
    }

    interthread().publish<groups::storm_mcu_serial_out>(
        jaiabot::serial::encode_for_mcu(data_response));
}
