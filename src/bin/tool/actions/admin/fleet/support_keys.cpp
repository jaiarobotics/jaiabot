// Copyright 2024:
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

#include "support_keys.h"

const std::map<std::string, jaiabot::apps::admin::fleet::SupportKey>&
jaiabot::apps::admin::fleet::support_keys()
{
    // A desktop ID is an address on every fleet's CloudHub VPN, so no two
    // entries may share one, and ip.h allows only 1 through 9.
    static const std::map<std::string, SupportKey> keys = {
        // example support desktop - nobody holds the private half of this key
        {"jaia@support_example", {"CkA5z9dOczQFFX+l3jKFc+SKrFys0ePoHFnErg+Y8Ec=", 9}},
    };
    return keys;
}
