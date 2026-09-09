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
struct Idle;
#else
struct Idle : boost::statechart::state<Idle, PreDeployment>,
              Notify<Idle, protobuf::PRE_DEPLOYMENT__IDLE>
{
    using StateBase = boost::statechart::state<Idle, PreDeployment>;

    // PreDeployment::Idle
    Idle(typename StateBase::my_context c) : StateBase(c)
    {
        if (!app().is_test_mode(config::MissionManager::ENGINEERING_TEST__ALWAYS_LOG_EVEN_WHEN_IDLE))
        {
            glog.is_verbose() && glog << "Stop Logging" << std::endl;
            goby::middleware::protobuf::LoggerRequest request;
            request.set_requested_state(goby::middleware::protobuf::LoggerRequest::STOP_LOGGING);
            interprocess().publish<goby::middleware::groups::logger_request>(request);
        }
    }

    ~Idle()
    {
        if (!app().is_test_mode(config::MissionManager::ENGINEERING_TEST__ALWAYS_LOG_EVEN_WHEN_IDLE))
        {
            glog.is_verbose() && glog << "Start Logging" << std::endl;
            goby::middleware::protobuf::LoggerRequest request;
            request.set_requested_state(goby::middleware::protobuf::LoggerRequest::START_LOGGING);
            interprocess().publish<goby::middleware::groups::logger_request>(request);
        }
    }

    using reactions = boost::mpl::list<boost::statechart::transition<EvActivate, SelfTest>>;
};
#endif
