import { Metadata } from "next";
import { ChatRoom } from "@/components/ChatRoom";
import {
  constructMetadata,
  getSoftwareApplicationSchema,
  getBreadcrumbSchema,
} from "@/config/site";

export const metadata: Metadata = constructMetadata({
  title: "Random Video Chat With Strangers",
  description:
    "Start free random video chat on V Mingle (VMingle). Connect with strangers worldwide in 1-on-1 WebRTC video conversations. Instant, private, and no signup needed.",
  canonical: "/video",
  keywords: [
    "random video chat",
    "video chat with strangers",
    "random video chat online",
    "meet strangers through video chat",
    "V Mingle video chat",
    "VMingle video chat",
    "free random video call",
    "talk to strangers video",
    "anonymous video chat",
    "WebRTC video chat",
  ],
});

export default function VideoPage() {
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Video Chat", url: "/video" },
  ]);

  const softwareSchema = getSoftwareApplicationSchema({
    name: "V Mingle Video Chat",
    applicationCategory: "CommunicationApplication",
    description:
      "V Mingle random video chat pairs you instantly with strangers around the world for 1-on-1 live WebRTC video conversations.",
  });

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />

      <ChatRoom initialMode="video" />
    </>
  );
}
