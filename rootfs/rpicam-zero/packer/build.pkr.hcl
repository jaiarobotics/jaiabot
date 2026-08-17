
build {
  sources = [
    "source.arm-image.raspios_arm64"
  ]
  
  provisioner "shell" {
    scripts = [
      "scripts/install-cloud-init.sh"
    ]
  }

  provisioner "shell" {
    scripts = [
      "scripts/install-jaia-rpicam.sh"
    ]
  }

}
