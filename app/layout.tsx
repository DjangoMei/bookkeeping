import type { Metadata } from "next";
import { headers } from "next/headers";
import { withBasePath } from "./base-path";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const metadataBase = new URL(`${protocol}://${host}`);
  const imageUrl = new URL(withBasePath("/og.png"), metadataBase).toString();

  return {
    metadataBase,
    title: {
      default: "Cola · 可乐小宝的小账本",
      template: "%s · Cola",
    },
    description: "为可乐——我们爱叫的小宝——收藏生活、记录每一笔的小小家庭账本。",
    icons: { icon: withBasePath("/mascot-cutouts/00-character-base.webp") },
    openGraph: {
      title: "Cola · 可乐小宝的小账本",
      description: "认真生活，开心花钱，把每一天收进小本本。",
      images: [{ url: imageUrl, width: 1536, height: 1024, alt: "Cola 可乐小宝的小账本" }],
      locale: "zh_CN",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Cola · 可乐小宝的小账本",
      description: "认真生活，开心花钱，把每一天收进小本本。",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
