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

// Standalone, lightweight implementation of the "jaia admin bounds" action.
//
// As with jaia_ip (which shares its definition of these ranges), this does not link against
// goby or protobuf so that it starts up as quickly as possible: it is called from shell and
// Python that would otherwise have to hardcode the ranges. "jaia admin bounds" execs this
// binary.

#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

#include "jaiabot/utils/ip.h"

namespace
{
struct Bound
{
    const char* key;
    const char* label;
    int min;
    int max;
    bool selected;
    // a fixed id rather than a range, so it is written as one number
    bool scalar{false};
};

const char* const usage_msg =
    "Usage: jaia_bounds [--<id>]... [--min|--max] [--format <text|json>]\n"
    "\n"
    "Outputs the valid ranges of the Jaia bot, hub and fleet ids, as defined by\n"
    "jaiabot/src/lib/utils/ip.h.\n"
    "\n"
    "  --bot_id, --hub_id, --fleet_id, --desktop_id, --gateway_id, --rpicam_id\n"
    "                 report only the given id(s); all of them if none is given\n"
    "  --cloudhub_id  the hub id the CloudHub always uses: one id, not a range\n"
    "  --min, --max   report only that end of the range; both if neither is given\n"
    "  --format       text (the default) or json\n"
    "\n"
    "A single id that comes out as a single number is written bare, so that a script\n"
    "can use it directly.\n"
    "\n"
    "  Examples:\n"
    "    jaia_bounds                  every range, e.g. \"bot id: [0 150]\"\n"
    "    jaia_bounds --bot_id --max   the highest bot id, e.g. \"150\"\n"
    "    jaia_bounds --cloudhub_id    the CloudHub's hub id, e.g. \"30\"\n"
    "    jaia_bounds --format json    every range as a JSON object\n";

[[noreturn]] void die(const std::string& msg)
{
    std::fprintf(stderr, "jaia_bounds: %s\n\n%s\n", msg.c_str(), usage_msg);
    std::exit(1);
}

std::vector<Bound> all_bounds()
{
    using namespace jaiabot::ip;

    auto bot = node_id_range(NodeType::bot);
    auto hub = node_id_range(NodeType::hub);
    auto desktop = node_id_range(NodeType::desktop);
    auto gateway = node_id_range(NodeType::gateway);
    auto rpicam = node_id_range(NodeType::rpicam);

    return {{"bot_id", "bot id", bot.first, bot.second, false},
            {"hub_id", "hub id", hub.first, hub.second, false},
            {"fleet_id", "fleet id", fleet_id_min, fleet_id_max, false},
            {"desktop_id", "desktop id", desktop.first, desktop.second, false},
            {"gateway_id", "gateway id", gateway.first, gateway.second, false},
            {"rpicam_id", "rpicam id", rpicam.first, rpicam.second, false},
            {"cloudhub_id", "cloudhub id", cloudhub_id, cloudhub_id, false, true}};
}
} // namespace

int main(int argc, char* argv[])
{
    auto bounds = all_bounds();

    bool any_selected = false;
    bool want_min = false, want_max = false;
    bool json = false;

    for (int i = 1; i < argc; ++i)
    {
        std::string arg = argv[i];

        if (arg == "-h" || arg == "--help")
        {
            std::fputs(usage_msg, stdout);
            return 0;
        }

        // support both "--flag value" and "--flag=value"
        auto eq = arg.find('=');
        std::string flag = eq != std::string::npos ? arg.substr(0, eq) : arg;

        auto value = [&]()
        {
            if (eq != std::string::npos)
                return arg.substr(eq + 1);
            if (i + 1 < argc)
                return std::string(argv[++i]);
            die("missing value for " + flag);
        };

        if (flag == "--binary")
        {
            // ignored: passed by the 'jaia' tool when exec'ing an external command
            value();
        }
        else if (flag == "--format" || flag == "-f")
        {
            std::string format = value();
            if (format == "json")
                json = true;
            else if (format != "text")
                die("--format must be text or json");
        }
        else if (flag == "--min")
        {
            want_min = true;
        }
        else if (flag == "--max")
        {
            want_max = true;
        }
        else
        {
            bool known = false;
            for (auto& bound : bounds)
            {
                if (flag == "--" + std::string(bound.key))
                {
                    bound.selected = true;
                    any_selected = true;
                    known = true;
                    break;
                }
            }
            if (!known)
                die("unknown argument: " + arg);
        }
    }

    // no selection means everything
    if (!any_selected)
        for (auto& bound : bounds) bound.selected = true;
    if (!want_min && !want_max)
        want_min = want_max = true;

    int selected_count = 0;
    bool only_scalar_selected = true;
    for (const auto& bound : bounds)
    {
        if (bound.selected)
        {
            ++selected_count;
            only_scalar_selected = only_scalar_selected && bound.scalar;
        }
    }

    if (json)
    {
        std::printf("{");
        bool first = true;
        for (const auto& bound : bounds)
        {
            if (!bound.selected)
                continue;

            std::printf("%s\n    \"%s\": ", first ? "" : ",", bound.key);
            if (bound.scalar)
            {
                std::printf("%d", bound.min);
            }
            else
            {
                std::printf("{");
                if (want_min)
                    std::printf(" \"min\": %d%s", bound.min, want_max ? "," : "");
                if (want_max)
                    std::printf(" \"max\": %d", bound.max);
                std::printf(" }");
            }
            first = false;
        }
        std::printf("%s}\n", first ? "" : "\n");
    }
    else if (selected_count == 1 && (want_min != want_max || only_scalar_selected))
    {
        // a single number, for a script to use directly
        for (const auto& bound : bounds)
            if (bound.selected)
                std::printf("%d\n", want_min ? bound.min : bound.max);
    }
    else
    {
        for (const auto& bound : bounds)
        {
            if (!bound.selected)
                continue;

            if (bound.scalar)
                std::printf("%s: %d\n", bound.label, bound.min);
            else if (want_min && want_max)
                std::printf("%s: [%d %d]\n", bound.label, bound.min, bound.max);
            else
                std::printf("%s: %d\n", bound.label, want_min ? bound.min : bound.max);
        }
    }

    return 0;
}
