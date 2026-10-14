#!/usr/bin/env python3
"""
Setup for the AWS cost kill-switch (aws/cost_guard/guard.py).

  1. Sets the `monthly-cost-guard` budget to LIMIT_USD (tax included), plus
     email alerts at 80% and 100% of actual spend if --email is given.
  2. Creates the IAM role + `aws-cost-guard` Lambda.
  3. Schedules it every 6 hours.

Safe to re-run; it updates in place.

Usage:
    python aws/setup_cost_guard.py [--limit 20] [--email you@example.com]
"""

import argparse
import io
import json
import os
import time
import zipfile

import boto3

REGION = os.environ.get('AWS_REGION', 'ap-south-1')
BUDGET_NAME = 'monthly-cost-guard'
ROLE_NAME = 'aws-cost-guard-role'
FUNCTION_NAME = 'aws-cost-guard'
RULE_NAME = 'aws-cost-guard-schedule'
SCHEDULE = 'rate(6 hours)'

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

TRUST_POLICY = json.dumps({
    'Version': '2012-10-17',
    'Statement': [{
        'Effect': 'Allow',
        'Principal': {'Service': 'lambda.amazonaws.com'},
        'Action': 'sts:AssumeRole',
    }],
})


def guard_policy(account_id):
    return json.dumps({
        'Version': '2012-10-17',
        'Statement': [
            {'Effect': 'Allow', 'Action': 'budgets:ViewBudget',
             'Resource': f'arn:aws:budgets::{account_id}:budget/{BUDGET_NAME}'},
            {'Effect': 'Allow',
             'Action': ['rds:DescribeDBInstances', 'rds:StopDBInstance', 'rds:AddTagsToResource'],
             'Resource': '*'},
            {'Effect': 'Allow',
             'Action': ['lambda:ListFunctions', 'lambda:GetFunctionConcurrency',
                        'lambda:PutFunctionConcurrency', 'lambda:TagResource'],
             'Resource': '*'},
            {'Effect': 'Allow',
             'Action': ['events:ListRules', 'events:DisableRule', 'events:TagResource'],
             'Resource': '*'},
            {'Effect': 'Allow',
             'Action': ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
             'Resource': '*'},
        ],
    })


def p(msg): print(f'  {msg}')


def make_zip():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.write(os.path.join(SCRIPT_DIR, 'cost_guard', 'guard.py'), arcname='guard.py')
    return buf.getvalue()


def setup_budget(account_id, limit, email):
    print('\n[1/3] Budget')
    b = boto3.client('budgets', region_name='us-east-1')
    budget = b.describe_budget(AccountId=account_id, BudgetName=BUDGET_NAME)['Budget']
    budget['BudgetLimit'] = {'Amount': str(limit), 'Unit': 'USD'}
    budget.pop('CalculatedSpend', None)
    budget.pop('LastUpdatedTime', None)
    budget.pop('HealthStatus', None)
    b.update_budget(AccountId=account_id, NewBudget=budget)
    p(f'{BUDGET_NAME} limit → ${limit}')
    if not email:
        return

    existing = b.describe_notifications_for_budget(AccountId=account_id, BudgetName=BUDGET_NAME)['Notifications']
    for pct in (80, 100):
        n = {'NotificationType': 'ACTUAL', 'ComparisonOperator': 'GREATER_THAN',
             'Threshold': pct, 'ThresholdType': 'PERCENTAGE'}
        if any(e['NotificationType'] == 'ACTUAL' and e['Threshold'] == pct for e in existing):
            p(f'{pct}% alert already exists')
            continue
        b.create_notification(AccountId=account_id, BudgetName=BUDGET_NAME, Notification=n,
                              Subscribers=[{'SubscriptionType': 'EMAIL', 'Address': email}])
        p(f'{pct}% email alert → {email}')


def setup_role(account_id):
    print('\n[2/3] IAM role + Lambda')
    iam = boto3.client('iam', region_name=REGION)
    try:
        role_arn = iam.create_role(RoleName=ROLE_NAME, AssumeRolePolicyDocument=TRUST_POLICY,
                                   Description='AWS cost kill-switch')['Role']['Arn']
        p(f'created role {ROLE_NAME}')
    except iam.exceptions.EntityAlreadyExistsException:
        role_arn = iam.get_role(RoleName=ROLE_NAME)['Role']['Arn']
        p(f'role {ROLE_NAME} exists')
    iam.put_role_policy(RoleName=ROLE_NAME, PolicyName='cost-guard',
                        PolicyDocument=guard_policy(account_id))
    return role_arn


def setup_lambda(role_arn, limit):
    lam = boto3.client('lambda', region_name=REGION)
    env = {'Variables': {
        'BUDGET_NAME': BUDGET_NAME,
        'LIMIT_USD': str(limit),
        'OWN_RULE': RULE_NAME,
        'TELEGRAM_BOT_TOKEN': os.environ.get('TELEGRAM_BOT_TOKEN', ''),
        'TELEGRAM_CHAT_ID': os.environ.get('TELEGRAM_CHAT_ID', ''),
    }}
    try:
        for attempt in range(8):
            try:
                arn = lam.create_function(
                    FunctionName=FUNCTION_NAME, Runtime='python3.11', Role=role_arn,
                    Handler='guard.handler', Code={'ZipFile': make_zip()},
                    Timeout=60, MemorySize=128, Environment=env,
                )['FunctionArn']
                break
            except lam.exceptions.InvalidParameterValueException:
                if attempt == 7:
                    raise
                time.sleep(5)  # new role not yet assumable by Lambda
        p(f'created Lambda {FUNCTION_NAME}')
    except lam.exceptions.ResourceConflictException:
        lam.update_function_code(FunctionName=FUNCTION_NAME, ZipFile=make_zip())
        lam.get_waiter('function_updated').wait(FunctionName=FUNCTION_NAME)
        arn = lam.update_function_configuration(FunctionName=FUNCTION_NAME, Role=role_arn,
                                                Environment=env)['FunctionArn']
        p(f'updated Lambda {FUNCTION_NAME}')
    lam.get_waiter('function_active_v2').wait(FunctionName=FUNCTION_NAME)
    lam.get_waiter('function_updated').wait(FunctionName=FUNCTION_NAME)
    return arn


def setup_schedule(fn_arn):
    print('\n[3/3] Schedule')
    events = boto3.client('events', region_name=REGION)
    lam = boto3.client('lambda', region_name=REGION)
    rule_arn = events.put_rule(Name=RULE_NAME, ScheduleExpression=SCHEDULE, State='ENABLED')['RuleArn']
    events.put_targets(Rule=RULE_NAME, Targets=[{'Id': 'guard', 'Arn': fn_arn}])
    try:
        lam.add_permission(FunctionName=FUNCTION_NAME, StatementId='eventbridge-invoke',
                           Action='lambda:InvokeFunction', Principal='events.amazonaws.com',
                           SourceArn=rule_arn)
    except lam.exceptions.ResourceConflictException:
        pass
    p(f'{RULE_NAME}: {SCHEDULE}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--email', help='Optional: also email budget alerts at 80%%/100%%')
    ap.add_argument('--limit', type=float, default=20)
    args = ap.parse_args()

    account_id = boto3.client('sts', region_name=REGION).get_caller_identity()['Account']
    print(f'AWS Account: {account_id}  Region: {REGION}  Limit: ${args.limit}')

    setup_budget(account_id, args.limit, args.email)
    role_arn = setup_role(account_id)
    fn_arn = setup_lambda(role_arn, args.limit)
    setup_schedule(fn_arn)
    print('\nDone.')


if __name__ == '__main__':
    main()
