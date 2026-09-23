import { ChatRoom } from "@/components/ChatRoom";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Random Video Chat with Strangers",
  description:
    "Connect instantly via 1-on-1 random video chat on V Mingle (VMingle). Fast, high-definition, free, and completely anonymous.",
  alternates: {
    canonical: "/video",
  },
  openGraph: {
    title: "V Mingle: Random Video Chat with Strangers",
    description:
      "Connect instantly via 1-on-1 random video chat on V Mingle. Free, fast, and anonymous.",
    url: "/video",
  },
};

export default function VideoPage() {
  return <ChatRoom initialMode="video" />;
}
