# Task 6 — Infrastructure

## Incident 1 — the invisible deploy

1. **Hard refresh / open an incognito window first.** This is the cheapest
   possible check and rules out browser or local caching in seconds - the
   single most common cause of "it works for me, not for you."
2. **Confirm I'm actually looking at the same URL/environment my colleague
   is.** "Works for me" often quietly means "on a different environment" -
   staging vs production, or a preview URL vs the real domain.
3. **Check the served build's actual version.** View page source or an
   asset filename/hash (most bundlers fingerprint their output) and compare
   it against the latest commit. If the hash is old despite a "green"
   deploy, the new build was never actually served to me - something
   between me and the app is stale, not the app itself.
4. **If the asset hash is old, check for a CDN or reverse-proxy cache**
   (Cloudflare, Nginx, CloudFront, etc.) sitting in front of the app and
   still serving a cached copy of the old build. This is the most likely
   real cause once caching-on-my-end is ruled out.
5. **Only then, check whether the deployment actually cut traffic over** to
   the new build - "build succeeded, deployment shows green" can mean the
   new version exists and is healthy, without necessarily meaning traffic
   was routed to it yet (common in blue-green or canary setups).

I check my own cache first because it costs nothing and rules out the most
common cause instantly; I check CDN/proxy caching before touching the
deploy pipeline itself, because it's far more likely than the deploy
process being silently broken while still reporting green.

## Incident 2 — 502 after deploy

A 502 means the reverse proxy couldn't get a valid response from the app
behind it - "container shows as running" is not the same as "the
application inside is actually up and answering requests."

1. **Read the container/application logs first.** This is the cheapest,
   fastest, and usually most direct path to the answer - if the new feature
   reads a config value that's missing or malformed, the app most likely
   crashed or threw on startup or on first request, and that will usually
   be sitting right there in the logs.
2. **Confirm the specific config value actually exists in the deployed
   environment**, not just locally. A very common cause: the value is in a
   local .env file that never made it into the deployment's real
   environment variables/secrets.
3. **If it exists, check its format/type matches what the code expects** -
   e.g. code expecting a number or JSON but receiving a plain string can
   throw an unhandled exception that crashes the process.
4. **Check the container's actual health check and port binding**, not
   just its "running" status - a process can be alive as a container while
   the application inside has crashed, hung, or failed to bind to the
   expected port, which is exactly what would produce a 502 at the proxy.

Logs come first because they are the cheapest way to go from "something is
wrong" to "this specific line is wrong." Confirming the env var's
existence and shape comes next because the incident description points
directly at "a new feature that reads a configuration value" as the
recent change - that is the most likely single cause, so I check it before
broader infrastructure-level possibilities.

## Incident 3 — the vanishing change

**What happened:** the tool was installed by exec-ing into a *running*
container and modifying its live filesystem. That change only exists in
that specific container's writable layer - it was never added to the
image the container was built from. Containers are meant to be disposable:
the next deploy pulls/builds a fresh container from the image, and that
fresh container never had the manual change baked into it. The old
container (with the manual fix) gets replaced and discarded, taking the
change with it. This is not a bug - it's the container model working
exactly as designed. Anything not captured in the image is temporary by
definition.

**How it should have been done instead:** the change needed to go into
whatever actually produces the image - the Dockerfile (e.g. a RUN line
installing the tool) or the application's own source/config, committed to
version control, then rebuilt and redeployed through the normal pipeline.
Exec-ing into a running container is a legitimate way to *investigate* a
problem live, but it should never be treated as the fix itself - the real
fix has to be reproducible from a clean build, not dependent on a manual
step someone remembers to redo after every deploy.
