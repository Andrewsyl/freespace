#!/usr/bin/env bash
# One-time provisioning for a fresh Ubuntu 22.04 Lightsail box.
# Run as a sudo-capable user:  bash setup.sh
set -euo pipefail

echo "==> Installing Docker + compose plugin"
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg unzip
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"

echo "==> Installing AWS CLI v2"
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscliv2.zip
cd /tmp && unzip -q -o awscliv2.zip && sudo ./aws/install --update && cd -

echo "==> Done. Log out/in for the docker group, then:"
echo "    cp .env.example .env && edit .env && ./deploy.sh"
