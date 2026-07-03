import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "メルカリ出品アシスタント",
  description: "商品写真と実寸から商品名・説明文を自動生成",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
