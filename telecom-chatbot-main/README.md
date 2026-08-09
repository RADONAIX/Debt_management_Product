# Telecom Companion

Build a production-ready Telecom Subscriber AI Chatbot web application for mobile subscribers. This is a frontend-only implementation for now, but the architecture must be ready for future backend, API, authentication, CRM, billing, recharge, network, and ticketing integrations.

Objective

Create a secure, modern, business-grade self-service chatbot where subscribers can ask questions, view account information, perform common telecom actions, raise complaints, and track requests.

Application Layout

Use a responsive desktop and mobile design with:

Collapsible left navigation

Main chatbot workspace

Subscriber information panel

Top header with operator logo, language selector, notifications, profile, and logout

Clean telecom enterprise design

Light theme with white, navy, blue, and subtle teal accents

Professional typography, rounded cards, soft shadows, and clear status indicators

Left Navigation

Include:

AI Assistant

My Account

Usage & Balance

Recharge & Payments

Plans & Add-ons

Bills & Statements

Network Support

Service Requests

Offers

Help & FAQs

Settings

Chatbot Screen

Create a conversational chatbot interface with:

Welcome message using subscriber name

Message input with send, attachment, microphone, and quick-action buttons

Typing indicator

Bot and subscriber message bubbles

Date and time stamps

Suggested prompts

Rich response cards

Confirmation dialogs for transactional actions

Feedback buttons: helpful / not helpful

Option to connect with a live agent

Conversation history

Suggested quick actions:

Check balance

View data usage

Recharge number

Download bill

Change plan

Activate roaming

Report network issue

Block lost SIM

Check complaint status

Talk to support

Subscriber 360 Panel

Display a compact right-side subscriber profile containing:

Subscriber name

MSISDN

Customer ID

Prepaid or Postpaid

Active plan

Account status

Available balance

Data remaining

Voice minutes

SMS balance

Bill due date

Current bill amount

Loyalty tier

KYC status

Network type: 4G / 5G

SIM status

Active services

Mask sensitive subscriber information by default.

Telecom Response Cards

Design reusable UI cards for:

Balance and usage summary

Recharge packages

Recommended plans

Current bill

Payment history

Active add-ons

Roaming packs

Service request status

Network outage information

Trouble-ticket creation

SIM replacement request

Number portability request

Usage anomaly notification

Personalized offers

Key User Flows

Create realistic frontend flows for:

Balance and usage enquiry

Recharge and payment

Bill download

Plan comparison and upgrade

Add-on activation

International roaming activation

Network complaint registration

Complaint tracking

Lost SIM blocking

Live-agent escalation

Use step-by-step confirmation before any transactional action.

Business and Security Requirements

Include:

OTP verification screen for sensitive actions

Session timeout warning

Consent message before accessing personal information

Data masking

Fraud and suspicious activity warning

Transaction confirmation

Success and failure states

Audit-friendly transaction reference IDs

Accessibility-compliant components

Multi-language-ready design

Clear privacy and terms links

Responsive design for desktop, tablet, and mobile

Dashboard Data

Use realistic mock telecom data. Do not use lorem ipsum.

Example subscriber:

Name: Arjun Rao

MSISDN: +91 98XXXX3210

Customer type: Postpaid

Plan: Infinity 799 5G

Data usage: 72 GB of 100 GB

Bill amount: ₹1,126

Due date: 18 August 2026

Account status: Active

Loyalty tier: Gold

Technical Structure

Build using React, TypeScript, Tailwind CSS, and reusable components.

Maintain separate layers for:

UI components

Mock data

API service placeholders

Authentication state

Chat state

Subscriber state

Transaction state

Create placeholder service methods for:

getSubscriberProfile

getBalance

getUsage

getPlans

getBills

makePayment

activateAddon

createServiceRequest

getServiceRequestStatus

getNetworkStatus

escalateToAgent

sendChatMessage

Do not hardcode business logic inside UI components.

Final Output

Generate a complete polished frontend with:

Login and OTP screens

Main chatbot dashboard

Subscriber 360 panel

Responsive mobile view

Reusable telecom cards

Empty, loading, success, warning, and error states

Realistic mock interactions

Professional production-grade UI suitable for a telecom operator customer self-service portal

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/11508bc8-a3d7-44ea-8d18-4d6a061d7bed).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
