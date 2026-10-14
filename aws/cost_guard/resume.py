#!/usr/bin/env python3
"""
Undo an aws-cost-guard shutdown: restarts everything tagged cost-guard-stopped=true.

If this month's spend is still over the limit, the guard will shut things down
again on its next run (within 6 hours) — raise the limit first with
`python aws/setup_cost_guard.py --limit <new>`.

Usage:
    python aws/cost_guard/resume.py
"""

import os

import boto3

REGION = os.environ.get('AWS_REGION', 'ap-south-1')
TAG_KEY = 'cost-guard-stopped'


def tagged(tags):
    return any(t['Key'] == TAG_KEY for t in tags)


def main():
    rds = boto3.client('rds', region_name=REGION)
    lam = boto3.client('lambda', region_name=REGION)
    events = boto3.client('events', region_name=REGION)

    for db in rds.describe_db_instances()['DBInstances']:
        if not tagged(db.get('TagList', [])):
            continue
        if db['DBInstanceStatus'] == 'stopped':
            rds.start_db_instance(DBInstanceIdentifier=db['DBInstanceIdentifier'])
            print(f"starting RDS {db['DBInstanceIdentifier']} (takes ~5 min)")
        rds.remove_tags_from_resource(ResourceName=db['DBInstanceArn'], TagKeys=[TAG_KEY])

    for page in lam.get_paginator('list_functions').paginate():
        for fn in page['Functions']:
            if TAG_KEY not in lam.list_tags(Resource=fn['FunctionArn']).get('Tags', {}):
                continue
            lam.delete_function_concurrency(FunctionName=fn['FunctionName'])
            lam.untag_resource(Resource=fn['FunctionArn'], TagKeys=[TAG_KEY])
            print(f"unblocked Lambda {fn['FunctionName']}")

    for page in events.get_paginator('list_rules').paginate():
        for rule in page['Rules']:
            if not tagged(events.list_tags_for_resource(ResourceARN=rule['Arn'])['Tags']):
                continue
            events.enable_rule(Name=rule['Name'])
            events.untag_resource(ResourceARN=rule['Arn'], TagKeys=[TAG_KEY])
            print(f"enabled rule {rule['Name']}")


if __name__ == '__main__':
    main()
