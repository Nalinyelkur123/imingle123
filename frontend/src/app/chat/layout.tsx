import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat Session",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
