// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Ed Sanville <edsanville@gmail.com>
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

#ifdef JAIABOT_MISSION_MANAGER_FWD_DECL
struct SelfTest;
#else
struct SelfTest : boost::statechart::state<SelfTest, PreDeployment>,
                  Notify<SelfTest, protobuf::PRE_DEPLOYMENT__SELF_TEST, protobuf::SETPOINT_STOP,
                         protobuf::CAN_BE_DELEGATED>
{
    using StateBase = boost::statechart::state<SelfTest, PreDeployment>;
    SelfTest(typename StateBase::my_context c) : StateBase(c)
    {
        const double retry_seconds =
            cfg().self_test_delegate_retry_interval_with_units<goby::time::SITime>().value();
        retry_enabled_ =
            retry_seconds > 0 && app().is_delegated(protobuf::PRE_DEPLOYMENT__SELF_TEST);
        if (retry_enabled_)
        {
            retry_interval_ = std::chrono::duration_cast<goby::time::SteadyClock::duration>(
                std::chrono::duration<double>(retry_seconds));
            next_retry_ = goby::time::SteadyClock::now() + retry_interval_;
        }
    }
    ~SelfTest() {}

    // Notify sends the delegate request once on entry; if the delegate had already finished
    // its self test (and its one response was ignored because we weren't in SELF_TEST yet),
    // nothing would ever move us on. Keep asking until we get an answer.
    void loop(const EvLoop&)
    {
        if (!retry_enabled_)
            return;

        auto now = goby::time::SteadyClock::now();
        if (now < next_retry_)
            return;
        next_retry_ = now + retry_interval_;

        glog.is_warn() && glog << "No self test delegate response yet; re-sending request"
                               << std::endl;
        protobuf::MissionStateDelegateRequest req;
        req.set_state(protobuf::PRE_DEPLOYMENT__SELF_TEST);
        interprocess().publish<groups::state_delegate_request>(req);
    }

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvSelfTestFails, Failed>,
                         boost::statechart::transition<EvSelfTestSuccessful, WaitForMissionPlan>,
                         boost::statechart::in_state_reaction<EvLoop, SelfTest, &SelfTest::loop>>;

  private:
    bool retry_enabled_{false};
    goby::time::SteadyClock::duration retry_interval_{};
    goby::time::SteadyClock::time_point next_retry_;
};
#endif
