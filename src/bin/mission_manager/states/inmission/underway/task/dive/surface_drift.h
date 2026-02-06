struct SurfaceDrift
    : SurfaceDriftTaskCommon<SurfaceDrift, Dive,
                             protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__SURFACE_DRIFT>
{
    SurfaceDrift(typename StateBase::my_context c)
        : SurfaceDriftTaskCommon<SurfaceDrift, Dive,
                                 protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__SURFACE_DRIFT>(c)
    {
    }
};

