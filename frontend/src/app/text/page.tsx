import { ChatRoom } from "@/components/ChatRoom";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Text Chat — V Mingle",
  description:
    "Start your random text chat on V Mingle. Connect with strangers instantly, no account needed.",
  // Live application screen — must not be indexed by search engines.
  // Users reach this via the homepage CTA, not through search.
  robots: {
    index: false,
    follow: false,
  },
};

export default function TextPage() {
  return <ChatRoom initialMode="text" />;
}
