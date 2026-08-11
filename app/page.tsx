import type { Metadata } from "next";
import LedgerApp from "./ledger-app";

export const metadata: Metadata = {
  title: "Cola · 可乐小宝的小账本",
  description: "为可乐——我们爱叫的小宝——收藏生活、记录每一笔的小小家庭账本。",
};

export default function Home() {
  return <LedgerApp />;
}
