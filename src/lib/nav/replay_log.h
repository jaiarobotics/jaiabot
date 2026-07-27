// Copyright 2025:
//   JaiaRobotics LLC
//
// This file is part of the JaiaBot Project Libraries
// ("The Jaia Libraries").
//
// The Jaia Libraries are free software: you can redistribute them and/or modify
// them under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// The Jaia Libraries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with the Jaia Libraries.  If not, see <http://www.gnu.org/licenses/>.

#ifndef JAIABOT_NAV_REPLAY_LOG_H
#define JAIABOT_NAV_REPLAY_LOG_H

#include <algorithm>
#include <cmath>
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

/// Flattened-log reader shared by nav_replay and nav_replay_bench. Both must parse identically
/// or the comparison between them measures the readers rather than the code under test.
///
/// One line per sample, sorted by time:
///   imu,time,qw,qx,qy,qz,gravx,gravy,gravz,gyrox,gyroy,gyroz,mag_accuracy[,magx,magy,magz]
///   gnss,time,lat,lon,mode[,speed_over_ground,course_over_ground_deg]
///   motor,time,rpm
///   pressure,time,depth
namespace jaiabot
{
namespace nav
{
struct Record
{
    std::string type;
    double time{0.0};
    std::vector<double> fields;

    /// Field by index, or NaN when the log is short - callers check with std::isfinite rather
    /// than indexing past the end.
    double field(std::size_t i) const
    {
        return i < fields.size() ? fields[i] : std::nan("");
    }
};

struct TruthPoint
{
    double time{0.0};
    double lat{0.0};
    double lon{0.0};
};

inline std::vector<std::string> split_line(const std::string& line, char sep)
{
    std::vector<std::string> parts;
    std::stringstream ss(line);
    std::string item;
    while (std::getline(ss, item, sep)) parts.push_back(item);
    return parts;
}

inline double to_double_or_nan(const std::string& s)
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

inline std::vector<Record> load_replay_log(const std::string& path)
{
    std::vector<Record> records;
    std::ifstream in(path);
    if (!in) throw std::runtime_error("cannot open " + path);

    std::string line;
    while (std::getline(in, line))
    {
        if (line.empty() || line[0] == '#') continue;
        const auto parts = split_line(line, ',');
        if (parts.size() < 2) continue;
        Record r;
        r.type = parts[0];
        r.time = to_double_or_nan(parts[1]);
        for (std::size_t i = 2; i < parts.size(); ++i)
            r.fields.push_back(to_double_or_nan(parts[i]));
        if (std::isfinite(r.time)) records.push_back(std::move(r));
    }
    std::stable_sort(records.begin(), records.end(),
                     [](const Record& a, const Record& b) { return a.time < b.time; });
    return records;
}

inline std::vector<TruthPoint> load_truth_log(const std::string& path)
{
    std::vector<TruthPoint> truth;
    std::ifstream in(path);
    if (!in) return truth;

    std::string line;
    while (std::getline(in, line))
    {
        if (line.empty() || line[0] == '#') continue;
        const auto parts = split_line(line, ',');
        if (parts.size() < 3) continue;
        const TruthPoint t{to_double_or_nan(parts[0]), to_double_or_nan(parts[1]),
                           to_double_or_nan(parts[2])};
        if (std::isfinite(t.time) && std::isfinite(t.lat)) truth.push_back(t);
    }
    std::stable_sort(truth.begin(), truth.end(),
                     [](const TruthPoint& a, const TruthPoint& b) { return a.time < b.time; });
    return truth;
}

} // namespace nav
} // namespace jaiabot

#endif
