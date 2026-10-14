"""
AWS cost kill-switch.

Runs on a schedule. Reads month-to-date actual spend (tax included) from the
`monthly-cost-guard` budget. If it exceeds the limit, it shuts everything down:
  - stops every RDS instance
  - sets reserved concurrency 0 on every other Lambda (blocks all invocations)
  - disables every EventBridge rule except its own schedule

Everything it touches is tagged `cost-guard-stopped=true` so aws/cost_guard/resume.py
can undo exactly that. Re-runs are idempotent, which also re-stops RDS if AWS
auto-starts it after 7 days.

Invoke with {"dry_run": true} to list what would be stopped without touching anything.

Env vars: BUDGET_NAME, LIMIT_USD, OWN_RULE, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
"""

import os
import urllib.parse
import urllib.request

import boto3

BUDGET_NAME = os.environ.get('BUDGET_NAME', 'monthly-cost-guard')
LIMIT_USD = float(os.environ.get('LIMIT_USD', '30'))
OWN_RULE = os.environ.get('OWN_RULE', 'aws-cost-guard-schedule')
TAG = {'Key': 'cost-guard-stopped', 'Value': 'true'}

rds = boto3.client('rds')
lam = boto3.client('lambda')
events = boto3.client('events')
budgets = boto3.client('budgets', region_name='us-east-1')


def notify(msg):
    print(msg)
    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    chat = os.environ.get('TELEGRAM_CHAT_ID')
    if not token or not chat:
        return
    data = urllib.parse.urlencode({'chat_id': chat, 'text': msg}).encode()
    try:
        urllib.request.urlopen(f'https://api.telegram.org/bot{token}/sendMessage', data, timeout=10)
    except Exception as e:
        print(f'telegram failed: {e}')


def actual_spend(account_id):
    b = budgets.describe_budget(AccountId=account_id, BudgetName=BUDGET_NAME)['Budget']
    return float(b['CalculatedSpend']['ActualSpend']['Amount'])


def shutdown(own_function_name, dry_run=False):
    done = []

    for db in rds.describe_db_instances()['DBInstances']:
        if db['DBInstanceStatus'] == 'available':
            if not dry_run:
                rds.add_tags_to_resource(ResourceName=db['DBInstanceArn'], Tags=[TAG])
                rds.stop_db_instance(DBInstanceIdentifier=db['DBInstanceIdentifier'])
            done.append(f"stopped RDS {db['DBInstanceIdentifier']}")

    for page in lam.get_paginator('list_functions').paginate():
        for fn in page['Functions']:
            name = fn['FunctionName']
            if name == own_function_name:
                continue
            if lam.get_function_concurrency(FunctionName=name).get('ReservedConcurrentExecutions') == 0:
                continue
            if not dry_run:
                lam.tag_resource(Resource=fn['FunctionArn'], Tags={TAG['Key']: TAG['Value']})
                lam.put_function_concurrency(FunctionName=name, ReservedConcurrentExecutions=0)
            done.append(f'blocked Lambda {name}')

    for page in events.get_paginator('list_rules').paginate():
        for rule in page['Rules']:
            if rule['Name'] == OWN_RULE or rule['State'] != 'ENABLED':
                continue
            if rule.get('ManagedBy'):
                continue  # AWS-managed rules can't be disabled by us
            if not dry_run:
                events.tag_resource(ResourceARN=rule['Arn'], Tags=[TAG])
                events.disable_rule(Name=rule['Name'])
            done.append(f"disabled rule {rule['Name']}")

    return done


def handler(event, context):
    account_id = context.invoked_function_arn.split(':')[4]
    spend = actual_spend(account_id)
    print(f'month-to-date spend ${spend:.2f} / limit ${LIMIT_USD:.2f}')

    if event.get('dry_run'):
        return {'spend': spend, 'would_do': shutdown(context.function_name, dry_run=True)}

    if spend <= LIMIT_USD:
        return {'spend': spend, 'action': 'none'}

    done = shutdown(context.function_name)
    if done:
        notify(
            f'AWS COST GUARD: spend ${spend:.2f} exceeded ${LIMIT_USD:.0f} this month.\n'
            + '\n'.join(done)
            + '\nRun `python aws/cost_guard/resume.py` to restore.'
        )
    return {'spend': spend, 'action': done}
