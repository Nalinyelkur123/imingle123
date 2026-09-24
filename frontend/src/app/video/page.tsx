import { ChatRoom } from "@/components/ChatRoom";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Video Chat — V Mingle",
  description:
    "Start your random video chat on V Mingle. Connect with strangers instantly, no account needed.",
  // Live application screen — must not be indexed by search engines.
  // Users reach this via the homepage CTA, not through search.
  robots: {
    index: false,
    follow: false,
  },
};

export default function VideoPage() {
  return <ChatRoom initialMode="video" />;
}
