# CircleCI permissions for the VirtualFleet sea trial

The `JaiaCircleCI` role builds and publishes images. Standing up a CloudHub and
VirtualFleet needs a different set of permissions again: VPC networking, an
Elastic IP, a data bucket, and the CloudHub's own IAM role and instance profile.

`sea-trial-policy.json.in` is that additional set, as a managed policy to attach
alongside the existing four. It does not replace or narrow any of them — the
image-build and `import-image` paths that `2.y` and `3.y` share are untouched.

Render the placeholders before creating the policy:

```
sed -e 's/{{REGION}}/ca-central-1/g' \
    -e 's/{{ACCOUNT_ID}}/<account>/g' \
    -e 's/{{ARN_PREFIX}}/arn:aws/g' \
    -e 's/{{FLEET_ID}}/9/g' \
    sea-trial-policy.json.in > /tmp/sea-trial-policy.json

aws iam create-policy --policy-name JaiaCircleCISeaTrial \
    --policy-document file:///tmp/sea-trial-policy.json
aws iam attach-role-policy --role-name JaiaCircleCI \
    --policy-arn arn:aws:iam::<account>:policy/JaiaCircleCISeaTrial
```

## Why it is scoped the way it is

Sea trials share an account with customer fleets, so the region is the boundary:
every EC2 statement carries an `aws:RequestedRegion` condition, and a bug that
reaches for a VPC or Elastic IP outside that region is denied rather than
destructive. The bucket and IAM statements name the reserved fleet directly,
since neither S3 nor IAM has a region to condition on.

## The permissions boundary

`create_vpc.sh` creates the CloudHub's role and writes its inline policy. Granting
that as `iam:CreateRole` + `iam:PutRolePolicy` + `iam:PassRole` would let anything
holding the CircleCI role mint a role with permissions of its choosing and hand it
to an EC2 instance — an escalation out of the region boundary above.

`cloudhub-boundary-policy.json` closes that: create it as `JaiaCloudHubBoundary`,
and the sea-trial policy then permits role creation *only* when that boundary is
attached. The boundary allows EC2 and the fleet data buckets and nothing else, so
a CloudHub role cannot be given IAM permissions whatever its inline policy says.

This requires `create_vpc.sh` to pass `--permissions-boundary` when it creates the
role. Without that change the `ManageCloudHubRoleWithinBoundary` statement denies
every `CreateRole` call and nothing works.
