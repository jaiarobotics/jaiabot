// Copyright 2011-2021:
//   GobySoft, LLC (2013-)
//   Massachusetts Institute of Technology (2007-2014)
//   Community contributors (see AUTHORS file)
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//
//
// This file is part of the Goby Underwater Autonomy Project Binaries
// ("The Goby Binaries").
//
// The Goby Binaries are free software: you can redistribute them and/or modify
// them under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// The Goby Binaries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Goby.  If not, see <http://www.gnu.org/licenses/>.

// tests functionality of the UDPDriver

#include "driver_tester.h"
#include "jaiabot/comms/comms.h"
#include "xbee_driver.h"
#include <cstdlib>

std::shared_ptr<goby::acomms::ModemDriverBase> driver_hub, driver_bot;

void handle_raw_incoming(int driver, const goby::acomms::protobuf::ModemRaw& raw)
{
    std::cout << "Raw in (" << driver << "): " << raw.ShortDebugString() << std::endl;
}

void handle_raw_outgoing(int driver, const goby::acomms::protobuf::ModemRaw& raw)
{
    std::cout << "Raw out (" << driver << "): " << raw.ShortDebugString() << std::endl;
}

int main(int argc, char* argv[])
{
    goby::glog.add_stream(goby::util::logger::DEBUG3, &std::clog);
    std::ofstream fout;

    if (argc == 2)
    {
        fout.open(argv[1]);
        goby::glog.add_stream(goby::util::logger::DEBUG3, &fout);
    }

    goby::glog.set_name(argv[0]);

    driver_hub.reset(new jaiabot::comms::XBeeDriver);
    driver_bot.reset(new jaiabot::comms::XBeeDriver);

    goby::acomms::connect(&driver_hub->signal_raw_incoming,
                          boost::bind(&handle_raw_incoming, 1, _1));
    goby::acomms::connect(&driver_bot->signal_raw_incoming,
                          boost::bind(&handle_raw_incoming, 2, _1));
    goby::acomms::connect(&driver_hub->signal_raw_outgoing,
                          boost::bind(&handle_raw_outgoing, 1, _1));
    goby::acomms::connect(&driver_bot->signal_raw_outgoing,
                          boost::bind(&handle_raw_outgoing, 2, _1));

    goby::acomms::protobuf::DriverConfig cfg_hub, cfg_bot;

    cfg_hub.set_modem_id(1);
    cfg_hub.set_serial_port("/tmp/xbeehub0"); // MUST update for actual hardware
    cfg_hub.set_serial_baud(9600);
    auto& xbee_hub = *cfg_hub.MutableExtension(xbee::protobuf::config);
    xbee_hub.set_hub_id(4); // some arbitrary hub id

    {
        auto& peer_hub = *xbee_hub.add_peers();
        peer_hub.set_hub_id(xbee_hub.hub_id());
        peer_hub.set_serial_number(0x13A200421F31C3); // MUST update for actual hardware
    }
    {
        auto& peer_bot = *xbee_hub.add_peers();
        peer_bot.set_bot_id(0);
        peer_bot.set_serial_number(0x13A200421F6BC2); // MUST update for actual hardware
    }

    cfg_bot.set_modem_id(2);
    cfg_bot.set_serial_port("/tmp/xbeebot0"); // MUST update for actual hardware
    cfg_bot.set_serial_baud(9600);
    auto& xbee_bot = *cfg_bot.MutableExtension(xbee::protobuf::config);
    xbee_bot = xbee_hub;
    xbee_bot.clear_hub_id();

    std::vector<int> tests_to_run({4, 7});

    goby::test::acomms::DriverTester tester(driver_hub, driver_bot, cfg_hub, cfg_bot, tests_to_run,
                                            goby::acomms::protobuf::DRIVER_NONE);
    return tester.run();
}
