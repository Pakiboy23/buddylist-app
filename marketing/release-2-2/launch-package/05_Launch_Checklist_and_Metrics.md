# Launch checklist, release gate, and metrics

> Extracted verbatim from the founder-supplied 05_Launch_Checklist_and_Metrics.md.docx (package of Aug 4 2026). Gate status as of Aug 16: ALREADY SATISFIED — see EXECUTION-2026-08-18.md.

Launch checklist, release gate, and metrics
Immediate release-health gate
The public App Store listing shows version 2.2 as live. Before driving traffic, test the public App Store build, not TestFlight.

GitHub PR #98 documents a native bridge timing race seen in the 2.2 review build. It can surface as “Buddy requests bridge unavailable” when a list action is tapped immediately after launch. The proposed fix waits briefly for the bridge before failing and applies to Add, Knock, and buddy-request responses.

Decision: proceed with the broad launch only if those actions pass from a cold start in the public build.
Ten-minute production smoke test
Delete or offload any development/TestFlight copy as needed, then install version 2.2 from the public App Store.
Confirm the App Store version reads 2.2.
Cold-launch the app twice.
Sign in and confirm the Buddy List, Rooms, and Find tabs render.
Tap the profile card at the top of the Buddy List and confirm editing opens.
Confirm buddy photos and Suggested Buddies load.
Immediately after a fresh cold launch, tap Add on a Suggested Buddy.
From a second test account, accept or respond to the buddy request.
Send a Knock from the Buddy List.
Reply to an away message.
Open a profile and confirm mutual context appears where expected.
Create or edit a private Buddy Circle.
Open Privacy Controls and change discoverability, then confirm the setting persists.
Send a room message and confirm the aggregate seen count behaves as expected.
Sign out, sign back in, and confirm the core state returns.
Go / no-go rule
Go: Add, request response, and Knock work on two consecutive cold launches with no bridge error. Begin the rollout.

Hold broad traffic: any action produces a hard bridge error, repeatedly fails, or appears to succeed without server state changing. Keep communication limited to early testers, save the exact reproduction, and prepare version 2.2.1 from PR #98.

PR: https://github.com/Pakiboy23/buddylist-app/pull/98
Publishing checklist
Product and listing
Confirm the U.S. App Store page resolves and shows version 2.2.
Check the listing from a signed-out browser and a physical iPhone.
Confirm the website’s App Store button opens the correct listing.
Confirm support and privacy links on the listing resolve.
Take timestamped screenshots of the live listing and version notes.
Content
Add the direct App Store CTA to the Substack post.
Add alt text to every image.
Check every pasted link before publishing.
Remove any bracketed production notes.
Upload the six carousel slides in numeric order.
Add captions to video and correct “H.I.M.” manually.
Pin the main launch post on active social profiles.
Update the bio link UTM without removing hiitsme.app as the persistent destination.
Support readiness
Create one place to log launch bugs with time, account, device, OS, screen, action, result, and screenshot.
Prepare a short status response for known issues.
Keep one clean test account and one second account available for relationship actions.
Check crash, API, and authentication monitoring before posting.
Block two 30-minute windows for comment replies and support triage.
Baseline record
Capture these numbers immediately before posting. Use one timezone, preferably ET, and write the exact timestamp beside each snapshot.

Metric
Baseline
24 hours
72 hours
7 days
App Store impressions




App Store product-page views




First-time downloads




Product-page conversion rate




Website sessions from him_v2_2




New accounts




Completed profiles




Buddy requests sent




Buddy requests accepted




Knocks sent




Away-message replies




Members sending a room message




Day-1 retained members




App Store ratings and reviews




Crashes or high-severity errors




Support reports




Measurement hierarchy
1. Release health
Crash-free sessions
Sign-in success
Add, accept, and Knock success rates
Bridge-unavailable errors
Support reports by severity

These outrank marketing performance. A growing funnel into a broken friendship action is not a launch win.
2. Acquisition
App Store product-page views
First-time downloads
Product-page conversion
Website sessions by source and creative
3. Activation
Define an activated new member as completing a profile plus one meaningful friendship action within 72 hours. A meaningful action can be a buddy request, accepted request, Knock, away-message reply, or room message.

Track the share of new accounts that activate and the median time to first meaningful action.
4. Relationship behavior
Buddy requests accepted, not just sent
Knock response rate, not just sends
Members with at least one mutual-context profile view
Members using a Buddy Circle
Room conversations that continue beyond one message
5. Retention
Day-1 and Day-7 return rates
Return rate among activated versus non-activated members
Percentage of returning members who open the Buddy List first
Review cadence
At 24 hours
Triage every crash and hard action failure.
Compare channel clicks with App Store product-page views.
Identify the best-performing launch hook, not just the largest channel.
Do not change the entire campaign based on a few hours of reach.
At 72 hours
Calculate the activation rate for the first release cohort.
Compare Suggested Buddy actions, direct buddy requests, and room activity.
Decide whether the next feature reveal should address curiosity or confusion.
Ask for an App Store rating only after a successful friendship action.
At seven days
Publish one honest, contextual signal in the week-one recap.
Select one friction to fix and one behavior to encourage.
Archive the winning copy and asset pairing.
Decide whether 2.2.1 is a reliability patch, a small polish release, or unnecessary.
Incident response copy
Public acknowledgement
I am seeing an issue with [specific action] in H.I.M. 2.2 and am working on it now. Other parts of the app remain available. I will update this post when the fix is ready. Thank you to the people who sent clear reports.
Resolution
The issue affecting [specific action] has been fixed in version [number]. Please update from the App Store, then relaunch H.I.M. Thank you for the reports and patience.
After the first week
Fold the winning headline and screenshots into the website.
Add the best-performing creative to the App Store product-page testing backlog.
Turn repeated support questions into onboarding or help copy.
Save verified launch learnings with the release notes for version 2.3 planning.
Keep the Sunday Reset as the recurring community ritual after release traffic settles.
