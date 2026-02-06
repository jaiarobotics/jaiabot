struct SurfaceDrift : SurfaceDriftTaskCommon<SurfaceDrift, Task,
                                             protobuf::IN_MISSION__UNDERWAY__TASK__SURFACE_DRIFT>
{
    SurfaceDrift(typename StateBase::my_context c)
        : SurfaceDriftTaskCommon<SurfaceDrift, Task,
                                 protobuf::IN_MISSION__UNDERWAY__TASK__SURFACE_DRIFT>(c)
    {
    }
};

