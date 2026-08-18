# STM32 Firmware

Firmware for the STM32 microcontrollers used on JaiaBot hardware. Each board is
a separate STM32CubeMX project that builds with the ARM GCC toolchain and shares
the project's Protobuf message definitions via [nanopb](https://jpa.kapsi.fi/nanopb/).

If you have never built this code before, work through
[One-time environment setup](#1-one-time-environment-setup) first — the
`Drivers/` directory and the ARM toolchain are **not** in the repository and
nothing will compile until you fetch them.

---

## Layout

```
src/stm32/
├── Drivers/            # STM32L4 HAL + CMSIS — NOT in git, fetched by script
├── power_board/        # STM32L433VCTx  — power/low-power board
│   ├── Core/           #   CubeMX-generated init + application code
│   ├── USB_DEVICE/     #   USB CDC (virtual COM port) stack
│   ├── FATFS/          #   FatFs middleware
│   ├── Middlewares/    #   ST USB device library, FatFs
│   ├── *.ioc           #   CubeMX project file (regenerates Core/, etc.)
│   ├── Makefile        #   CubeMX-generated build (edited for nanopb includes)
│   └── CMakeLists.txt  #   hooks this board into the top-level jaiabot build
└── bio_payload/        # STM32L433RCTx — bio payload sensor board
    └── (same structure)
```

Supporting scripts live in [`scripts/stm32/`](../../scripts/stm32/):

| Script | Purpose |
| --- | --- |
| `fetch_drivers.sh` | Downloads pinned HAL/CMSIS into `src/stm32/Drivers/` |
| `build_power_board_package.sh` | Standalone build of `power_board` (generates nanopb sources first) |
| `build_bio_payload_package.sh` | Standalone build of `bio_payload` |
| `deploy_power_board.sh` | Flashes a running bot over USB DFU |
| `deploy_bio_payload.sh` | Flashes a running bot over the UART bootloader |

Build outputs (`build/`), fetched drivers (`Drivers/`), and generated nanopb
sources (`nanopb/`, `jaiabot/`) are all gitignored — see the `src/stm32` entries
in [.gitignore](../../.gitignore).

---

## 1. One-time environment setup

### 1.1 Host OS

Development is done on Ubuntu Linux matching the `jaiabot` release branch (see
[Building and Installing JaiaBot software](../doc/markdown/page020_build.md)).
WSL2 works for building and for CubeMX code generation. USB flashing from WSL2
requires `usbipd-win` to attach the ST-Link or DFU device — most developers find
it simpler to flash from a native Linux box or from the bot itself.

### 1.2 Toolchain and flashing tools

Everything the firmware needs is installed by the project's standard setup script:

```bash
cd jaiabot
./scripts/setup-tools-build.sh
```

That installs the ARM cross-compiler and flashing tools:

```bash
sudo apt-get install \
    gcc-arm-none-eabi \
    binutils-arm-none-eabi \
    libnewlib-arm-none-eabi \
    openocd \
    stlink-tools
```

and then runs `fetch_drivers.sh` for you (see below). If you only want the
firmware side, you can run those two steps by hand instead of the whole script.

For flashing you may also want, depending on how you connect to the board:

```bash
sudo apt-get install dfu-util      # USB DFU (power_board, in-system update)
```

and, for the UART bootloader path, ST's
[STM32CubeProgrammer](https://www.st.com/en/development-tools/stm32cubeprog.html)
which provides `STM32_Programmer_CLI`. (`scripts/stm32/stm32flash-0.7.tar.gz` is
bundled as an alternative that the bot builds locally.)

### 1.3 HAL and CMSIS drivers

`src/stm32/Drivers/` is **not** checked in. It is populated from pinned upstream
ST releases:

```bash
./scripts/stm32/fetch_drivers.sh          # no-op if already complete
./scripts/stm32/fetch_drivers.sh --force  # re-download / upgrade
```

The versions are pinned at the top of that script
(`HAL_DRIVER_VERSION`, `CMSIS_DEVICE_VERSION`, `CMSIS_CORE_VERSION`). Change them
there — never by hand-editing files under `Drivers/`, since the directory is
disposable and `--force` will wipe it.

Both board projects include the drivers from `../Drivers/...`, so there is one
shared copy for all boards.

### 1.4 nanopb generator

The firmware speaks the same Protobuf messages as the Linux-side code, encoded
with nanopb. The standalone build scripts require `nanopb_generator.py` on your
`PATH`, which comes from the `nanopb` package (already a jaiabot build
dependency, installed from `packages.jaia.tech` — see
[page020_build.md](../doc/markdown/page020_build.md)):

```bash
sudo apt-get install nanopb libnanopb-dev python3-protobuf
```

### 1.5 STM32CubeMX / STM32CubeIDE (only if you change pin config)

You need [STM32CubeMX](https://www.st.com/en/development-tools/stm32cubemx.html)
(or the full STM32CubeIDE, which embeds it) **only** to regenerate initialization
code from a `.ioc` file — i.e. when adding a peripheral, changing a pin, or
retuning the clock tree. Plain firmware edits need nothing but the toolchain.

The projects were generated with **CubeMX 6.17.0**. Use that version or newer;
opening with an older one will refuse the project file.

> Note the two boards target different toolchains in their `.ioc`:
> `power_board` is set to `Makefile`, `bio_payload` to `STM32CubeIDE`. Keep those
> settings as they are — the CMake build drives the CubeMX-generated `Makefile`
> in both cases, and flipping the target regenerates a different project skeleton.

### 1.6 Verify your setup

```bash
arm-none-eabi-gcc --version           # cross-compiler present
nanopb_generator.py --help            # message generator present
ls src/stm32/Drivers/CMSIS/Include    # core_cm4.h etc. present
```

---

## 2. Building

### 2.1 As part of the normal jaiabot build

The top-level CMake picks up the firmware automatically:

```bash
./build.sh
```

`CMakeLists.txt` probes for `arm-none-eabi-gcc` and sets `build_stm32=ON` when it
is found; if the toolchain is missing you get a `Did not find arm-none-eabi-gcc,
so not building STM32 firmware` status message and the rest of the build proceeds
normally. To force it off:

```bash
JAIABOT_CMAKE_FLAGS="-Dbuild_stm32=OFF" ./build.sh
```

Under CMake, [`cmake/STM32Compile.cmake`](../../cmake/STM32Compile.cmake) defines
`stm32_sketch()`, which for each board:

1. symlinks the generated `nanopb/` and `jaiabot/` message headers into the
   project directory,
2. invokes the CubeMX `Makefile` with `BUILD_DIR` pointed at
   `build/<arch>/share/jaiabot/stm32/<board>/<nickname>/`,
3. generates an `upload.sh` next to the `.hex` for flashing.

Each board registers two "nicknames" — `stlink` and `uart` — which differ only in
how `upload.sh` flashes the result.

Useful targets:

```bash
cmake --build build/amd64 --target stm32_compile_power_board_stlink
cmake --build build/amd64 --target stm32_upload_power_board_stlink
```

### 2.2 Standalone build (faster iteration)

For firmware-only work, skip CMake entirely:

```bash
./scripts/stm32/build_power_board_package.sh
```

This fetches drivers if needed, regenerates the nanopb sources from
`src/lib/messages/*.proto`, builds into `build/stm32/`, and prints the firmware
size. Flags:

| Flag | Effect |
| --- | --- |
| *(none)* | Skips the build entirely if no source file hash changed |
| `--force` | Build even when nothing changed |
| `--clean` | Remove `build/stm32/` and `make clean` first |
| `--regen` | Also re-download `Drivers/` (`fetch_drivers.sh --force`) |

Outputs land in `build/stm32/power_board.{elf,hex,bin,map}`.

### 2.3 Driving the Makefile directly

The CubeMX `Makefile` takes three include roots from whichever wrapper invokes it:

| Variable | Meaning |
| --- | --- |
| `NANOPB_INC` | Root of the generated `jaiabot/messages/` tree |
| `JAIABOT_INC` | Parent of `nanopb/`, so `#include "nanopb/jaiabot/messages/..."` resolves |
| `NANOPB_SYS_INC` | Directory holding sibling `*.pb.h` files referenced by bare includes |

Plus the standard `BUILD_DIR` and optional `GCC_PATH` (if your toolchain is not
on `PATH`). Building by hand is possible but you must supply all of these, so
prefer the wrapper scripts.

Target settings, for reference: Cortex-M4, `-mfpu=fpv4-sp-d16 -mfloat-abi=hard`,
newlib-nano (`-specs=nano.specs`), linker script `STM32L433XX_FLASH.ld`, and
`DEBUG = 1 / OPT = -Og` by default — turn optimization up in the `Makefile` for
release builds if flash space gets tight.

---

## 3. Flashing

### 3.1 Bench: ST-Link over SWD

The default path when you have the board on your desk with an ST-Link probe. The
generated `upload.sh` (nickname `stlink`) runs:

```bash
openocd -f interface/stlink.cfg -f target/stm32l4x.cfg \
        -c "program power_board.hex verify reset exit"
```

`upload.sh` touches a `<hex>.uploaded` marker and skips flashing when the hex is
older than the last upload, so re-running the target is cheap.

### 3.2 On a deployed bot: USB DFU (`power_board`)

`scripts/stm32/deploy_power_board.sh` updates a board that is already installed
in a bot, with no probe attached. The sequence:

1. Publishes `ENTER_BOOTLOADER_MODE` to the running `jaiabot_power_board`
   process over Goby, which makes the MCU jump to the STM32 ROM bootloader.
2. The board re-enumerates as a DFU device (`0483:df11`) instead of its normal
   CDC port (`0483:5740`). The script polls up to 60 s — the firmware's main
   loop sleeps ~10 s per iteration, so ~37 s latency is normal.
3. Stops `jaiabot_power_board`, converts the ELF to a raw binary, and flashes
   with `dfu-util` at `0x08000000`.
4. Bounces the USB device's `authorized` sysfs attribute to force a clean
   re-enumeration (the ROM bootloader's `:leave` jump does not reliably bring the
   CDC port back), then restarts the service.

**Requirement:** `jaiabot_power_board` must be running and connected to
`/dev/power-board` before you start, otherwise the bootloader command never
reaches the MCU.

### 3.3 UART bootloader (`bio_payload`)

`scripts/stm32/deploy_bio_payload.sh` follows the same publish-then-flash idea but
uses the USART bootloader via `stm32flash` (built on the bot from the bundled
tarball). The CMake `uart` nickname instead calls `STM32_Programmer_CLI` against
`STM32_SERIAL_PORT` (default `/dev/ttyUSB0`, override with
`-DSTM32_SERIAL_PORT=...`) at 115200 baud.

---

## 4. Day-to-day development

### 4.1 Respect the CubeMX user-code markers

Most files under `Core/`, `USB_DEVICE/`, and `FATFS/` are generated. CubeMX
preserves only what lives between the sentinel comments:

```c
/* USER CODE BEGIN 2 */
    my_application_init();
/* USER CODE END 2 */
```

Anything you write outside those blocks is **silently destroyed** the next time
someone regenerates from the `.ioc`. If your code does not fit a marker, put it
in a new file under `Core/Src/` instead (see below).

### 4.2 Adding a source file

Create it in `Core/Src/` with its header in `Core/Inc/`, then add it to
`C_SOURCES` in the board's `Makefile`. CubeMX regeneration rewrites the generated
portion of the file list, so re-check your entry survived after any `.ioc` change.

### 4.3 Changing shared messages

Firmware messages are defined once, in `src/lib/messages/*.proto` with nanopb
sizing hints in the matching `.options` files, and compiled two ways: full
Protobuf for the Linux side, nanopb for the MCU. After editing a `.proto`:

```bash
./scripts/stm32/build_power_board_package.sh --force
```

Watch the reported firmware size — unbounded strings and repeated fields are the
usual cause of a sudden RAM blowup on a 64 KB part. That is what the `.options`
files are for.

DCCL option annotations are Linux-only; the build scripts stub out
`dccl/option_extensions.pb.h` for the embedded build, so do not be surprised to
see an empty header show up in `build/stm32/dccl/`.

### 4.4 Debugging

```bash
# terminal 1
openocd -f interface/stlink.cfg -f target/stm32l4x.cfg
# terminal 2
arm-none-eabi-gdb build/stm32/power_board.elf -ex "target extended-remote :3333"
```

`power_board` also exposes a USB CDC virtual COM port, so `printf`-style tracing
via `CDC_Transmit_FS()` shows up on `/dev/power-board` (or `/dev/ttyACM*`).
Remember that `CDC_Transmit_FS()` is non-blocking and returns `USBD_BUSY` while
the previous packet is still in flight; retry with a timeout rather than
assuming success.

---

## 5. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `fatal error: stm32l4xx_hal.h: No such file` | `Drivers/` missing — run `./scripts/stm32/fetch_drivers.sh` |
| `arm-none-eabi-gcc: command not found` | Toolchain not installed — run `./scripts/setup-tools-build.sh` |
| `nanopb_generator.py not found` | `sudo apt-get install nanopb python3-protobuf` |
| CMake says "not building STM32 firmware" | Same as above; CMake probes for `arm-none-eabi-gcc` at configure time, so re-run cmake after installing |
| `*.pb.h: No such file` | nanopb sources not generated — build via the `scripts/stm32/build_*_package.sh` wrapper, not bare `make` |
| Build script says "No source changes detected" | Hash-based skip; pass `--force` |
| `SKIPPING STM32 UPLOAD: ... is older than ...` | Delete the `<hex>.uploaded` marker or rebuild |
| DFU device never appears | `jaiabot_power_board` was not running, or the firmware on the board predates `ENTER_BOOTLOADER_MODE` — fall back to ST-Link/SWD |
| `/dev/power-board` gone after a DFU flash | Physically unplug/replug USB or power-cycle the board; the ROM bootloader's `:leave` does not always restore the USB peripheral |
| Custom code vanished after opening CubeMX | It was outside a `USER CODE BEGIN/END` block — recover from git |
