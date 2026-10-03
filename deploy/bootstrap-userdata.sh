#!/bin/bash
# User data (cloud-init) do Amazon Linux 2023 arm64: Docker, Compose, swap e git. Não carrega segredos.
set -euxo pipefail

if ! swapon --show | grep -q /swapfile; then
  dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo 'vm.swappiness=20' > /etc/sysctl.d/99-hrflow.conf
sysctl --system

dnf install -y docker git
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL https://github.com/docker/compose/releases/download/v2.40.3/docker-compose-linux-aarch64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
curl -fsSL https://github.com/docker/buildx/releases/download/v0.30.1/buildx-v0.30.1.linux-arm64 \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
chmod +x /usr/local/lib/docker/cli-plugins/*
systemctl enable --now docker
usermod -aG docker ec2-user

# Rotação de logs dos contêineres: o disco é pequeno
cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
systemctl restart docker

install -d -o ec2-user -g ec2-user /opt/hrflow
touch /var/lib/hrflow-bootstrap-done
