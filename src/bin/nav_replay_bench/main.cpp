// Copyright 2025:
//   JaiaRobotics LLC
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

// Replays a flattened log onto the interprocess bus as real IMU / gpsd / motor / pressure
// messages, and captures the NavSolution that jaiabot_state_estimator publishes in response.
//
// Why this exists: the 79 unit tests and nav_replay both drive src/lib/nav directly, so nothing
// covered src/bin/state_estimator/app.cpp - the subscription groups, the protobuf-to-sample
// translation, the depth/sensor_depth fallback, the declination refresh. That is precisely where
// the two bugs that reached a running system lived (a SIGFPE from reading cfg() in its own
// initializer, and a missing NavSolution symbol). Running the same log through both paths and
// diffing the solutions closes that gap: agreement means the offline accuracy results transfer
// to the vehicle, and a divergence is a translation bug found on a desk instead of on the water.
//
// Timing: the estimator stamps every sample with goby's clock, not with the log timestamp, so
// the replay has to be paced rather than dumped. Goby sim time supplies the rate (warp), and
// because the filter is driven only by differences between sample times, the constant offset
// between sim time and log time is harmless. Pacing that slips would not be harmless, so the
// lag is measured and reported.

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/gpsd.pb.h>
#include <goby/zeromq/application/single_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/motor.pb.h"
#include "jaiabot/messages/nav.pb.h"
#include "jaiabot/messages/sensor/pressure_temperature.pb.h"
#include "jaiabot/nav/replay_log.h"

#include <cmath>
#include <cstdio>
#include <fstream>

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase = goby::zeromq::SingleThreadApplication<jaiabot::config::NavReplayBench>;

namespace jaiabot
{
namespace apps
{
class NavReplayBenchApp : public ApplicationBase
{
  public:
    NavReplayBenchApp();

  private:
    void loop() override;
    void publish_record(const nav::Record& r);
    /// Sim-clock seconds; the same clock the estimator stamps its samples with.
    static double now_seconds()
    {
        return goby::time::SystemClock::now<goby::time::SITime>().value();
    }
    /// Replay clock in log time: log_t0 plus however much replayed time has elapsed.
    double log_now() const { return log_t0_ + (now_seconds() - sim_start_); }

    std::vector<nav::Record> records_;
    std::size_t next_{0};
    double log_t0_{0.0};
    double log_end_{0.0};
    /// Set on the first loop(), not in the constructor. Goby spends of order a wall second
    /// setting up subscriptions after construction, and at warp W that is W seconds of replay
    /// time - long enough that the first iteration would dump W seconds of records at once,
    /// stamped microseconds apart, and hand the filter a meaningless dt.
    double sim_start_{std::nan("")};
    std::ofstream out_;
    long published_{0};
    long solutions_{0};
    /// How late records went out relative to their scheduled replay time. A single startup
    /// outlier is harmless; sustained lag means the warp outran the machine, sample spacing was
    /// distorted, and the comparison against the offline run is not trustworthy. Distinguishing
    /// those two needs more than a maximum, so keep every lag and report the distribution.
    /// (log-time offset, lag) per published record.
    std::vector<std::pair<double, double>> lags_;
    double max_lag_{0.0};
    double max_lag_at_{0.0};
};
} // namespace apps
} // namespace jaiabot

jaiabot::apps::NavReplayBenchApp::NavReplayBenchApp() : ApplicationBase(100 * si::hertz)
{
    records_ = nav::load_replay_log(cfg().log());
    if (records_.empty()) throw std::runtime_error("no records in " + cfg().log());

    const double first = records_.front().time;
    log_t0_ = first + cfg().skip();
    log_end_ = cfg().duration() > 0 ? log_t0_ + cfg().duration() : records_.back().time;
    while (next_ < records_.size() && records_[next_].time < log_t0_) ++next_;

    out_.open(cfg().out());
    if (!out_) throw std::runtime_error("cannot write " + cfg().out());
    // declination is captured because the application looks it up from the World Magnetic Model at
    // the live position while nav_replay takes a fixed --declination. That difference is a heading
    // offset between the two paths, so the comparison has to align on the value the app actually
    // used rather than assume they agree.
    out_ << "log_time,mode,lat,lon,sigma,heading_deg,pitch_deg,roll_deg,sog,stw,speed_scale,"
            "heading_bias_deg,depth,declination_deg\n";
    out_ << std::setprecision(10);

    interprocess().subscribe<groups::nav_solution>([this](const protobuf::NavSolution& nav) {
        ++solutions_;
        // Only a positioned solution is comparable against the offline run; before the first fix
        // there is nothing to line up.
        if (!nav.position_valid()) return;
        out_ << log_now() << ',' << nav.mode() << ',' << nav.location().lat() << ','
             << nav.location().lon() << ',' << nav.position_sigma() << ','
             << (nav.has_attitude() ? nav.attitude().heading() : std::nan("")) << ','
             << (nav.has_attitude() ? nav.attitude().pitch() : std::nan("")) << ','
             << (nav.has_attitude() ? nav.attitude().roll() : std::nan("")) << ','
             << nav.speed().over_ground() << ',' << nav.speed().over_water() << ','
             << nav.speed_scale() << ',' << nav.heading_bias() << ',' << nav.depth() << ','
             << nav.magnetic_declination() << '\n';
    });

    glog.is_verbose() && glog << "replaying " << records_.size() - next_ << " records over "
                              << log_end_ - log_t0_ << " s of log time, warp "
                              << goby::time::SimulatorSettings::warp_factor << std::endl;
}

