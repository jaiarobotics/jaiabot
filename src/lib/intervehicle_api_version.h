// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//
//
// This file is part of the JaiaBot Project Libraries
// ("The Jaia Libraries").
//
// The Jaia Libraries are free software: you can redistribute them and/or modify
// them under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 2.1 of the License, or
// (at your option) any later version.
//
// The Jaia Libraries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with the Jaia Libraries.  If not, see <http://www.gnu.org/licenses/>.

#ifndef JAIABOT_SRC_LIB_INTERVEHICLE_API_VERSION_H
#define JAIABOT_SRC_LIB_INTERVEHICLE_API_VERSION_H

#include <cstdint>

// Kept out of version.h, which is regenerated with the git revision on every commit:
// groups.h needs this constant, and pulling in the revision alongside it would rebuild
// most of the codebase whenever HEAD moves.

namespace jaiabot
{
// clang-format off
// (don't change @@ macros for CMake)
constexpr std::uint32_t INTERVEHICLE_API_VERSION{@PROJECT_INTERVEHICLE_API_VERSION@};
// clang-format on
} // namespace jaiabot

#endif
