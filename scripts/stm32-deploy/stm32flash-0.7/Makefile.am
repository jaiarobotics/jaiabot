
SUBDIRS = parsers

bin_PROGRAMS = stm32flash

AUTOMAKE_OPTIONS = subdir-objects


stm32flash_SOURCES  = \
	compiler.h	\
	dev_table.c	\
	i2c.c		\
	init.h		\
	init.c		\
	main.c		\
	port.h		\
	port.c		\
	serial.h	\
	serial_common.c	\
	serial_platform.c\
	stm32.h		\
	stm32.c		\
	utils.h		\
	utils.c

EXTRA_stm32flash_SOURCES = \
	serial_posix.c	\
	serial_w32.c

EXTRA_DIST = Android.mk parsers/Android.mk \
	stm32flash.1 gpl-2.0.txt \
	protocol.txt HOWTO I2C.txt

# If we want to ship these handmade ones, they must have
# been copied before running configure and make dist
dist-hook:
	-cp Makefile.handmade $(distdir)/Makefile
	-cp parsers/Makefile.handmade $(distdir)/parsers/Makefile

stm32flash_LDADD   = ${top_builddir}/parsers/parsers.la

stm32flash_CFLAGS = \
  -g3 \
  -Os \
  -Wall \
  -Wextra  \
  -I$(srcdir)/parsers


stm32flash_LDFLAGS = \
  -Wall \
  -g3 \
  -Wextra

all:


.PHONY: all
.SILENT: all
