#!/bin/bash
# Creates (or updates) the instance profile the auth servers run with, production and test alike.

set -u -e -o pipefail

if (( $# != 1 )); then
    echo "Usage: $0 authelia/authelia.conf"
    exit 1
fi

SCRIPT_PATH=$(cd "$(dirname "$0")/.." && pwd)
set -a; source "$1"; set +a
export AWS_DEFAULT_REGION=$REGION

role_name=JaiaAuthServerRole
profile_name=$IAM_INSTANCE_PROFILE_NAME

parameter_arn=$AUTH_SMTP_CREDENTIALS_PARAMETER
if [[ $parameter_arn != arn:* ]]; then
    arn_prefix=arn:aws
    if [[ $REGION == us-gov-* ]]; then
        arn_prefix=arn:aws-us-gov
    fi
    account_id=$(aws sts get-caller-identity --query Account --output text)
    parameter_arn=$arn_prefix:ssm:$REGION:$account_id:parameter$parameter_arn
fi

policy=$(sed -e "s|{{SMTP_CREDENTIALS_PARAMETER_ARN}}|$parameter_arn|g" "$SCRIPT_PATH/authelia/iam-policy.json.in")

if ! aws iam get-role --role-name $role_name > /dev/null 2>&1; then
    aws iam create-role --role-name $role_name \
        --assume-role-policy-document "file://$SCRIPT_PATH/cloudhub-trust-policy.json" > /dev/null
    echo ">>>>>> Created role $role_name"
fi
aws iam put-role-policy --role-name $role_name --policy-name JaiaAuthServerPolicy --policy-document "$policy"
echo ">>>>>> Set the role's policy"

if ! aws iam get-instance-profile --instance-profile-name $profile_name > /dev/null 2>&1; then
    aws iam create-instance-profile --instance-profile-name $profile_name > /dev/null
    aws iam add-role-to-instance-profile --instance-profile-name $profile_name --role-name $role_name
    echo ">>>>>> Created instance profile $profile_name"
fi
