// Copyright 2024:
//   JaiaRobotics LLC
// File authors:
//   Michael Twomey <michael.twomey@jaia.tech>
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

#include <array>
#include <string>

#include "util.h"

namespace jaiabot
{
namespace util
{
void get_rsync_progress(FILE* pipe, uint32_t& percentage)
{
    std::string stdout;
    std::array<char, 256> buffer;

    while (auto bytes_read = fread(buffer.data(), sizeof(char), buffer.size(), pipe))
    {
        stdout.append(buffer.begin(), buffer.begin() + bytes_read);
        std::string rsync_output = "";
        rsync_output.append(buffer.begin(), buffer.begin() + bytes_read);
        size_t pos = rsync_output.find("%");
        if (pos != std::string::npos)
        {
            if (pos >= 3)
            {
                percentage = std::stoi(rsync_output.substr(pos - 3, 3));
            }
        }
    }
}

} // namespace util
} // namespace jaiabot
