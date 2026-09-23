import { ChatRoom } from "@/components/ChatRoom";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Random Text Chat with Strangers",
  description:
    "Chat anonymously with strangers worldwide via free text chat on V Mingle (VMingle). No account required, instant matchmaking, and 100% private.",
  alternates: {
    canonical: "/text",
  },
  openGraph: {
    title: "V Mingle: Random Text Chat with Strangers",
    description:
      "Chat anonymously with strangers worldwide via free text chat on V Mingle.",
    url: "/text",
  },
};

export default function TextPage() {
  return <ChatRoom initialMode="text" />;
}
