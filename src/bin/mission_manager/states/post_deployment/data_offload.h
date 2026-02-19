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
struct DataOffload;
#else
struct DataOffload : boost::statechart::state<DataOffload, PostDeployment>,
                    Notify<DataOffload, protobuf::POST_DEPLOYMENT__DATA_OFFLOAD>
{
    using StateBase = boost::statechart::state<DataOffload, PostDeployment>;

    // PostDeployment::DataOffload
    DataOffload(typename StateBase::my_context c)
        : StateBase(c)
    {
        glog.is_verbose() && glog << "Stop Logging" << std::endl;
        goby::middleware::protobuf::LoggerRequest request;
        request.set_requested_state(goby::middleware::protobuf::LoggerRequest::STOP_LOGGING);
        request.set_close_log(true);
        interprocess().publish<goby::middleware::groups::logger_request>(request);

        if (cfg().data_offload_exclude() != config::MissionManager::TASKPACKET)
        {
            // Reset if recovered
            // If bot is activated again and more task packets
            // are received, then the bot will create a new file
            // to log them
            this->machine().set_create_task_packet_file(true);
        }

        // run preoffload script and then do nothing (actual offload handled by jaiabot_hub_manager)
        if (!run_command(CommandType::PRE_OFFLOAD))
        {
            glog.is_warn() && glog << "Pre offload command Failed" << std::endl;
            this->machine().insert_warning(
                WARNING__MISSION__DATA_PRE_OFFLOAD_FAILED);
            post_event(EvDataOffloadFailed());
        }
        else
        {
            glog.is_debug1() && glog << "Pre offload command Succeeded" << std::endl;
            this->machine().erase_warning(WARNING__MISSION__DATA_PRE_OFFLOAD_FAILED);
        }
    }

    ~DataOffload()
    {
        auto offload_complete_event = dynamic_cast<const EvDataOffloadComplete*>(triggering_event());

        // run post offload only on successful data offload
        if (offload_complete_event)
        {
            if (!run_command(CommandType::POST_OFFLOAD))
            {
                glog.is_warn() && glog << "Post offload command failed" << std::endl;
                this->machine().insert_warning(
                    WARNING__MISSION__DATA_POST_OFFLOAD_FAILED);
            }
            else
            {
                glog.is_debug1() && glog << "Post offload command Succeeded" << std::endl;
                this->machine().erase_warning(
                    WARNING__MISSION__DATA_POST_OFFLOAD_FAILED);
            }
        }

        glog.is_verbose() && glog << "Start Logging" << std::endl;
        goby::middleware::protobuf::LoggerRequest request;
        request.set_requested_state(goby::middleware::protobuf::LoggerRequest::START_LOGGING);
        interprocess().publish<goby::middleware::groups::logger_request>(request);
    }



    using reactions = boost::mpl::list<boost::statechart::transition<EvDataOffloadComplete, Idle>,
                                    boost::statechart::transition<EvDataOffloadFailed, Failed>>;

    private:
    
    enum class CommandType
    {
        PRE_OFFLOAD,
        POST_OFFLOAD
    };

    bool run_command(CommandType type)
    {
        std::string human_command_type;
        std::string command;
        bool success = false;

        if (type == CommandType::PRE_OFFLOAD)
        {
            human_command_type = "pre-data offload";
            command = cfg().data_preoffload_script() + " " + cfg().log_dir() + " " +
                    cfg().log_staging_dir() + this->machine().data_offload_exclude() + " 2>&1";
        }
        else if (type == CommandType::POST_OFFLOAD)
        {
            human_command_type = "post-data offload";
            command = cfg().data_postoffload_script() + " " + cfg().log_dir() + " " +
                    cfg().log_staging_dir() + " " + cfg().log_archive_dir() + " 2>&1";
        }

        glog.is_debug1() && glog << "Performing " << human_command_type << " with command: [" << command
                                << "]" << std::endl;

        FILE* pipe = popen(command.c_str(), "r");
        if (!pipe)
        {
            glog.is_warn() && glog << "Error opening pipe to " << human_command_type
                                << " command: " << strerror(errno) << std::endl;
        }
        else
        {
            std::string stdout;
            std::array<char, 256> buffer;
            while (auto bytes_read = fread(buffer.data(), sizeof(char), buffer.size(), pipe))
            {
                glog.is_debug1() && glog << std::string(buffer.begin(), buffer.begin() + bytes_read)
                                        << std::flush;
                stdout.append(buffer.begin(), buffer.begin() + bytes_read);
            }

            if (!feof(pipe))
            {
                pclose(pipe);
                glog.is_warn() && glog << "Error reading output while executing " << human_command_type
                                    << " command" << std::endl;
            }
            else
            {
                int status = pclose(pipe);
                if (status < 0)
                {
                    glog.is_warn() && glog << "Error executing  " << human_command_type
                                        << " command: " << strerror(errno) << ", output: " << stdout
                                        << std::endl;
                }
                else
                {
                    if (WIFEXITED(status))
                    {
                        int exit_status = WEXITSTATUS(status);
                        if (exit_status == 0)
                            success = true;
                        else
                            glog.is_warn() && glog << "Error: " << human_command_type
                                                << " command returned normally but with "
                                                    "non-zero exit code "
                                                << exit_status << ", output: " << stdout
                                                << std::endl;
                    }

                    else
                    {
                        glog.is_warn() && glog << "Error:  " << human_command_type
                                            << " command exited abnormally. output: " << stdout
                                            << std::endl;
                    }
                }
            }
        }

        return success;
    }

};
#endif