void jaiabot::apps::NavReplayBenchApp::publish_record(const nav::Record& r)
{
    if (r.type == "imu" && r.fields.size() >= 10)
    {
        protobuf::IMUData imu;
        auto& q = *imu.mutable_quaternion();
        q.set_w(r.field(0));
        q.set_x(r.field(1));
        q.set_y(r.field(2));
        q.set_z(r.field(3));
        auto& g = *imu.mutable_gravity();
        g.set_x(r.field(4));
        g.set_y(r.field(5));
        g.set_z(r.field(6));
        auto& w = *imu.mutable_angular_velocity();
        w.set_x(r.field(7));
        w.set_y(r.field(8));
        w.set_z(r.field(9));
        if (std::isfinite(r.field(10)))
            imu.mutable_accuracies()->set_magnetometer(static_cast<int>(r.field(10)));
        if (std::isfinite(r.field(11)) && std::isfinite(r.field(12)) && std::isfinite(r.field(13)))
        {
            auto& m = *imu.mutable_magnetic_field();
            m.set_x(r.field(11));
            m.set_y(r.field(12));
            m.set_z(r.field(13));
        }
        interprocess().publish<groups::imu>(imu);
    }
    else if (r.type == "gnss" && r.fields.size() >= 3)
    {
        goby::middleware::protobuf::gpsd::TimePositionVelocity tpv;
        tpv.mutable_location()->set_lat(r.field(0));
        tpv.mutable_location()->set_lon(r.field(1));
        tpv.set_mode(static_cast<goby::middleware::protobuf::gpsd::TimePositionVelocity::Mode>(
            static_cast<int>(r.field(2))));
        if (std::isfinite(r.field(3))) tpv.set_speed(r.field(3));
        if (std::isfinite(r.field(4))) tpv.set_track(r.field(4));
        interprocess().publish<goby::middleware::groups::gpsd::tpv>(tpv);
    }
    else if (r.type == "motor" && !r.fields.empty())
    {
        protobuf::Motor motor;
        motor.set_rpm(r.field(0));
        interprocess().publish<groups::motor_status>(motor);
    }
    else if (r.type == "pressure" && !r.fields.empty())
    {
        protobuf::PressureAdjustedData pressure;
        pressure.set_depth(r.field(0));
        // pressure_raw is `required`, so protobuf refuses to serialise without it even though
        // the estimator only reads depth. Fill it consistently rather than with a constant:
        // seawater is ~1 dbar per metre, on top of ~10.13 dbar of atmosphere.
        pressure.set_pressure_raw(10.13 + r.field(0));
        interprocess().publish<groups::pressure_adjusted>(pressure);
    }
    else
    {
        return;
    }
    ++published_;
}

void jaiabot::apps::NavReplayBenchApp::loop()
{
    if (!std::isfinite(sim_start_)) sim_start_ = now_seconds();

    const double now = log_now();

    while (next_ < records_.size() && records_[next_].time <= now &&
           records_[next_].time <= log_end_)
    {
        const double lag = now - records_[next_].time;
        if (lag > max_lag_)
        {
            max_lag_ = lag;
            max_lag_at_ = records_[next_].time - log_t0_;
        }
        lags_.emplace_back(records_[next_].time - log_t0_, lag);
        publish_record(records_[next_]);
        ++next_;
    }

    const bool exhausted = next_ >= records_.size() || records_[next_].time > log_end_;
    if (exhausted && now > log_end_ + cfg().quit_after())
    {
        out_.flush();
        // Goby's subscription handshake delays the second loop iteration by of order a second,
        // so one chunk of records at the very start always goes out compressed. That transient is
        // unavoidable and harmless as long as the comparison skips it, so judge pacing on the
        // steady state and report the two separately rather than letting startup set off alarms.
        std::vector<double> steady;
        for (const auto& [offset, lag] : lags_)
            if (offset >= cfg().settle()) steady.push_back(lag);
        std::sort(steady.begin(), steady.end());
        const auto quantile = [&steady](double q) {
            return steady.empty() ? 0.0 : steady[static_cast<std::size_t>(q * (steady.size() - 1))];
        };
        std::printf("bench: published=%ld solutions=%ld log_span=%.1fs out=%s\n", published_,
                    solutions_, log_end_ - log_t0_, cfg().out().c_str());
        std::printf("bench: startup transient max=%.3fs at +%.2fs | steady-state (after +%.0fs) "
                    "lag p50=%.4fs p99=%.4fs max=%.4fs over %zu records\n",
                    max_lag_, max_lag_at_, cfg().settle(), quantile(0.5), quantile(0.99),
                    steady.empty() ? 0.0 : steady.back(), steady.size());
        if (quantile(0.99) > 0.05)
            std::printf("bench: WARNING sustained lag past settle - the warp outran the machine, "
                        "so sample spacing was distorted and this is not a fair comparison\n");
        quit();
    }
}

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::NavReplayBenchApp>(argc, argv);
}
