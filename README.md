# WEMA

**Automated income protection for food delivery riders during weather and social disruptions**

WEMA is a prototype platform designed for **Zomato** and **Swiggy** riders in India. It focuses on one real problem: when a verified disruption stops a rider from working, they lose income immediately — and traditional insurance usually does not cover that loss.

WEMA is designed to detect disruption events, verify whether the rider was actively working in the affected zone, estimate lost income, and trigger a payout approval workflow with minimal manual effort.

---

## Pitch Deck

[View Pitch Deck](https://docs.google.com/presentation/d/1N79zMEmyUgxhjwrqYr_djrNbgKPwDzHu)

---

## Table of Contents

- [Pitch Deck](#pitch-deck)
- [The problem](#the-problem)
- [Phase 2 updates](#phase-2-updates)
- [Phase 3 updates](#phase-3-updates)
- [What WEMA does](#what-wema-does)
- [How we verified the rider problem](#how-we-verified-the-rider-problem)
- [The plans](#the-plans)
- [How the premium and payout are calculated](#how-the-premium-and-payout-are-calculated)
- [Payout triggers](#payout-triggers)
- [Fraud detection](#fraud-detection)
- [Adversarial defense & anti-spoofing strategy](#adversarial-defense--anti-spoofing-strategy)
- [Real scenarios](#real-scenarios)
- [What the app looks like](#what-the-app-looks-like)
- [Tech stack](#tech-stack)
- [Where we are](#where-we-are)
- [Why just food delivery for now](#why-just-food-delivery-for-now)

---

Income protection for food delivery riders. When an environmental or social calamity hits your zone and you can't work - WEMA pays you automatically. No claim forms. No waiting. No calls.

Built for Zomato/Swiggy riders in India.

---

## The problem

Eshwar is a Zomato rider in Hyderabad. On a good week he makes ₹3,500. During monsoon season, a single bad evening wipes out ₹400–600 of that — not because he got hurt, not because his bike broke down, but because it rained so hard no one was ordering and the roads were underwater.

He has no paid leave. There's no "call in sick" when you're gig. Every hour he can't ride is money he simply doesn't have.

Existing insurance products don't solve this. They cover hospital bills, bike damage, death. None of them cover the thing that actually hurts Eshwar every monsoon: **he couldn't work, so he didn't earn.**

---
## Phase 2 updates

Phase 2 focused on making WEMA closer to a real, deployable system rather than just a prototype.

- Improved disruption detection using combined signals (NewsAPI + order volume anomaly detection) for better bandh/strike identification  
- Strengthened rider verification logic without relying on Zomato/Swiggy APIs using shift tracking and delivery state proxies  
- Enhanced fraud detection to handle coordinated spoofing attempts and edge-case GPS inconsistencies  
- Refined payout logic to make calculations faster and closer to real-time  
- Improved system reliability across multiple conditions and edge cases discovered during Phase 1  

This phase was about turning assumptions into working systems and stress-testing the logic under more realistic scenarios.

---

## Phase 3 updates

Phase 3 focused on making WEMA more intelligent, automated, and closer to a real-world deployable system.

- Introduced dynamic premium calculation based on rider earnings, expected loss during disruptions, and type of calamity  
- Improved payout accuracy by linking calculations directly to time-based earning patterns instead of fixed estimates  
- Integrated multiple APIs (weather, air quality, and social signals) to make disruption detection more reliable and real-time  
- Enhanced system automation — from trigger detection to payout decision — reducing manual intervention  
- Strengthened system scalability by structuring workflows to handle real-time events and multiple riders simultaneously  

This phase was about moving from a working system to a smarter, adaptive system that reacts to real-world conditions.
## What WEMA does

WEMA monitors weather events and social disruptions across delivery zones. When a calamity hits — a flood, a cyclone, a sudden bandh — WEMA checks which riders had an active delivery at that moment, verifies their GPS puts them in the affected area, runs a fraud check, and sends money directly to their UPI account.

Eshwar doesn't open an app. He doesn't submit anything. The money just arrives.

**What we cover:** Lost income from environmental and social disruptions — heavy rain, floods, cyclones, earthquakes, extreme heat, severe pollution, unplanned curfews, local strikes, and sudden zone closures.

**What we don't cover:** Vehicle damage, medical bills, accidents, anything else. We made this call deliberately. Trying to cover everything makes the product expensive, complicated, and slow. We cover the one thing gig workers actually lose most often.

---

## How we verified the rider problem

We focused on three questions when designing this:

**How do you know the rider was actually working?**
We don't take their word for it. The rider must have at least one delivery marked as active in our system at the time the alert fires. Their GPS location must fall within the calamity radius. Both conditions have to be true.

**How do you know a real calamity happened?**
Depends on the type.

For weather — OpenWeather API fires an alert-level event for the zone. Fully automated, no human involved.

For social disruptions like curfews and strikes -- there's no clean API for a bandh. We watch for two signals: keyword monitoring on news feeds (NewsAPI, govt. advisories) and abnormal order volume drops in the zone. If both line up, it goes to an admin for confirmation before any payout releases. Semi-manual for now and we're upfront about that.

**How do you price this for someone earning ₹500/day?**
Weekly premiums, not monthly. Small amounts calculated by an AI model using the rider's earnings history, their zone's disruption frequency, and the current season. Never exceeds 2% of their average weekly earnings.

---

## The plans

| | WEMA Basic | WEMA Standard | WEMA Pro | WEMA Premium |
|---|---|---|---|---|
| Weekly premium | ₹39 | ₹59 | ₹99 | ₹159 |
| Max payout/week | ₹300 | ₹600 | ₹1,200 | ₹2,000 |
| Calamity types | Bandhs, Social calamities | Heavy Rain, Pollution,Extreme heat | Rain, Floods, Bandhs, Social calamities | Earthquakes, Cyclones, Floods and all |
| Payout time | 2 hours | 2 hours | 1 hour | 30 min |
| Days covered/week | 2 | 2 | 3 | 5 |

---

## How the premium and payout are calculated

Payout is based on what the rider actually lost, not a fixed amount.

**Step 1 : Establish the baseline**
The AI looks at the rider's average orders and earnings for the same time slot over the past 4 weeks. Tuesday dinner rush this week gets compared to the last four Tuesday dinner rushes. That's the expected earning.

**Step 2 : Calculate the loss window by calamity type**

- **Extreme heat** — loss window is the duration the heat index stayed above threshold. If it was dangerous from 1 PM to 5 PM, that's a 4-hour loss window.
- **Curfew / bandh** — loss is calculated only for riders whose registered delivery zone overlaps with the affected area. A rider operating outside the curfew boundary gets nothing.
- **Flood / cyclone / earthquake** — loss window is the full day or number of days the disruption is active in the city. If floods affect the city for 3 days, eligible riders are covered for 3 days.

**Step 3 : Calculate payout**
```
Payout = (Average hourly earnings × Lost hours) × Calamity severity factor
Capped at the plan's weekly maximum (₹300 / ₹600 / ₹1,200 / ₹2,000)
```

**Weekly premium** is then a percentage of the rider's expected weekly earnings, adjusted for how often their zone historically sees the calamity types covered by their plan. Higher risk zone + higher coverage plan = slightly higher premium. Still capped at 2% of average weekly earnings.

---

## Payout triggers

| Event | Source | Threshold | Plans |
|---|---|---|---|
| Heavy Rain / Flood | OpenWeather Alerts API | Moderate alert or above | WEMA Standard, Pro, Premium |
| Cyclone / Storm | OpenWeather Severe Weather | Cyclone watch or above | WEMA Premium |
| Earthquake | OpenWeather + seismic feed | Magnitude ≥ 4.5 | WEMA Premium |
| Extreme Heat | OpenWeather Heat Index | ≥ 45°C | WEMA Standard, Pro, Premium |
| Severe Pollution | OpenWeather Air Quality API | AQI ≥ 300 (Hazardous) | WEMA Standard, Pro, Premium |
| Curfew / Bandh | News API + govt. advisory feeds | Admin confirmed | WEMA Basic, Pro, Premium |
| Local Strike / Zone Closure | Order volume drop ≥ 60% + News API | Admin confirmed | WEMA Basic, Pro, Premium |

When a trigger fires, the eligibility check runs in this order:

1. Is the rider's current GPS location inside the calamity radius?
2. Does their registered delivery zone overlap with the affected area?
3. Do they have an active delivery in progress?
4. Does the fraud model flag anything unusual?

---

## Fraud detection

The fraud layer runs on every payout decision. It checks:

- Whether the GPS coordinates match the rider's known delivery routes
- Whether the delivery was accepted suspiciously close to the alert time
- Whether the claimed payout is consistent with the rider's earnings history
- Whether this rider has shown a pattern of claims during borderline events
- For social triggers — whether the rider's zone actually shows abnormal order volume drop, not just a self-reported inability to work

Model: Isolation Forest for anomaly detection. Flagged cases go to admin review before payout releases.

Social trigger payouts always go through admin review regardless of the fraud score — the automated fast-track is only for weather and environmental events where the source data is objective.

**A note on moral hazard**

One concern with any income protection product is that it discourages work -- riders might think "I'll just skip today and claim insurance." WEMA's design prevents this at the structural level. You only qualify for a payout if you had an active delivery in progress when the calamity hit. Sitting at home during a flood earns you nothing.

The more realistic gaming scenario is a rider accepting an order just to appear active when they sense an alert is coming, then abandoning the delivery. We handle this by cross-checking order completion rates over time. A rider who consistently abandons deliveries around calamity events gets flagged -- their claim goes to manual review and their fraud score rises with each occurrence.

The system rewards riders who were genuinely out working. That's the only group it was designed to protect.

---

## Adversarial Defense & Anti-Spoofing Strategy

GPS spoofing is a known attack vector for location-based insurance platforms. A fraudster can sit at home, run a spoofing app, place their virtual location inside a flood zone, and trigger a payout. We designed against this from the start.

---

### 1. How we tell a real rider from a fake one

GPS coordinates alone are never enough. A real delivery rider in a calamity zone looks very different from someone spoofing their location from home — not just in position, but in behaviour.

A real rider:
- Has a movement pattern consistent with a delivery route (picking up speed, stopping at restaurants, navigating to a drop point)
- Has a delivery history in that zone over weeks or months
- Shows accelerometer and gyroscope data consistent with someone on a bike in rain
- Has a device that has been used for deliveries before, not a fresh install
- Is one of many riders showing similar behaviour in the same area during the same event

A spoofer:
- Has a static or unnaturally smooth GPS path
- Often has no prior delivery history in that zone
- Shows accelerometer data inconsistent with outdoor movement (device is sitting still on a table)
- May have registered recently or only becomes "active" when calamity alerts fire
- Often appears in clusters — multiple accounts activating from the same device fingerprint or IP range

Our fraud model scores every payout claim against these signals before money moves.

---

### 2. Data signals we use beyond GPS

| Signal | What it tells us |
|---|---|
| Device fingerprint | Whether this device has a legitimate history of deliveries |
| IP address + network | Whether the network matches the claimed location (home WiFi during a "field" delivery is a red flag) |
| Accelerometer / gyroscope | Whether the device is physically moving in a way consistent with riding |
| Speed and route history | Whether the movement pattern matches a real delivery route in that zone |
| Cell tower / WiFi signals | Independent location verification that can't be faked with a spoofing app |
| App behaviour | Whether the delivery app was actively in use or running in the background |
| Timestamp consistency | Whether order acceptance, pickup, and drop timestamps follow a realistic sequence |
| Cluster detection | Whether an unusual number of claims are firing from the same area, device batch, or account group at the same time |
| Weather cross-verification | Whether other verified riders and sensors in the same zone are also showing disruption |

No single signal disqualifies a claim. The model weighs them together into a risk score.

**On coordinated fraud rings:** If an unusual number of accounts activate simultaneously in the same zone, share device fingerprints, or originate from the same IP subnet, the entire cluster is flagged and held for review regardless of individual scores. A single spoofed account is a nuisance. Five hundred spoofed accounts in the same Telegram group all firing at once is a detectable pattern.

---

### 3. How we avoid punishing honest riders

A real rider in a flood zone can have patchy GPS, lose signal under a flyover, or have location glitches from a cheap Android device. We don't reject on anomaly — we triage.

**Risk score tiers:**

- **Low risk** — payout releases automatically on the fast track
- **Medium risk** — flagged for admin review, payout held for up to 2 hours while a human checks
- **High risk** — claim paused, rider is notified and asked to provide one additional confirmation (a photo, a timestamp, a delivery app screenshot)
- **Repeat high risk** — account escalated for deeper review before any future payouts

First-time anomalies on an account with clean history are never auto-rejected. The system gives benefit of the doubt once. Patterns over multiple events trigger stricter checks.

Riders can also appeal a rejected claim through the app. Appeals go to a human reviewer, not back through the automated system.

The goal is to stop organised fraud rings — not to penalise a Hyderabad rider whose GPS drifted by 200 metres in heavy rain.

---

## Real scenarios

**Hyderabad, dinner rush, heavy rain**
Eshwar has picked up an order. OpenWeather fires a flood alert for Kukatpally. WEMA checks: active delivery -- yes. GPS in zone -- yes. Fraud flag -- none. ₹220 hits his UPI before he gets home.

**Chennai, cyclone warning**
Priya (Swiggy, WEMA Premium) accepted an order 20 minutes before the cyclone watch was issued. She qualifies. ₹350 transferred automatically.

**Mumbai, sudden bandh**
A local strike shuts down a major zone in Mumbai mid-afternoon. No weather event, but WEMA's system detects a 70% order volume drop in that pincode within 30 minutes. News API picks up "Mumbai bandh" in two local news sources. The system flags it for admin review. Admin confirms the disruption, and riders with active deliveries in the zone at that time get their payout released -- takes a bit longer than a weather trigger but still same-day.

**Attempted fraud, Delhi**
Someone registered on WEMA sees the alert and opens the app hoping to claim. No active delivery in the system. No GPS movement matching a delivery route. Not eligible. The attempt is logged for pattern monitoring.

---

## What the app looks like

**For riders:**
- Sign in with your Zomato or Swiggy account to get started — no new account needed
- Complete Aadhaar verification to confirm your identity
- Pick a plan, set up weekly payment (manual or auto-debit)
- Home screen shows your plan, this week's premium, and any active alerts in your zone
- Payout history with every event, your eligibility result, and amount received

**For admins:**
- How many riders are registered, broken down by zone
- Live map of active calamity alerts and affected riders
- Payout queue — who's eligible, amounts, transfer status
- Social trigger panel — incoming News API flags and order volume anomalies pending confirmation
- Premium pool balance
- Fraud flagged accounts with anomaly scores

---

## Tech stack

| | |
|---|---|
| Frontend | React.js + Vite + Tailwind CSS |
| Backend | Node.js + Express.js |
| Database | MongoDB Atlas |
| AI / ML | Python, scikit-learn, pandas |
| Auth | Firebase Authentication |
| Weather | OpenWeather Alerts API |
| Air Quality | OpenWeather Air Quality API |
| News Monitoring | NewsAPI |
| Maps / GPS | Google Maps API |
| Payments | Razorpay (UPI) |
| Hosting | Vercel (frontend), Render (backend) |

---

## Where we are

**Phase 1 — Ideation & Foundation**

Research, persona definition, and planning.
Deliverables for this phase: this README, the GitHub repo, and a 2-minute video outlining our strategy and prototype scope.

What's built in Phase 1: onboarding flow, plan selection, premium calculation logic, calamity trigger detection, payout flow, and admin dashboard.

**Coming next:**
- Faster UPI integration for sub-30-minute payouts across all plans
- Push notifications when a calamity alert fires in the rider's zone
- Deeper fraud detection trained on real rider data
- Rolling out to more cities beyond the initial pilot zones

---

## Why just food delivery for now

We could have built this for all gig workers. We didn't, because broad scope at the start means you design for nobody. Food delivery riders have the most predictable earnings pattern, the most direct exposure to weather disruptions, and the clearest verification path (active order = working).

There's also a practical reason -- Zomato and Swiggy riders already have a digital work trail. Every order acceptance, pickup, and drop is timestamped and location-tagged. That data is what makes our active delivery check reliable. A street vendor or an auto driver doesn't have that. We'd have no clean way to verify they were working when the calamity hit.

We get food delivery right first. Everything else comes after.

*WEMA -- Automated protection. Human peace of mind.*
