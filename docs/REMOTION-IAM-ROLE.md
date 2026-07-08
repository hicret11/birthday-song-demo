# Remotion Lambda — create the `remotion-lambda-role` (one-time, founder action)

The Lambda deploy (`npx remotion lambda functions deploy`) failed with:

> The role defined for the function cannot be assumed by Lambda.
> InvalidParameterValueException: The role "remotion-lambda-role" does not exist …

Remotion Lambda needs **two** IAM things:

1. **A user** with an access key (✅ already done — that's `REMOTION_AWS_ACCESS_KEY_ID` /
   `REMOTION_AWS_SECRET_ACCESS_KEY` in the env). This is who *calls* AWS.
2. **A role** named exactly `remotion-lambda-role` that the rendered Lambda function
   *assumes while it runs* (❌ missing — this is the blocker). It is a separate
   principal from the user, so creating an access key does not create it.

Creating an IAM role is an access-control change, so it needs the account owner to do
it (Claude won't create IAM roles unprompted, and the Remotion *user* key normally
doesn't even have `iam:CreateRole`). Do it once in the AWS Console — ~2 minutes:

## Option A — AWS Console (recommended)
1. IAM → **Roles** → **Create role**.
2. Trusted entity type: **AWS service**; Use case: **Lambda** → Next.
3. Skip attaching managed policies (we add an inline one) → Next.
4. Role name: **`remotion-lambda-role`** (exactly) → Create role.
5. Open the new role → **Permissions** tab → **Add permissions** → **Create inline
   policy** → **JSON** → paste `remotion-role-policy.json` (below) → name it
   `remotion-lambda-policy` → Create.

The trust relationship (auto-created by "Lambda" use case) must be:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole" }
  ]
}
```

The inline permission policy (`remotion-role-policy.json`, saved next to this file):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "0", "Effect": "Allow", "Action": ["s3:ListAllMyBuckets"], "Resource": ["*"] },
    { "Sid": "1", "Effect": "Allow",
      "Action": ["s3:CreateBucket","s3:ListBucket","s3:PutBucketAcl","s3:GetObject","s3:DeleteObject","s3:PutObjectAcl","s3:PutObject","s3:GetBucketLocation"],
      "Resource": ["arn:aws:s3:::remotionlambda-*"] },
    { "Sid": "2", "Effect": "Allow", "Action": ["lambda:InvokeFunction"], "Resource": ["arn:aws:lambda:*:*:function:remotion-render-*"] },
    { "Sid": "3", "Effect": "Allow", "Action": ["logs:CreateLogGroup"], "Resource": ["arn:aws:logs:*:*:log-group:/aws/lambda-insights"] },
    { "Sid": "4", "Effect": "Allow",
      "Action": ["logs:CreateLogStream","logs:PutLogEvents"],
      "Resource": ["arn:aws:logs:*:*:log-group:/aws/lambda/remotion-render-*","arn:aws:logs:*:*:log-group:/aws/lambda-insights:*"] }
  ]
}
```

## Also confirm the USER can pass the role
The Remotion **user** policy must include `iam:PassRole` for this role (it's in
Remotion's standard user policy). If your user policy is the exact one from
`npx remotion lambda policies user`, it's already there. If the deploy still fails
with a PassRole error, add this statement to the user's policy:
```json
{ "Effect": "Allow", "Action": "iam:PassRole",
  "Resource": "arn:aws:iam::*:role/remotion-lambda-role" }
```

## After the role exists
Tell Claude Code "the remotion role is created" and it will re-run
`functions deploy` + `sites create`, fill `REMOTION_LAMBDA_FUNCTION_NAME` +
`REMOTION_SERVE_URL` into env, and verify a real premiere render end-to-end.

Full validator: `cd remotion && npx remotion lambda policies validate`.
