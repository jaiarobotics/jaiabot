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

// Base class for all states to manage reaching various thresholds of conductivity, pressure, etc.
// When thresholds are met, the ThresholdEvent is posted

#include "jaiabot/units/conductivity.h"

namespace jaiabot::statechart
{

template <typename SensorEvent> struct threshold_traits; // intentionally undefined

template <> struct threshold_traits<EvConductivity>
{
    static constexpr auto value_case = protobuf::StormMission::Threshold::Check::kConductivity;

    static auto threshold_value(const protobuf::StormMission::Threshold::Check& c)
    {
        // TO-DO: change to c.conductivity_with_units()
        return c.conductivity() * ::jaiabot::units::microsiemens_per_cm;
    }
};

template <> struct threshold_traits<EvPressure>
{
    static constexpr auto value_case = protobuf::StormMission::Threshold::Check::kPressure;

    static auto threshold_value(const protobuf::StormMission::Threshold::Check& c)
    {
        return c.pressure_with_units();
    }
};

template <> struct threshold_traits<EvGPSAltitude>
{
    static constexpr auto value_case = protobuf::StormMission::Threshold::Check::kGpsAltitude;

    static auto threshold_value(const protobuf::StormMission::Threshold::Check& c)
    {
        return c.gps_altitude_with_units();
    }
};

template <typename Derived> struct ThresholdCheckerBase
{
    ThresholdCheckerBase(const std::string& name, const protobuf::StormMission::Threshold& cfg)
        : threshold_cfg_(cfg), name_(name)
    {
        unmet_thresholds_.clear();

        for (const auto& check : threshold_cfg_.check())
        {
            if (check.condition() != protobuf::StormMission::Threshold::IGNORE &&
                check.value_case() != protobuf::StormMission::Threshold::Check::VALUE_NOT_SET)
            {
                unmet_thresholds_.insert(std::make_pair(check.value_case(), check));
            }
        }
    }

    virtual ~ThresholdCheckerBase() {}

    template <typename SensorEvent> void check(Derived* state, const SensorEvent& s_event)
    {
        const auto key = threshold_traits<SensorEvent>::value_case;

        auto unmet_it = unmet_thresholds_.find(key);
        if (unmet_it == unmet_thresholds_.end())
            return;

        auto threshold_value = threshold_traits<SensorEvent>::threshold_value(unmet_it->second);

        const protobuf::StormMission::Threshold::Check& check = unmet_it->second;
        decltype(threshold_value) value{};
        switch (check.stat())
        {
            case protobuf::StormMission::Threshold::MEAN:
                value = decltype(value)(s_event.mean);
                break;

            case protobuf::StormMission::Threshold::MEDIAN:
                value = decltype(value)(s_event.median);
                break;

            case protobuf::StormMission::Threshold::STDDEV:
                value = decltype(value)(s_event.stddev);
                break;
        }

        bool threshold_met = false;
        bool threshold_met_complete = false;

        switch (check.condition())
        {
            case protobuf::StormMission::Threshold::IGNORE: break;

            case protobuf::StormMission::Threshold::GREATER_THAN:
                threshold_met = value > threshold_value;
                break;

            case protobuf::StormMission::Threshold::LESS_THAN:
                threshold_met = value < threshold_value;
                break;
        }

        std::string result_string = threshold_met ? "TRUE" : "FALSE";

        auto hold_start_it = thresholds_met_start_.find(key);

        if (threshold_met)
        {
            auto now = goby::time::SteadyClock::now();

            if (hold_start_it == thresholds_met_start_.end())
            {
                result_string = "TRUE/FIRST";
                bool new_element = false;
                std::tie(hold_start_it, new_element) =
                    thresholds_met_start_.insert(std::make_pair(key, now));
            }

            auto start_time = hold_start_it->second;

            auto hold_time = goby::time::convert_duration<goby::time::SteadyClock::duration>(
                check.hold_time_with_units());

            if (now >= start_time + hold_time)
            {
                result_string = "TRUE/COMPLETE";
                threshold_met_complete = true;
            }
        }
        else if (hold_start_it != thresholds_met_start_.end())
        {
            result_string = "FALSE/RESET";
            thresholds_met_start_.erase(hold_start_it);
        }

        goby::glog.is_debug1() && goby::glog << group("statechart") << "[" << name_
                                             << "]: Condition (" << result_string
                                             << "): " << "value: " << value << " "
                                             << check.ShortDebugString() << std::endl;

        if (threshold_met_complete)
        {
            unmet_thresholds_.erase(key);
            if (unmet_thresholds_.empty())
            {
                goby::glog.is_debug1() && goby::glog << group("statechart") << "[" << name_
                                                     << "]: All thresholds met" << std::endl;
                this->post_event(state);
            }
        }
    }

    virtual void post_event(Derived* state) = 0;

  private:
    std::string name_;
    protobuf::StormMission::Threshold threshold_cfg_;

    std::map<protobuf::StormMission::Threshold::Check::ValueCase,
             protobuf::StormMission::Threshold::Check>
        unmet_thresholds_;

    std::map<protobuf::StormMission::Threshold::Check::ValueCase,
             goby::time::SteadyClock::time_point>
        thresholds_met_start_;
};

template <typename Derived, typename ThresholdEvent>
struct ThresholdChecker : public ThresholdCheckerBase<Derived>
{
    ThresholdChecker(const std::string& name, const protobuf::StormMission::Threshold& cfg)
        : ThresholdCheckerBase<Derived>(name, cfg)
    {
    }

    ~ThresholdChecker() {}

    void post_event(Derived* state) override { state->post_event(ThresholdEvent()); }
};

template <typename Derived> struct ThresholdCommon
{
    ThresholdCommon() {}
    ~ThresholdCommon() {}

    template <typename ThresholdEvent>
    void set_threshold_cfg(const std::string& name, const protobuf::StormMission::Threshold& cfg)
    {
        checkers_.emplace(std::make_unique<ThresholdChecker<Derived, ThresholdEvent>>(name, cfg));
    }

    template <typename SensorEvent> boost::statechart::result react(const SensorEvent& sensor_event)
    {
        for (auto& checker : checkers_)
            checker->check(static_cast<Derived*>(this), sensor_event);

        return static_cast<Derived*>(this)->discard_event();
    }

    using common_reactions = boost::mpl::list<boost::statechart::custom_reaction<EvConductivity>,
                                              boost::statechart::custom_reaction<EvPressure>,
                                              boost::statechart::custom_reaction<EvGPSAltitude>>;

  private:
    std::set<std::unique_ptr<ThresholdCheckerBase<Derived>>> checkers_;
};

} // namespace jaiabot::statechart
