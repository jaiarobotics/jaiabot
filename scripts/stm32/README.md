# STM32 / BIO Payload Board — Development, Build, and Deploy Guide

This directory holds everything needed to turn a source change in
[src/stm32/](../../src/stm32/) into new firmware running on the BIO payload board of a
JaiaBot. It covers the whole loop: editing, building, getting the binary onto a bot, and
verifying the flash took.

---

## 1. What the BIO payload board is

| | |
|---|---|
| MCU | STM32L433RCTX (Cortex-M4F, `-DSTM32L433xx`, linker script `STM32L433XX_FLASH.ld`) |
| Firmware project | [src/stm32/bio_payload/](../../src/stm32/bio_payload/) (STM32CubeMX project, `JAIA_STM32.ioc`) |
| Host link | FTDI USB-serial on the Pi, `115200` baud |
| Device node | `/dev/bio-payload` — udev symlink from [90-jaiabot_serial.rules](../../rootfs/customization/includes.chroot/etc/udev/rules.d/90-jaiabot_serial.rules) (`idVendor 0403`, `idProduct 6015`) |
| Linux-side app | `jaiabot_sensors` ([src/bin/sensors/](../../src/bin/sensors/)), configured in [config/gen/bot.py](../../config/gen/bot.py) |
| Wire format | nanopb-encoded `jaiabot.sensor.protobuf.SensorData` / `SensorRequest`, COBS-framed with a trailing CRC32 |
| Sensors on board | Bar30 (MS5837), TSYS01, Turner C-FLUOR, AML, Atlas Scientific OEM EC/DO/pH |

