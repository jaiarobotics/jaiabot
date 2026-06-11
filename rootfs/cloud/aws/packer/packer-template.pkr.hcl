variable "instance_type" {
  default = "t3a.small"
}

# set on command line
variable "source_ami" {}
variable "aws_region" {} 
variable "jaia_upgrade_repo" {}
variable "jaia_upgrade_version" {}
variable "ami_name" {}
variable "iso_source" {}
variable "iso_local_dir" {}

# AWS Builder
source "amazon-ebs" "jaia-major-upgrade" {
  ami_name      = var.ami_name
  instance_type = var.instance_type
  region        = var.aws_region
  source_ami    = var.source_ami
  ssh_username  = "jaia"
  ssh_private_key_file = "id_packer"
  user_data_file = "ec2_base/user-data"

  # for testing
  # skip_create_ami  = true
}

# Provisioners
build {
  sources = ["source.amazon-ebs.jaia-major-upgrade"]

  # Download and mount the upgrade ISO
  provisioner "shell" {
    environment_vars = [
       "AWS_REGION=${var.aws_region}",
       "JAIA_UPGRADE_REPO=${var.jaia_upgrade_repo}",
       "JAIA_UPGRADE_VERSION=${var.jaia_upgrade_version}",
       "JAIA_UPGRADE_ISO_SOURCE=${var.iso_source}",
       "JAIA_UPGRADE_ISO_LOCAL_DIR=${var.iso_local_dir}"
    ]
    script = "scripts/packer-fetch-upgrade.sh"
  }
  
  # Perform the upgrade prep
  provisioner "ansible-local" {
    playbook_dir = "ansible"
    playbook_file = "ansible/ami-upgrade.yml"
  }

  # Perform the actual upgrade
  provisioner "shell" {
    inline = [
      "sudo /var/log/jaiabot/major_upgrade/do-major-upgrade.sh 2>&1 | sudo tee /var/log/jaiabot/major_upgrade/major_upgrade_final.log"
    ]
  }
}
