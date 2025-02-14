variable "instance_type" {
  default = "t3a.micro"
}

# set on command line
variable "source_ami" {}
variable "aws_region" {} 
variable "jaia_upgrade_repo" {}
variable "jaia_upgrade_version" {}

# AWS Builder
source "amazon-ebs" "jaia-v2-test" {
  ami_name      = "packer-ami-jaia-v2"
  instance_type = var.instance_type
  region        = var.aws_region
  source_ami    = var.source_ami
  ssh_username  = "jaia"
  ssh_private_key_file = "id_packer"
  user_data_file = "ec2_base/user-data"

  # for testing
  skip_create_ami  = true
}

# Provisioners
build {
  sources = ["source.amazon-ebs.jaia-v2-test"]

  # Download and mount the upgrade ISO
  provisioner "shell" {
    environment_vars = [
       "AWS_REGION=${var.aws_region}",
       "JAIA_UPGRADE_REPO=${var.jaia_upgrade_repo}",
       "JAIA_UPGRADE_VERSION=${var.jaia_upgrade_version}"
    ]
    script = "scripts/packer-fetch-upgrade.sh"
  }
  
  # Perform the upgrade
  provisioner "ansible-local" {
    playbook_dir = "ansible"
    playbook_file = "ansible/ami-upgrade.yml"
    
    extra_arguments = [
      "--extra-vars",
      "hub_id=1"
    ]
  }
}
