source "arm-image" "raspios_bullseye_arm64" {
  image_type      = "raspberrypi"
  iso_url         = "http://downloads.raspberrypi.org/raspios_lite_arm64/images/raspios_lite_arm64-2024-11-19/2024-11-19-raspios-bookworm-arm64-lite.img.xz"
  iso_checksum    = "sha256:6ac3a10a1f144c7e9d1f8e568d75ca809288280a593eb6ca053e49b539f465a4"
  output_filename = "images/jaiabot__rpicam-zero-bookworm.img"
  qemu_binary     = "qemu-aarch64-static"
  # 4GB
  target_image_size = 4294967296
}
