
build {
  sources = [
    "source.arm-image.raspios_bullseye_arm64"
  ]
 
  provisioner "file" {
    source = "scripts/create-data-partition.sh"
    destination = "/opt/create-data-partition.sh"
  }
  
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
