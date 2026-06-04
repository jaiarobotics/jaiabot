source "arm-image" "raspios_arm64" {
  image_type      = "raspberrypi"
  iso_url         = "https://downloads.raspberrypi.com/raspios_lite_arm64/images/raspios_lite_arm64-2026-04-21/2026-04-21-raspios-trixie-arm64-lite.img.xz"
  iso_checksum    = "sha256:4cd31df026fd82243805a326dc0cafd7383f7e3d30c9413e7044d507aae281e2"
  output_filename = "images/jaiabot__rpicam-zero-trixie.img"
  qemu_binary     = "qemu-aarch64-static"
  # 4GB
  target_image_size = 4294967296
}
