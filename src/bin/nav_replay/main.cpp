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

// Offline driver for the nav library.
//
// Runs one GNSS-aided pass over a flattened log, and at a fixed stride forks the estimator into
// a counterfactual trial that replays the next `horizon` seconds with GNSS withheld. Forking
// rather than carving fixed outages out of a single pass yields one trial per stride instead of
// a handful per log, which is the difference between an anecdote and a measurement.
//
// Each trial is scored against the withheld fixes, and against what the current jaiabot stack
// does: freeze at the last fix.

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include "jaiabot/nav/state_estimator.h"

namespace
{
using namespace jaiabot::nav;

struct Record
{
    std::string type;
    double time{0.0};
    std::vector<double> fields;
};

struct TruthPoint
{
    double time{0.0};
    double lat{0.0};
    double lon{0.0};
};

struct Options
{
    std::string log;
    std::string truth;
    std::string out;
    /// Length of each counterfactual GNSS-denied horizon, s.
    double horizon{120.0};
    /// Gap between trial start times, s.
    double stride{20.0};
    /// Let the filter calibrate for this long before the first trial, s.
    double warmup{240.0};
    /// A trial only counts if the bot actually covered this far, m.
    double min_distance{5.0};
    double declination_deg{-13.5};
    bool verbose{false};
    /// Use the magnetometer for heading instead of the rotation vector, where present.
    bool prefer_magnetometer{false};
};

std::vector<std::string> split(const std::string& line, char sep)
{
    std::vector<std::string> parts;
    std::stringstream ss(line);
    std::string item;
    while (std::getline(ss, item, sep)) parts.push_back(item);
    return parts;
}

double to_double(const std::string& s)
{
    try
    {
        return std::stod(s);
    }
    catch (...)
    {
        return std::nan("");
    }
}

std::vector<Record> load_log(const std::string& path)
{
    std::vector<Record> records;
    std::ifstream in(path);
    if (!in) throw std::runtime_error("cannot open " + path);

    std::string line;
    while (std::getline(in, line))
    {
        if (line.empty() || line[0] == '#') continue;
        const auto parts = split(line, ',');
        if (parts.size() < 2) continue;
        Record r;
        r.type = parts[0];
        r.time = to_double(parts[1]);
        for (std::size_t i = 2; i < parts.size(); ++i) r.fields.push_back(to_double(parts[i]));
        if (std::isfinite(r.time)) records.push_back(std::move(r));
    }
    std::stable_sort(records.begin(), records.end(),
                     [](const Record& a, const Record& b) { return a.time < b.time; });
    return records;
}

std::vector<TruthPoint> load_truth(const std::string& path)
{
    std::vector<TruthPoint> truth;
    std::ifstream in(path);
    if (!in) return truth;

    std::string line;
    while (std::getline(in, line))
    {
        if (line.empty() || line[0] == '#') continue;
        const auto parts = split(line, ',');
        if (parts.size() < 3) continue;
        const TruthPoint t{to_double(parts[0]), to_double(parts[1]), to_double(parts[2])};
        if (std::isfinite(t.time) && std::isfinite(t.lat)) truth.push_back(t);
    }
    std::stable_sort(truth.begin(), truth.end(),
                     [](const TruthPoint& a, const TruthPoint& b) { return a.time < b.time; });
    return truth;
}

std::optional<TruthPoint> truth_at(const std::vector<TruthPoint>& truth, double time,
                                   double tolerance = 0.6)
{
    if (truth.empty()) return std::nullopt;
    const auto it = std::lower_bound(truth.begin(), truth.end(), time,
                                     [](const TruthPoint& p, double v) { return p.time < v; });
    std::optional<TruthPoint> best;
    for (auto c : {it == truth.begin() ? it : std::prev(it), it})
    {
        if (c == truth.end() || std::abs(c->time - time) > tolerance) continue;
        if (!best || std::abs(c->time - time) < std::abs(best->time - time)) best = *c;
    }
    return best;
}

/// Feed one record to an estimator. GNSS records are skipped when `withhold_gnss`.
void feed(StateEstimator& est, const Record& r, bool withhold_gnss)
{
    if (r.type == "imu" && r.fields.size() >= 10)
    {
        ImuSample s;
        s.time = r.time;
        s.quaternion = Quaternion(r.fields[0], r.fields[1], r.fields[2], r.fields[3]);
        s.gravity = Vector3({r.fields[4], r.fields[5], r.fields[6]});
        s.angular_velocity = Vector3({r.fields[7], r.fields[8], r.fields[9]});
        s.magnetometer_accuracy = r.fields.size() > 10 ? static_cast<int>(r.fields[10]) : 3;
        // imu,time,qw,qx,qy,qz,gravx,gravy,gravz,gyrox,gyroy,gyroz,mag_accuracy[,magx,magy,magz]
        if (r.fields.size() >= 14)
        {
            const Vector3 field({r.fields[11], r.fields[12], r.fields[13]});
            if (field.all_finite()) s.magnetic_field = field;
        }
        est.handle_imu(s);
    }
    else if (r.type == "gnss" && r.fields.size() >= 3)
    {
        if (withhold_gnss) return;
        GnssSample g;
        g.time = r.time;
        g.lat = r.fields[0];
        g.lon = r.fields[1];
        g.mode = static_cast<int>(r.fields[2]);
        if (r.fields.size() > 3 && std::isfinite(r.fields[3])) g.speed_over_ground = r.fields[3];
        if (r.fields.size() > 4 && std::isfinite(r.fields[4]))
            g.course_over_ground = deg_to_rad(r.fields[4]);
        est.handle_gnss(g);
    }
    else if (r.type == "motor" && !r.fields.empty())
    {
        est.handle_motor(MotorSample{r.time, r.fields[0]});
    }
    else if (r.type == "pressure" && !r.fields.empty())
    {
        est.handle_pressure(PressureSample{r.time, r.fields[0]});
    }
    est.advance_to(r.time);
}

struct Trial
{
    double start{0.0};
    /// Straight-line displacement between the truth endpoints, m.
    double displacement{0.0};
    /// Length of the path actually travelled, m. The fair denominator for a survey pattern,
    /// where a bot can cover hundreds of metres and end up back where it began.
    double path_length{0.0};
    double dead_reckoned_error{0.0};
    double frozen_error{0.0};
    /// Error resolved along and across the truth displacement direction. Along-track error is
    /// a speed-model problem; across-track is a heading problem.
    double along_track_error{0.0};
    double cross_track_error{0.0};
    double reported_sigma{0.0};
    double mean_speed{0.0};
    bool submerged{false};
};

/// Length of the truth path between two times.
double truth_path_length(const std::vector<TruthPoint>& truth, const LocalTangentPlane& plane,
                         double from, double to)
{
    double length = 0.0;
    std::optional<Vector2> previous;
    for (const auto& p : truth)
    {
        if (p.time < from) continue;
        if (p.time > to) break;
        const Vector2 local = plane.to_local(p.lat, p.lon);
        if (previous) length += (local - *previous).norm();
        previous = local;
    }
    return length;
}

void print_percentiles(const char* label, std::vector<double> v)
{
    if (v.empty())
    {
        std::printf("    %-30s (none)\n", label);
        return;
    }
    std::sort(v.begin(), v.end());
    const auto pct = [&](double p) {
        const double idx = p * static_cast<double>(v.size() - 1);
        const std::size_t lo = static_cast<std::size_t>(idx);
        const std::size_t hi = std::min(lo + 1, v.size() - 1);
        return v[lo] + (idx - static_cast<double>(lo)) * (v[hi] - v[lo]);
    };
    std::printf("    %-30s n=%4zu  p50=%8.2f  p90=%8.2f  max=%8.2f\n", label, v.size(), pct(0.5),
                pct(0.9), v.back());
}

void summarise(const char* title, const std::vector<Trial>& trials)
{
    if (trials.empty())
    {
        std::printf("  --- %s: no trials\n", title);
        return;
    }
    std::vector<double> dr, frozen, pct_dr, pct_frozen, ratio, sigma_ratio, along, cross, path;
    int wins = 0;
    for (const auto& t : trials)
    {
        dr.push_back(t.dead_reckoned_error);
        frozen.push_back(t.frozen_error);
        path.push_back(t.path_length);
        along.push_back(std::abs(t.along_track_error));
        cross.push_back(t.cross_track_error);
        if (t.path_length > 1.0)
        {
            pct_dr.push_back(100.0 * t.dead_reckoned_error / t.path_length);
            pct_frozen.push_back(100.0 * t.frozen_error / t.path_length);
        }
        if (t.frozen_error > 0.5) ratio.push_back(t.dead_reckoned_error / t.frozen_error);
        if (t.dead_reckoned_error > 0.5)
            sigma_ratio.push_back(t.reported_sigma / t.dead_reckoned_error);
        if (t.dead_reckoned_error < t.frozen_error) ++wins;
    }
    std::printf("  --- %s: %zu trials, beats frozen in %d (%.0f%%)\n", title, trials.size(), wins,
                100.0 * static_cast<double>(wins) / static_cast<double>(trials.size()));
    print_percentiles("path travelled [m]", path);
    print_percentiles("dead-reckoned error [m]", dr);
    print_percentiles("frozen error [m]", frozen);
    print_percentiles("dr error / path [%]", pct_dr);
    print_percentiles("frozen error / path [%]", pct_frozen);
    print_percentiles("dr error / frozen error", ratio);
    print_percentiles("|along-track| error [m]", along);
    print_percentiles("cross-track error [m]", cross);
    print_percentiles("reported sigma / error", sigma_ratio);
}

int run(const Options& opt)
{
    const auto records = load_log(opt.log);
    const auto truth = load_truth(opt.truth);
    if (records.empty()) throw std::runtime_error("no records in " + opt.log);

    StateEstimatorConfig cfg;
    cfg.declination = deg_to_rad(opt.declination_deg);
    cfg.prefer_magnetometer = opt.prefer_magnetometer;

    StateEstimator reference(cfg);
    std::ofstream out;
    if (!opt.out.empty())
    {
        out.open(opt.out);
        out << "time,mode,est_lat,est_lon,est_e,est_n,sigma,heading_deg,pitch_deg,roll_deg,sog,"
               "stw,cur_e,cur_n,speed_scale,heading_bias_deg,depth,truth_e,truth_n,error\n";
    }

    const double t0 = records.front().time;
    std::vector<Trial> trials;
    double next_trial = t0 + opt.warmup;

    for (std::size_t i = 0; i < records.size(); ++i)
    {
        const Record& r = records[i];
        feed(reference, r, false);
        const NavSolution s = reference.solution();

        if (out.is_open() && s.position_valid)
        {
            const auto tp = truth_at(truth, r.time);
            std::optional<Vector2> local;
            if (tp && reference.tangent_plane().valid())
                local = reference.tangent_plane().to_local(tp->lat, tp->lon);
            out << std::setprecision(15) << r.time << std::setprecision(6) << ","
                << static_cast<int>(s.mode) << "," << std::setprecision(9) << s.lat << "," << s.lon
                << std::setprecision(6) << "," << s.position_east_north[0] << ","
                << s.position_east_north[1] << "," << s.position_sigma << ","
                << rad_to_deg(s.heading) << "," << rad_to_deg(s.pitch) << ","
                << rad_to_deg(s.roll) << "," << s.speed_over_ground << ","
                << s.speed_through_water << "," << s.current_east_north[0] << ","
                << s.current_east_north[1] << "," << s.speed_scale << ","
                << rad_to_deg(s.heading_bias) << "," << s.depth << ",";
            if (local)
                out << (*local)[0] << "," << (*local)[1] << ","
                    << (s.position_east_north - *local).norm() << "\n";
            else
                out << ",,\n";
        }

        if (r.time < next_trial) continue;
        next_trial = r.time + opt.stride;

        // A trial needs a healthy starting solution and truth at both ends.
        if (!s.position_valid || s.mode != NavMode::gnss_aided) continue;
        const auto truth_start = truth_at(truth, r.time);
        const auto truth_end = truth_at(truth, r.time + opt.horizon);
        if (!truth_start || !truth_end) continue;

        StateEstimator trial_est = reference;
        const Vector2 frozen = s.position_east_north;

        double mean_speed = 0.0;
        int speed_samples = 0;
        bool submerged = false;
        for (std::size_t j = i + 1; j < records.size(); ++j)
        {
            if (records[j].time > r.time + opt.horizon) break;
            feed(trial_est, records[j], true);
            const NavSolution ts = trial_est.solution();
            mean_speed += ts.speed_over_ground;
            ++speed_samples;
            if (ts.depth > 1.0) submerged = true;
        }
        trial_est.advance_to(r.time + opt.horizon);

        const auto& plane = reference.tangent_plane();
        const Vector2 start_local = plane.to_local(truth_start->lat, truth_start->lon);
        const Vector2 end_local = plane.to_local(truth_end->lat, truth_end->lon);
        const double distance = (end_local - start_local).norm();
        const double path = truth_path_length(truth, plane, r.time, r.time + opt.horizon);
        if (path < opt.min_distance) continue;

        Trial t;
        t.start = r.time - t0;
        t.displacement = distance;
        t.path_length = path;
        const Vector2 error = trial_est.solution().position_east_north - end_local;
        t.dead_reckoned_error = error.norm();
        t.frozen_error = (frozen - end_local).norm();
        if (const auto direction = normalised(end_local - start_local); direction)
        {
            t.along_track_error = dot(error, *direction);
            t.cross_track_error =
                (error - *direction * t.along_track_error).norm();
        }
        t.reported_sigma = trial_est.solution().position_sigma;
        t.mean_speed = speed_samples ? mean_speed / static_cast<double>(speed_samples) : 0.0;
        t.submerged = submerged;
        trials.push_back(t);
    }

    const auto& d = reference.diagnostics();
    const NavSolution final_solution = reference.solution();
    std::printf("%s\n", opt.log.c_str());
    std::printf("  records=%zu truth=%zu | imu=%ld dropped=%ld resets=%ld steep=%ld\n",
                records.size(), truth.size(), d.imu_samples, d.imu_dropped, d.attitude_resets,
                d.heading_updates_skipped_steep);
    std::printf("  gnss fixes=%ld nofix=%ld | pos %ld/%ld vel %ld/%ld spd %ld/%ld (acc/rej)\n",
                d.gnss_fixes, d.gnss_no_fix, d.position_accepted, d.position_rejected,
                d.velocity_accepted, d.velocity_rejected, d.speed_accepted, d.speed_rejected);
    std::printf("  final calibration: speed_scale=%.3f current=[%.2f %.2f] |cur|=%.2f "
                "heading_bias=%.2f deg\n",
                final_solution.speed_scale, final_solution.current_east_north[0],
                final_solution.current_east_north[1], final_solution.current_east_north.norm(),
                rad_to_deg(final_solution.heading_bias));
    std::printf("  horizon=%.0fs stride=%.0fs min_distance=%.0fm\n", opt.horizon, opt.stride,
                opt.min_distance);

    summarise("all trials", trials);

    std::vector<Trial> moving, slow;
    for (const auto& t : trials) (t.mean_speed >= 0.8 ? moving : slow).push_back(t);
    summarise("underway (mean sog >= 0.8 m/s)", moving);
    summarise("near-stationary", slow);

    if (opt.verbose)
    {
        std::printf("  %8s %8s %8s %8s %8s %8s %8s %8s %6s %5s\n", "start", "path", "displ",
                    "dr_err", "frozen", "along", "cross", "sigma", "sog", "dive");
        for (const auto& t : trials)
            std::printf("  %8.0f %8.1f %8.1f %8.2f %8.2f %8.2f %8.2f %8.2f %6.2f %5d\n", t.start,
                        t.path_length, t.displacement, t.dead_reckoned_error, t.frozen_error,
                        t.along_track_error, t.cross_track_error, t.reported_sigma, t.mean_speed,
                        t.submerged ? 1 : 0);
    }
    return 0;
}

void usage()
{
    std::cerr << "usage: nav_replay --log FILE [--truth FILE] [--out FILE]\n"
                 "                  [--horizon SECONDS] [--stride SECONDS] [--warmup SECONDS]\n"
                 "                  [--min-distance METRES] [--declination DEGREES] [--verbose]\n"
                 "                  [--prefer-magnetometer]\n";
}

} // namespace

