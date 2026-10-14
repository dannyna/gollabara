# Security Policy

## Supported versions

gollabara is in early development and has no releases yet. Security fixes land on `main`.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Instead, report them privately through GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability):
go to the repository's **Security** tab and click **"Report a vulnerability"**.

If you cannot use that channel, email **danny@pusan.ac.kr** instead.

Please include:

- A description of the vulnerability and its impact
- Steps to reproduce, or a proof of concept
- The commit you tested, and any known mitigations

gollabara is designed to run only on your machine and inside your own tailnet. Anything that exposes the server, its stored images, or its WebSocket stream beyond that is in scope.

## What to expect

- We aim to acknowledge your report within **72 hours**.
- We will keep you informed of progress toward a fix and may ask for additional
  detail.
- Once a fix lands, we will credit you in the advisory unless you prefer
  to remain anonymous.

We ask that you give us a reasonable opportunity to address the issue before any
public disclosure.
