import { Metadata } from "next";
import { ChatRoom } from "@/components/ChatRoom";
import {
  constructMetadata,
  getSoftwareApplicationSchema,
  getBreadcrumbSchema,
} from "@/config/site";

export const metadata: Metadata = constructMetadata({
  title: "Random Text Chat With Strangers",
  description:
    "Chat anonymously with random strangers on V Mingle (VMingle). Fast, free, lightweight online text chat with interest tags. No login, no profile, 100% private.",
  canonical: "/text",
  keywords: [
    "random text chat",
    "text chat with strangers",
    "anonymous text chat",
    "random chat online",
    "V Mingle text chat",
    "VMingle text chat",
    "chat with strangers online",
    "free text chat",
    "talk to strangers online",
    "stranger chat without video",
  ],
});

export default function TextPage() {
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Text Chat", url: "/text" },
  ]);

  const softwareSchema = getSoftwareApplicationSchema({
    name: "V Mingle Text Chat",
    applicationCategory: "CommunicationApplication",
    description:
      "V Mingle anonymous text chat connects you instantly with strangers worldwide for lightweight, fast 1-on-1 typing conversations.",
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

      <ChatRoom initialMode="text" />
    </>
  );
}
