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
struct SurfaceDrift;
#else
struct SurfaceDrift : SurfaceDriftTaskCommon<SurfaceDrift, Task,
                                             protobuf::IN_MISSION__UNDERWAY__TASK__SURFACE_DRIFT>
{
    SurfaceDrift(typename StateBase::my_context c)
        : SurfaceDriftTaskCommon<SurfaceDrift, Task,
                                 protobuf::IN_MISSION__UNDERWAY__TASK__SURFACE_DRIFT>(c)
    {
    }
};
#endif
