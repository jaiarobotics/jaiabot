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

template <typename Derived, typename Parent, StormMissionState state, typename ThresholdEvent>
struct ThresholdCommon : boost::statechart::state<Derived, Parent>, Notify<Derived, state>
{
    using StateBase = boost::statechart::state<Derived, Parent>;
    ThresholdCommon(typename StateBase::my_context c) : StateBase(c) {}

    ~ThresholdCommon() {}

    void set_threshold_cfg(const protobuf::StormMission::Threshold& cfg)
    {
        unmet_thresholds_.clear();

        threshold_cfg_ = cfg;
        for (const auto& check : threshold_cfg_.check())
        {
            if (check.condition() != protobuf::StormMission::Threshold::IGNORE &&
                check.value_case() != protobuf::StormMission::Threshold::Check::VALUE_NOT_SET)
            {
                unmet_thresholds_.insert(std::make_pair(check.value_case(), check));
            }
        }
    }

    template <typename EventType, typename ValueType>
    void check_condition(EventType event, ValueType threshold_value,
                         protobuf::StormMission::Threshold::Check check)
    {
        ValueType value;
        switch (check.stat())
        {
            case protobuf::StormMission::Threshold::MEAN: value = ValueType(event.mean); break;
            case protobuf::StormMission::Threshold::MEDIAN: value = ValueType(event.median); break;
            case protobuf::StormMission::Threshold::STDDEV: value = ValueType(event.stddev); break;
        }

        goby::glog.is_debug1() && goby::glog << group("statechart")
                                             << "Checking condition: " << "value: " << value << " "
                                             << check.ShortDebugString() << std::endl;

        bool threshold_met = false;
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

        if (threshold_met)
        {
            goby::glog.is_verbose() && goby::glog << group("statechart")
                                                  << "Condition met: " << "value: " << value << " "
                                                  << check.ShortDebugString() << std::endl;
            unmet_thresholds_.erase(check.value_case());
            if (unmet_thresholds_.empty())
            {
                goby::glog.is_verbose() && goby::glog << group("statechart")
                                                      << "All conditions met." << std::endl;

                this->post_event(ThresholdEvent());
            }
        }
    }

    void check_conductivity(const EvConductivity& ev_c)
    {
        auto it = unmet_thresholds_.find(protobuf::StormMission::Threshold::Check::kConductivity);
        if (it == unmet_thresholds_.end())
            return;

        // TO-DO - change to it->second.conductivity_with_units()
        check_condition(ev_c, it->second.conductivity() * jaiabot::units::microsiemens_per_cm,
                        it->second);
    }
    void check_pressure(const EvPressure& ev_p)
    {
        auto it = unmet_thresholds_.find(protobuf::StormMission::Threshold::Check::kPressure);
        if (it == unmet_thresholds_.end())
            return;

        check_condition(ev_p, it->second.pressure_with_units(), it->second);
    }
    void check_gps_altitude(const EvGPSAltitude& ev_gps_alt)
    {
        auto it = unmet_thresholds_.find(protobuf::StormMission::Threshold::Check::kGpsAltitude);
        if (it == unmet_thresholds_.end())
            return;
        check_condition(ev_gps_alt, it->second.gps_altitude_with_units(), it->second);
    }

    using common_reactions =
        boost::mpl::list<boost::statechart::in_state_reaction<EvConductivity, ThresholdCommon,
                                                              &ThresholdCommon::check_conductivity>,
                         boost::statechart::in_state_reaction<EvPressure, ThresholdCommon,
                                                              &ThresholdCommon::check_pressure>,

                         boost::statechart::in_state_reaction<
                             EvGPSAltitude, ThresholdCommon, &ThresholdCommon::check_gps_altitude>>;

  private:
    protobuf::StormMission::Threshold threshold_cfg_;

    std::map<protobuf::StormMission::Threshold::Check::ValueCase,
             protobuf::StormMission::Threshold::Check>
        unmet_thresholds_;
};
