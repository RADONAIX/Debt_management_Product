import { createFileRoute } from "@tanstack/react-router";
import { ChatApp } from "@/components/chat/chat-app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NovaTel Assist — Telecom AI Chatbot" },
      {
        name: "description",
        content:
          "Chat with NovaTel Assist to check balance and data usage, view bills, recharge, change plans, activate roaming and track complaints.",
      },
      { property: "og:title", content: "NovaTel Assist — Telecom AI Chatbot" },
      {
        property: "og:description",
        content:
          "AI chatbot for mobile subscribers: balance, usage, bills, recharge, plans, roaming and network support in one conversation.",
      },
    ],
  }),
  component: ChatApp,
});