int main(int argc, char* argv[])
{
    Options opt;
    try
    {
        for (int i = 1; i < argc; ++i)
        {
            const std::string arg = argv[i];
            const auto next = [&]() -> std::string {
                if (i + 1 >= argc) throw std::runtime_error("missing value for " + arg);
                return argv[++i];
            };
            if (arg == "--log")
                opt.log = next();
            else if (arg == "--truth")
                opt.truth = next();
            else if (arg == "--out")
                opt.out = next();
            else if (arg == "--horizon")
                opt.horizon = std::stod(next());
            else if (arg == "--stride")
                opt.stride = std::stod(next());
            else if (arg == "--warmup")
                opt.warmup = std::stod(next());
            else if (arg == "--min-distance")
                opt.min_distance = std::stod(next());
            else if (arg == "--declination")
                opt.declination_deg = std::stod(next());
            else if (arg == "--verbose")
                opt.verbose = true;
            else if (arg == "--prefer-magnetometer")
                opt.prefer_magnetometer = true;
            else
            {
                usage();
                return 2;
            }
        }

        if (opt.log.empty())
        {
            usage();
            return 2;
        }
        if (opt.truth.empty())
        {
            const auto dot = opt.log.rfind('.');
            opt.truth =
                (dot == std::string::npos ? opt.log : opt.log.substr(0, dot)) + ".truth.csv";
        }
        return run(opt);
    }
    catch (const std::exception& e)
    {
        std::cerr << "nav_replay: " << e.what() << "\n";
        return 1;
    }
}
