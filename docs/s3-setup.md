# S3 setup for post images

The backend already has image upload wired up (`src/lib/s3.ts`,
`src/services/upload.service.ts`, `POST /api/upload`). This document is
just the AWS-side setup needed to make that code work: create the bucket,
let uploaded images be publicly viewable, and give the server write
access — all through the AWS Console.

## How the app actually uses S3 (read this first)

- **Uploads are server-mediated, not direct-to-S3.** The browser sends the
  file to `POST /api/upload` on your API; the server validates it and
  uploads to S3 itself using `PutObjectCommand`. The browser never talks
  to S3 directly, and the app never issues presigned URLs.
  → **You do not need to configure CORS on the bucket.** CORS only
  matters for browser-to-S3 requests (direct upload, or `fetch`/canvas
  reading pixel data) — plain `<img src="...">` tags, which is all this
  site does with the returned URL, work cross-origin without it.
- **Only images, only up to 10MB.** `upload.service.ts`'s multer
  `fileFilter` rejects anything whose mimetype isn't `image/*` before it
  ever reaches S3, and caps size at 10MB. Nothing to configure on the
  bucket for this — it's enforced in the app.
- **Objects are written under a fixed prefix**: `posts/<timestamp>-
  <random>.<ext>`. Every policy below is scoped to `posts/*` rather than
  the whole bucket, so if you ever reuse this bucket for something else,
  that other content isn't affected.
- **The returned URL is a plain public S3 URL**
  (`https://<bucket>.s3.<region>.amazonaws.com/posts/...`), stored
  directly as `coverImageUrl` / inline `<img>` src in post content. That
  means objects under `posts/` need to be publicly *readable* — this is
  the one non-obvious part of the setup, since S3 blocks public access by
  default.

---

## 1. Create the bucket

1. Sign in to the **AWS Console** → search **S3** → open the S3 console.
2. Click **Create bucket**.
3. **Bucket name**: something globally unique, e.g.
   `whyisitnotpossible-blog-images`. Note it down — this is your
   `AWS_S3_BUCKET`.
4. **AWS Region**: pick the region you'll run the backend in. Note it
   down — this is your `AWS_REGION`.
5. **Object Ownership**: leave the default, **ACLs disabled (bucket owner
   enforced)**. Nothing here needs ACLs — access is granted entirely via
   the bucket policy in step 3 below.
6. **Block Public Access settings for this bucket**: leave all four boxes
   checked for now — you'll narrow this down deliberately in the next
   step rather than opening it up during bucket creation.
7. Leave **Bucket Versioning** disabled and **Default encryption** at its
   default (SSE-S3) — neither matters for this use case.
8. Click **Create bucket**.

## 2. Loosen Block Public Access (only the bucket-policy checks)

By default S3 blocks *all* public access, which would silently no-op the
bucket policy you're about to add in step 3.

1. Open your new bucket → **Permissions** tab.
2. Find **Block public access (bucket settings)** → click **Edit**.
3. Uncheck exactly these two:
   - "Block public access to buckets and objects granted through new
     public bucket policies"
   - "Block public and cross-account access to buckets and objects
     through any public bucket policies"
4. **Leave both ACL-related boxes checked** — nothing here uses ACLs, so
   there's no reason to allow them:
   - "Block public access to buckets and objects granted through new
     access control lists (ACLs)"
   - "Block public access to buckets and objects granted through any
     access control lists (ACLs)"
5. Click **Save changes**, then type `confirm` in the dialog that pops up
   and confirm.

## 3. Add the bucket policy — public read on `posts/*` only

Still on the bucket's **Permissions** tab:

1. Find **Bucket policy** → click **Edit**.
2. Paste this in, replacing `YOUR_BUCKET_NAME` with your actual bucket
   name:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadPostImages",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/posts/*"
       }
     ]
   }
   ```

3. Click **Save changes**. If step 2 wasn't done first, S3 will refuse to
   save this with an error about public policies being blocked.

## 4. Create the IAM policy (write access, scoped to `posts/*`)

The app only ever calls `PutObject` (never deletes or reads back through
the SDK — reads happen over plain HTTPS via the public URL), so the
policy only needs to grant that, only under the one prefix.

1. Search **IAM** in the AWS Console → open the IAM console.
2. Left sidebar → **Policies** → **Create policy**.
3. Switch to the **JSON** tab (instead of the visual editor) and paste,
   again replacing `YOUR_BUCKET_NAME`:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "AllowPostImageUploads",
         "Effect": "Allow",
         "Action": "s3:PutObject",
         "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/posts/*"
       }
     ]
   }
   ```

4. Click **Next**.
5. **Policy name**: `PostImageUploads`. Click **Create policy**.

## 5. Create the IAM user and attach the policy

Use a dedicated user for this app — don't reuse your personal AWS login.

1. IAM console → left sidebar → **Users** → **Create user**.
2. **User name**: `whyisitnotpossible-blog-uploader`.
3. **Do not** check "Provide user access to the AWS Management Console" —
   this user only ever needs programmatic (SDK) access, never console
   login. Click **Next**.
4. **Set permissions** → choose **Attach policies directly**.
5. In the policy search box, search for `PostImageUploads` (the policy
   from step 4), check its box.
6. Click **Next**, review, then **Create user**.

## 6. Generate an access key for the user

1. IAM console → **Users** → click `whyisitnotpossible-blog-uploader`.
2. **Security credentials** tab → scroll to **Access keys** → **Create
   access key**.
3. **Use case**: choose **Application running outside AWS** (or
   "Third-party service" if that's what your console shows) — this app
   runs locally / on your own server, not on AWS compute. Acknowledge the
   recommendation notice and click **Next**.
4. (Optional) add a description tag, then **Create access key**.
5. Copy the **Access key ID** and **Secret access key** now, or download
   the `.csv` — the secret is shown exactly once and can't be retrieved
   again later (you'd have to generate a new key pair).

> Deploying to AWS infra (ECS/EC2/Lambda) instead of running locally?
> Skip steps 5–6 (no IAM user, no access keys) and instead attach the
> `PostImageUploads` policy from step 4 directly to an **IAM role**
> assigned to that compute. `getS3Client()` picks up role credentials
> automatically via the SDK's default provider chain — no env vars
> needed.

## 7. Set environment variables

In `.env` (see `.env.example`):

```bash
AWS_REGION="YOUR_REGION"
AWS_S3_BUCKET="YOUR_BUCKET_NAME"
AWS_ACCESS_KEY_ID="<from step 6>"
AWS_SECRET_ACCESS_KEY="<from step 6>"
```

## 8. Verify

```bash
curl -X POST http://localhost:5000/api/upload \
  -H "Cookie: <a logged-in session cookie>" \
  -F "file=@/path/to/test-image.jpg"
```

Expect `{ "url": "https://YOUR_BUCKET_NAME.s3.YOUR_REGION.amazonaws.com/posts/..." }`
back, and the URL should load the image directly in a browser (confirms
the bucket policy from step 3 is actually in effect).

## Only images, for now

The 10MB/`image/*`-only restriction lives entirely in
`upload.service.ts`'s multer config, not in S3 — when video or other
media types get added later, that's a code change (fileFilter + likely a
separate prefix/size limit), not an AWS reconfiguration.
