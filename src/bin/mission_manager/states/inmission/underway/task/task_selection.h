// similar to MovementSelection but for Tasks
struct TaskSelection : boost::statechart::state<TaskSelection, Task>,
                       AppMethodsAccess<TaskSelection>
{
    struct EvTaskSelect : boost::statechart::event<EvTaskSelect>
    {
    };

    using StateBase = boost::statechart::state<TaskSelection, Task>;
    TaskSelection(typename StateBase::my_context c) : StateBase(c)
    {
        goby::glog.is_debug2() && goby::glog << group("task") << "Entering TaskSelect" << std::endl;
        post_event(EvTaskSelect());
    }
    ~TaskSelection() {}

    boost::statechart::result react(const EvTaskSelect&)
    {
        boost::optional<protobuf::MissionTask> current_task = context<Task>().current_task();

        if (current_task && current_task->type() != protobuf::MissionTask::NONE)
        {
            goby::glog.is_verbose() && goby::glog << group("task") << "Starting task: "
                                                  << current_task.get().ShortDebugString()
                                                  << std::endl;

            switch (current_task->type())
            {
                case protobuf::MissionTask::NONE: return discard_event();
                case protobuf::MissionTask::DIVE: return transit<Dive>();
                case protobuf::MissionTask::STATION_KEEP: return transit<StationKeep>();
                case protobuf::MissionTask::SURFACE_DRIFT: return transit<SurfaceDrift>();
                case protobuf::MissionTask::CONSTANT_HEADING: return transit<ConstantHeading>();
            }
        }

        // no task or invalid task, so consider it complete
        goby::glog.is_verbose() && goby::glog << group("task")
                                              << "No task for this goal. Proceeding to next goal"
                                              << std::endl;
        post_event(EvTaskComplete());
        return discard_event();
    }

    using reactions = boost::statechart::custom_reaction<EvTaskSelect>;
};

