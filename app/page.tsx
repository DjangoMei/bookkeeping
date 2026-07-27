import type { Metadata } from "next";
import LedgerApp from "./ledger-app";

export const metadata: Metadata = {
  title: "家账 · 家庭账本",
  description: "zcy 与 Django 共同维护、各自独立的家庭记账空间。",
};

export default function Home() {
  return <LedgerApp />;
}
