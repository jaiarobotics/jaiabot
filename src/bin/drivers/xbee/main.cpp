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
#include "xbee_driver.h"
#include <cstdlib>

std::shared_ptr<goby::acomms::ModemDriverBase> driver1, driver2;

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

    driver1.reset(new goby::acomms::XBeeDriver);
    driver2.reset(new goby::acomms::XBeeDriver);

    goby::acomms::connect(&driver1->signal_raw_incoming, boost::bind(&handle_raw_incoming, 1, _1));
    goby::acomms::connect(&driver2->signal_raw_incoming, boost::bind(&handle_raw_incoming, 2, _1));
    goby::acomms::connect(&driver1->signal_raw_outgoing, boost::bind(&handle_raw_outgoing, 1, _1));
    goby::acomms::connect(&driver2->signal_raw_outgoing, boost::bind(&handle_raw_outgoing, 2, _1));

    goby::acomms::protobuf::DriverConfig cfg1, cfg2;

    cfg1.set_modem_id(1);
    cfg1.set_serial_port("/tmp/xbeehub0");
    cfg1.set_serial_baud(9600);
    auto& xbee1 = *cfg1.MutableExtension(xbee::protobuf::config);
    {
        auto& peer1 = *xbee1.add_peers();
        peer1.set_node_id("1");
        peer1.set_serial_number(0x13A200421F31C3);
    }
    {
        auto& peer2 = *xbee1.add_peers();
        peer2.set_node_id("2");
        peer2.set_serial_number(0x13A200421F6BC2);
    }

    cfg2.set_modem_id(2);
    cfg2.set_serial_port("/tmp/xbeebot0");
    cfg2.set_serial_baud(9600);
    auto& xbee2 = *cfg2.MutableExtension(xbee::protobuf::config);
    xbee2 = xbee1;

    std::vector<int> tests_to_run;
    tests_to_run.push_back(4);

    goby::test::acomms::DriverTester tester(driver1, driver2, cfg1, cfg2, tests_to_run,
                                            goby::acomms::protobuf::DRIVER_NONE);
    return tester.run();
}
