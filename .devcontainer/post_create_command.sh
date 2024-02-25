#!/usr/bin/bash

set -eux

sudo apt-get update
sudo apt-get install -y bash-completion

echo -e "\ncomplete -C '/usr/local/bin/aws_completer' aws" >> ~/.bashrc

go install github.com/kayac/ecspresso/v2/cmd/ecspresso@v2.3.2
