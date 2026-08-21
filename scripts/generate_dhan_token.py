"""One-shot Dhan TOTP login for the Daily Dhan Sync workflow: mints a single
access token that gets reused across every Dhan-calling step in the job,
instead of each sync script logging in independently.

Independent per-script logins meant two TOTP logins could land too close
together if an earlier step in the job finished quickly (a fast SME sync
with little new data, say) - and Dhan rejects a login outright with
"Invalid TOTP" when that happens, rather than just rate-limiting it. See
dhan_daily_sync.yml for how the resulting single token is passed to each
step as DHAN_TOKEN_FILE.

The token is a live, full-access credential for a real brokerage account in
a public repo, so this deliberately never puts it on stdout, in a step
output, or anywhere else that ends up in Actions logs (log-masking is a
mitigation, not a guarantee - better to just never emit the value). --out
writes it straight to a file on the runner's ephemeral disk instead, mode
0600, which is deleted with the rest of the workspace when the job ends.
"""
import argparse, os, stat, sys
import pyotp
import requests

DHAN_CLIENT_ID = os.getenv('DHAN_CLIENT_ID')
DHAN_PIN = os.getenv('DHAN_PIN')
DHAN_TOTP_SECRET = os.getenv('DHAN_TOTP_SECRET')
DHAN_TOKEN_URL = 'https://auth.dhan.co/app/generateAccessToken'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', required=True, help='File path to write the access token to (mode 0600)')
    args = parser.parse_args()

    if not DHAN_CLIENT_ID or not DHAN_PIN or not DHAN_TOTP_SECRET:
        print("DHAN_CLIENT_ID / DHAN_PIN / DHAN_TOTP_SECRET not set", file=sys.stderr)
        sys.exit(1)

    totp_code = pyotp.TOTP(DHAN_TOTP_SECRET).now()
    resp = requests.post(
        DHAN_TOKEN_URL,
        params={
            "dhanClientId": DHAN_CLIENT_ID,
            "pin": DHAN_PIN,
            "totp": totp_code,
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if 'accessToken' not in data:
        print(f"Dhan token generation failed: {data.get('message', data)}", file=sys.stderr)
        sys.exit(1)

    fd = os.open(args.out, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, stat.S_IRUSR | stat.S_IWUSR)
    with os.fdopen(fd, 'w') as f:
        f.write(data['accessToken'])
    print(f"Access token written to {args.out}")


if __name__ == '__main__':
    main()
