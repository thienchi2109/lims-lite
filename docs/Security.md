A critical vulnerability has been identified in the React Server Components (RSC) protocol. The issue is rated CVSS 10.0 and can allow remote code execution when processing attacker-controlled requests in unpatched environments.

This vulnerability originates in the upstream React implementation (CVE-2025-55182). This advisory (CVE-2025-66478) tracks the downstream impact on Next.js applications using the App Router.

Impact
The vulnerable RSC protocol allowed untrusted inputs to influence server-side execution behavior. Under specific conditions, an attacker could craft requests that trigger unintended server execution paths. This can result in remote code execution in unpatched environments.

Affected Next.js Versions
Applications using React Server Components with the App Router are affected when running:

Next.js 15.x
Next.js 16.x
Next.js 14.3.0-canary.77 and later canary releases
Next.js 13.x, Next.js 14.x stable, Pages Router applications, and the Edge Runtime are not affected.

Fixed Versions
The vulnerability is fully resolved in the following patched Next.js releases:

15.0.5
15.1.9
15.2.6
15.3.6
15.4.8
15.5.7
16.0.7
These versions include the hardened React Server Components implementation.

Required Action
All users should upgrade to the latest patched version in their release line:

Terminal
npm install next@15.0.5   # for 15.0.x
npm install next@15.1.9   # for 15.1.x
npm install next@15.2.6   # for 15.2.x
npm install next@15.3.6   # for 15.3.x
npm install next@15.4.8   # for 15.4.x
npm install next@15.5.7   # for 15.5.x
npm install next@16.0.7   # for 16.0.x
If you are on Next.js 14.3.0-canary.77 or a later canary release, downgrade to the latest stable 14.x release:

Terminal
npm install next@14
There is no configuration option to disable the vulnerable code path.