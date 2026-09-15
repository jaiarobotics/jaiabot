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

## Running the trial

The trial runs as the `sea-trial-virtualfleet` job, from two places:

- **On every release and beta tag**, in the `commit` workflow, after `aws-sync` has
  built and copied that tag's AMI.
- **Nightly**, from a scheduled pipeline. CircleCI's in-config `triggers: schedule` is
  retired, so the schedule lives in the project's settings rather than here: add a
  scheduled pipeline on `3.y` that sets the pipeline parameter `run-sea-trial` to
  `true`. That parameter selects the `sea-trial` workflow and deselects `commit`, so a
  nightly does not rebuild the world first.

The other parameters - `sea-trial-bots`, `sea-trial-goals`, `sea-trial-warp`,
`sea-trial-repo` and `sea-trial-keep-fleet` - can be set on the scheduled pipeline, or
passed when triggering a pipeline by hand to reproduce a failure.
`sea-trial-keep-fleet` leaves the fleet up for inspection; the reaper still clears it
on the next run.

### Running it by hand

From the CircleCI UI, use *Trigger Pipeline* on the project and add the parameter
`run-sea-trial` = `true`. Or over the API:

```
curl -X POST https://circleci.com/api/v2/project/gh/jaiarobotics/jaiabot/pipeline \
     -H "Circle-Token: $CIRCLECI_TOKEN" -H 'Content-Type: application/json' \
     -d '{"branch": "3.y", "parameters": {"run-sea-trial": true}}'
```

A pipeline only accepts parameters the config *on that branch* declares, so a branch
that predates these has to be triggered without them.

Trialling from a feature branch needs `sea-trial-repo`: the repo a branch maps to is
`test`, and no `test` AMI is published, so the run would stop at the image lookup.
Name a published one instead:

```
     -d '{"branch": "my-branch",
          "parameters": {"run-sea-trial": true, "sea-trial-repo": "continuous"}}'
```

That trials the newest `continuous` image with this branch's scripts, which is what
you want when changing the trial itself rather than the image.

The job installs `jaiabot-apps` and `jaiabot-python` from packages.jaia.tech for the
repo and version this commit built, because `jaia admin fleet create_cloudhub`
dispatches to the copy in `/usr/bin`: tooling from another commit writes answers the
image's packages no longer accept.

The VirtualFleet playbooks are not copied up: `jaiabot-config` puts them in
`/usr/share/jaiabot/config/ansible` on the CloudHub, so the ones that run are the
image's own.

## The fleet config

`jaia admin fleet create` is interactive, and a config checked into the repository would
mean private keys checked into the repository, so CI writes one per run:

```
./make-ci-fleet-config.sh --fleet 9 --bots 2 --warp 5 /tmp/ci-fleet9.cfg
```

It generates the hub keys and, unless given `--authorized-key`, the runner's own key, so
the fleet is reachable only by the run that created it and the keys go away with it.

## Deleting the bucket

`delete_vpc.sh` never deletes a CloudHub's data bucket: a fleet's logs normally outlive
the fleet that wrote them. A CI fleet's do not, so its teardown deletes the bucket in a
separate step:

```
./delete-ci-bucket.sh 9
```

It refuses any bucket whose `jaia_customer` tag does not mark it as CI's, so the same
command pointed at a customer fleet's number does nothing.

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

`create_vpc.sh` attaches it when `CLOUDHUB_PERMISSIONS_BOUNDARY` names a policy, so
the CI fleet config sets `CLOUDHUB_PERMISSIONS_BOUNDARY=JaiaCloudHubBoundary`, or
`jaia admin fleet create_cloudhub --permissions-boundary JaiaCloudHubBoundary`.
Create the boundary before attaching the sea-trial policy: with the policy attached
and no boundary named, every `CreateRole` call is denied.

```
aws iam create-policy --policy-name JaiaCloudHubBoundary \
    --policy-document file://cloudhub-boundary-policy.json
```
