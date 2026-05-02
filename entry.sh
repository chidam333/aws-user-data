#!/usr/bin/env bash

# This is the real user-data script that will be executed on EC2 instance launch.
# It fetches the main user-data script from S3 and executes it.
# This separation allows for easier development and testing of the main user-data script
# without modifying the actual EC2 launch configuration.


# AWS cli 
dnf -y install awscli

PROJECT_S3_BUCKET="s3://ec2-user-aws-user-data"
PROJECT_DIR="/opt/aws-user-data"

aws s3 sync "$PROJECT_S3_BUCKET" "$PROJECT_DIR" --delete --region ap-south-2 --endpoint-url https://s3.dualstack.ap-south-2.amazonaws.com

bash "$PROJECT_DIR/user-data.sh"