The firmware and `jaiabot_sensors` share their message definitions:
[src/lib/messages/sensor/\*.proto](../../src/lib/messages/sensor/). The Linux side compiles
them with protobuf/DCCL; the STM32 side compiles the *same* files with nanopb. That shared
definition is why some changes require rebuilding both sides — see
[§4](#4-decide-what-you-need-to-rebuild).

---

## 2. Directory map

```
src/stm32/
├── CMakeLists.txt              # add_subdirectory(bio_payload)
├── Drivers/                    # HAL + CMSIS — NOT in git, fetched by fetch_drivers.sh
└── bio_payload/
    ├── JAIA_STM32.ioc          # CubeMX project (pin/clock/peripheral config)
    ├── Makefile                # CubeMX-generated; edited to take NANOPB_*/JAIABOT_INC
    ├── CMakeLists.txt          # stm32_sketch() calls: stlink + uart variants
    ├── Core/Src, Core/Inc      # the firmware you actually edit (main.c, cfluor.c, aml.c, ...)
    ├── STM32L433XX_FLASH.ld    # linker script used by the Makefile
    ├── startup_stm32l433xx.s
    ├── upload.sh.in            # template for the ST-Link/UART upload script (CMake path)
    └── jaiabot, nanopb         # symlinks into build/<arch>/include, created by CMake

scripts/stm32/
├── build_bio_payload_package.sh   # standalone firmware build (fast dev loop)
├── fetch_drivers.sh               # downloads pinned HAL/CMSIS into src/stm32/Drivers
├── remote_deploy_bio_payload.sh   # build here, flash over SSH — the usual dev path
├── deploy_bio_payload.sh          # runs ON the bot; installed as .../uart/upload.sh
└── stm32flash-0.7.tar.gz          # vendored flasher source, compiled on the bot
```

Build outputs:

| Path | Produced by |
|---|---|
| `build/stm32/bio_payload.{elf,hex,bin,map}` | `build_bio_payload_package.sh` |
| `build/<arch>/share/jaiabot/stm32/bio_payload/uart/` | `./build.sh` (CMake) — hex/elf/bin + `upload.sh` + `stm32flash-0.7.tar.gz` |
| `build/<arch>/share/jaiabot/stm32/bio_payload/stlink/` | `./build.sh` (CMake) — hex/elf/bin + ST-Link `upload.sh` |
| `<prefix>/share/jaiabot/stm32/bio_payload/<nickname>/` | `make install` / the Debian package (see [CMakeLists.txt](../../CMakeLists.txt)) |

---

## 3. One-time setup (development machine)

```bash
./scripts/setup-tools-build.sh
```

That installs everything the firmware build needs:

* `gcc-arm-none-eabi`, `binutils-arm-none-eabi`, `libnewlib-arm-none-eabi`
* `openocd`, `stlink-tools` (only needed for SWD/ST-Link flashing)
* `nanopb` (provides `/usr/bin/nanopb_generator.py`) and `libnanopb-dev`, via `build-dep jaiabot`
* and it calls `scripts/stm32/fetch_drivers.sh` for you

`fetch_drivers.sh` downloads the pinned ST HAL/CMSIS trees into `src/stm32/Drivers/`, which is
git-ignored:

| Component | Pinned version |
|---|---|
| `stm32l4xx_hal_driver` | `v1.13.6` |
| `cmsis_device_l4` | `v1.7.5` |
| `cmsis_core` | `v5.4.0` |

```bash
./scripts/stm32/fetch_drivers.sh            # no-op if Drivers/ looks complete
./scripts/stm32/fetch_drivers.sh --force    # re-download (after bumping a pinned version)
```

Sanity check:

```bash
arm-none-eabi-gcc --version && nanopb_generator.py --help >/dev/null && echo "toolchain OK"
```

---

## 4. Decide what you need to rebuild

Start by editing the firmware in [src/stm32/bio_payload/Core/](../../src/stm32/bio_payload/Core/)
— `main.c` holds the main loop, sensor polling, and the command handler; the per-sensor drivers
live beside it (`MS5837.c`, `celsius_tsys01.c`, `cfluor.c`, `aml.c`, `oem_library.c`).

Then match your change to a row:

| What you changed | What to run |
|---|---|
| Only `src/stm32/**` (C sources/headers) | `./scripts/stm32/build_bio_payload_package.sh` |
| `src/lib/messages/sensor/*.proto` (shared with the Linux side) | `./build.sh` **and** the STM32 build — both sides must agree on the wire format |
| Anything else outside `src/stm32/` (`src/bin/sensors/`, `config/gen/`, other apps) | `./build.sh` (STM32 firmware is built as part of it too) |
| `JAIA_STM32.ioc` in CubeMX | See the CubeMX caution below, then rebuild |

Notes on proto changes:

* The STM32 build hashes `*.proto` and `*.options` files under
  [src/lib/messages/](../../src/lib/messages/) as well as the STM32 sources, so a proto edit
  correctly invalidates the firmware build.
* If a new `.proto` file is added under `src/lib/messages/sensor/`, also add its generated
  `$(NANOPB_SENSOR_GEN_DIR)/<name>.pb.c` to `C_SOURCES` in
  [src/stm32/bio_payload/Makefile](../../src/stm32/bio_payload/Makefile) — nanopb generation is
  automatic, but the Makefile source list is not.
* Editing protos that ride on intervehicle comms can trip the DCCL hash check in
  [src/lib/messages/CMakeLists.txt](../../src/lib/messages/CMakeLists.txt); regenerate and update
  the expected hashes there as that file documents (`dccl ... -a -H`).

> **CubeMX caution.** Regenerating from `JAIA_STM32.ioc` overwrites `Makefile`, the
> `Core/Src`/`Core/Inc` boilerplate, and the startup/linker files. The Makefile in git is
> hand-modified: it carries the `NANOPB_INC` / `JAIABOT_INC` / `NANOPB_SYS_INC` /
> `NANOPB_RUNTIME_DIR` variables, the nanopb runtime and generated `*.pb.c` entries in
> `C_SOURCES`, and `LDSCRIPT = STM32L433XX_FLASH.ld`. Keep your edits inside the CubeMX
> `USER CODE BEGIN/END` markers, and diff the Makefile carefully after any regeneration.

---

## 5. Build

There are two build paths. They produce the same firmware from the same sources; they differ in
speed and in where the artifacts land.

### 5a. Standalone firmware build (the fast dev loop)

```bash
./scripts/stm32/build_bio_payload_package.sh [--force] [--clean] [--regen]
```

| Flag | Effect |
|---|---|
| *(none)* | Skips the build entirely if no relevant source file changed since the last run |
| `--force` | Build even if the source hash is unchanged |
| `--clean` | Wipe `build/stm32/`, `make clean`, and rebuild from scratch |
| `--regen` | Re-download `Drivers/` (`fetch_drivers.sh --force`) |

What it does, in order:

1. Verifies `arm-none-eabi-gcc` and `nanopb_generator.py` are on `PATH`.
2. Hashes every `*.c`, `*.h`, `*.ioc`, `*.proto`, `*.options` under `src/stm32/` and
   `src/lib/messages/`, and compares against `build/stm32/.last_build_hash`. Unchanged → exits
   without building.
3. Fetches `Drivers/` if missing.
4. Writes a stub `build/stm32/dccl/option_extensions.pb.h` — the generated `*.pb.h` files include
   it, but DCCL annotations are Linux-only and unused on the MCU.
5. Symlinks `src/lib/messages` into `build/stm32/proto_staging/jaiabot/messages` so
   `import "jaiabot/messages/..."` resolves, then runs `nanopb_generator.py` for the top-level
   and `sensor/` protos into `build/stm32/nanopb/`.
6. Runs the CubeMX Makefile with `BUILD_DIR=build/stm32` and the include variables wired up.
7. Verifies `bio_payload.hex` exists, prints `arm-none-eabi-size`, and records the hash.

Output: `build/stm32/bio_payload.elf`, `.hex`, `.bin`, `.map`. This is what
`remote_deploy_bio_payload.sh` flashes.

### 5b. Full project build

```bash
./build.sh
```

CMake builds the firmware as part of the normal project build when `arm-none-eabi-gcc` is found
(the `build_stm32` option in [CMakeLists.txt](../../CMakeLists.txt) defaults `ON` in that case;
`-Dbuild_stm32=OFF` disables it). [cmake/STM32Compile.cmake](../../cmake/STM32Compile.cmake)
defines `stm32_sketch()`, and [src/stm32/bio_payload/CMakeLists.txt](../../src/stm32/bio_payload/CMakeLists.txt)
instantiates it twice:

```
stm32_sketch(bio_payload stlink stm32l4x stlink stlink "")     # SWD via OpenOCD
stm32_sketch(bio_payload uart   stm32l4x stlink uart   115200) # UART bootloader (on-bot path)
```

Each instantiation:

* symlinks `build/<arch>/include/{nanopb,jaiabot}` into the sketch dir (so the Makefile sees the
  `.pb.h` files CMake generated for the rest of the project),
* depends on the `jaiabot_messages_c` target, so nanopb sources are always current,
* builds into `build/<arch>/share/jaiabot/stm32/bio_payload/<nickname>/`,
* generates `upload.sh` there — and for the `uart` nickname, **overwrites it with a copy of
  [deploy_bio_payload.sh](deploy_bio_payload.sh)** and drops `stm32flash-0.7.tar.gz` alongside it.

Useful targets:

```bash
cmake --build build/amd64 --target stm32_compile_bio_payload_uart
cmake --build build/amd64 --target stm32_upload_bio_payload_stlink   # builds, then flashes via ST-Link
```

---

## 6. Deploy

Three routes. **Route A is the normal one for development.**

### The bootloader constraint (read this once)

The board has **no BOOT0 strap wired out**. The only way into the STM32 system bootloader is the
firmware's own `jumpToBootloader()` ([main.c](../../src/stm32/bio_payload/Core/Src/main.c)),
reached by sending `MCUCommand: ENTER_BOOTLOADER_MODE`. That command is relayed to the board by
`jaiabot_sensors`, so:

* `jaiabot_sensors` **must be running** when you start a flash, and
* it must be **stopped immediately after**, so it does not talk over the serial line mid-flash.

Both deploy scripts do exactly that. `jumpToBootloader()` erases flash page 0 and resets, so the
MCU comes up in the bootloader with no application — meaning a *failed* flash leaves the board
sitting in the bootloader, still reachable by re-running the flash. It does not brick the board,
but it does leave it non-functional until a flash succeeds.

### Route A — remote deploy from your development machine (recommended)

```bash
./scripts/stm32/remote_deploy_bio_payload.sh 172.20.11.102 [more hosts ...]
```

Builds locally (via `build_bio_payload_package.sh`) and flashes over SSH. The bot never needs an
ARM cross-toolchain or a checkout — only `gcc`/`make`, which the bot image already has, to compile
`stm32flash` once.

| Option | Default | Meaning |
|---|---|---|
| `--user USER` | `jaia` | SSH user on the bot |
| `--skip-build` | off | Flash the existing `build/stm32/bio_payload.bin` |
| `--force` | off | Rebuild even if the source hash is unchanged |
| `--clean` | off | Wipe `build/stm32` and rebuild from scratch |
| `--port DEV` | `/dev/bio-payload` | Serial port on the bot |
| `--baud N` | `115200` | Bootloader baud rate |
| `--rebuild-tool` | off | Force `stm32flash` to be recompiled on the bot |

Requirements: key-based SSH to the bot (`BatchMode` is used, so no password prompts),
passwordless `sudo` on the bot, and `rsync` on both ends.

Per host, it:

1. `rsync`es `bio_payload.bin` and `stm32flash-0.7.tar.gz` into
   `~/.cache/jaiabot/stm32-deploy/bio_payload/` on the bot.
2. Reads `/etc/jaiabot/runtime.env` to build the platform name `bot<N>_fleet<M>`.
3. Compiles `stm32flash` there if it isn't cached already.
4. Checks `jaiabot_sensors` is active, then publishes `ENTER_BOOTLOADER_MODE`, then stops the
   service (an `EXIT` trap restarts it no matter how the script ends).
5. Power-cycles the USB bus (`/sys/bus/usb/devices/usb1/authorized` 0 → 1) to re-enumerate the
   board, flashes with `stm32flash -w bio_payload.bin -v -b <baud> -g 0x08000000 <port>`,
   power-cycles again, and restarts `jaiabot_sensors`.

Multiple hosts are flashed in sequence; failures are collected and reported at the end with a
non-zero exit.

### Route B — deploy from the bot (full-package path)

Use this when you're pushing a whole software build to the bot, not just firmware.

```bash
# on your dev machine
jaiabot_systemd_type=bot ./scripts/docker-arm64-build-and-deploy.sh 172.20.11.102
```

That cross-builds in Docker, `rsync`s `build/<distro>-<version>-arm64/{bin,include,lib,share}`
plus `config/` and `scripts/` to `~/jaiabot/` on the bot, and runs
[scripts/arm64-deploy.sh](../arm64-deploy.sh) there. The STM32 artifacts ride along inside
`share/`.

**`arm64-deploy.sh` does not flash the STM32.** It deliberately only prints the path to the
upload script, because flashing takes the payload board offline. Finish the job by hand:

```bash
ssh jaia@172.20.11.102
cd ~/jaiabot/build/<distro>-<version>-arm64/share/jaiabot/stm32/bio_payload/uart
bash upload.sh
```

> **`cd` into that directory first.** `upload.sh` here is a copy of
> [deploy_bio_payload.sh](deploy_bio_payload.sh), which refers to `bio_payload.elf` and
> `stm32flash-0.7.tar.gz` by relative path. Running it as `bash <full/path>/upload.sh` from
> `$HOME` will fail.

The on-bot script does the same dance as Route A, plus two extra steps: it runs
`arm-none-eabi-objcopy` on the ELF locally (so it `apt install`s `gcc-arm-none-eabi` and
`binutils-arm-none-eabi` on the Pi), and on success it saves
`bio_payload_uploaded.{bin,elf}` next to the originals as a record of what is actually on the
board.

If you installed the Debian package rather than deploying a build tree, the same script lives at
`/usr/share/jaiabot/stm32/bio_payload/uart/upload.sh`.

### Route C — ST-Link / SWD (bench work and recovery)

With an ST-Link probe attached to the board's SWD header:

```bash
cmake --build build/amd64 --target stm32_upload_bio_payload_stlink
# or directly:
cd build/amd64/share/jaiabot/stm32/bio_payload/stlink && ./upload.sh
```

This uses OpenOCD (`program <hex> verify reset exit`) and does **not** need `jaiabot_sensors`,
the UART bootloader, or a working application image — which is what makes it the recovery path
when the UART route can't be used.

---

## 7. Verify the flash

```bash
# on the bot
systemctl status jaiabot_sensors
journalctl -u jaiabot_sensors -f | grep -i "BIO Payload Software Version"
```

`jaiabot_sensors` logs the version the board reports in its `Metadata` message. That value comes
from `#define SOFTWARE_VERSION` near the top of
[src/stm32/bio_payload/Core/Src/main.c](../../src/stm32/bio_payload/Core/Src/main.c) — **bump it
when you make a firmware change you'll want to identify in the field**, otherwise you cannot tell
old firmware from new.

Also confirm sensor data is flowing again (`Received data from MCU: ...` in the same log at
verbose), and that no driver reported a failed initialization.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `ERROR: arm-none-eabi-gcc not found` / `nanopb_generator.py not found` | Run `./scripts/setup-tools-build.sh`. (The script's own hint points at `scripts/stm32/setup_tools_build.sh`, which does not exist — the real script is `scripts/setup-tools-build.sh`.) |
| `No source changes detected, skipping build` | Working as designed. Re-run with `--force`, or `--clean` for a from-scratch build. |
| Missing `Drivers/` headers, or HAL compile errors after a version bump | `./scripts/stm32/fetch_drivers.sh --force` |
| `jaiabot_sensors is not running` from the deploy script | The service relays `ENTER_BOOTLOADER_MODE`. `sudo systemctl start jaiabot_sensors`, wait for it to come up, retry. |
| `stm32flash` can't open the port / no response | Check `ls -l /dev/bio-payload` (udev symlink), that nothing else holds the port, and re-run — the USB re-authorize cycle plus bootloader entry sometimes needs a second attempt. |
| Flash failed, board now unresponsive | Expected intermediate state: page 0 was erased, so the board is in the bootloader. Re-run the deploy. If that fails, use Route C (ST-Link). |
| `bio_payload.elf: No such file` when running `upload.sh` on the bot | You didn't `cd` into the `.../bio_payload/uart/` directory first. |
| Linux app and firmware disagree (decode failures, `Failed to decode message from MCU`) | A proto changed on one side only. Rebuild both: `./build.sh` **and** the STM32 firmware, and redeploy both. |
| CMake says "Did not find arm-none-eabi-gcc, so not building STM32 firmware" | Toolchain missing at configure time; install it and re-run CMake (a fresh `./build.sh` reconfigures). |

---

## 9. File reference

| File | Role |
|---|---|
| [build_bio_payload_package.sh](build_bio_payload_package.sh) | Standalone firmware build: toolchain check, change detection, nanopb generation, `make`, size report |
| [fetch_drivers.sh](fetch_drivers.sh) | Downloads the pinned STM32L4 HAL + CMSIS trees into `src/stm32/Drivers/` |
| [remote_deploy_bio_payload.sh](remote_deploy_bio_payload.sh) | Build locally, flash one or more bots over SSH (Route A) |
| [deploy_bio_payload.sh](deploy_bio_payload.sh) | Runs on the bot; installed/copied as `.../bio_payload/uart/upload.sh` (Route B) |
| `stm32flash-0.7.tar.gz` | Vendored [stm32flash](https://sourceforge.net/projects/stm32flash/) source, compiled on the target |
