import Anthropic from "@anthropic-ai/sdk";
import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

type GenerateRequest = {
  password: string;
  images: string[];
  measurements: string;
};

type GenerateResponse = {
  productName: string;
  description: string;
};

const SYSTEM_PROMPT = `あなたはメルカリで古着を販売するプロのセラーアシスタントです。
商品写真（複数枚）と実寸情報をもとに、メルカリにそのまま貼れる「商品名」と「説明文」をJSON形式で生成します。

## 出力形式（このJSONだけを返す。前後に説明文・コードブロックは不要）
{
  "productName": "商品名（40文字以内）",
  "description": "説明文（下記フォーマット厳守）"
}

## 商品名のルール
- 必ず40文字以内にする
- ブランド名・アイテム種別・色・柄・特徴的なキーワードを優先的に含める
- メルカリで検索されやすい言葉を選ぶ（ヴィンテージ・古着・USA製 などは有効）

## 説明文のフォーマット（この順番・内容を一字一句変えずに守ること）

ご覧いただきありがとうございます！
即購入大歓迎です◎

値引き交渉、フォロー割も実施しております。ご質問等ありましたらコメント欄へお願いいたします(^^)
#古着屋36 ←他にも多数出品しておりますので、ご覧ください‼️

（ここに魅力ポイントを✅で始まる箇条書きで3〜5個記載）
✅ 〜

（ここにサイズ情報を記載。例:）
着丈：65cm
身幅：52cm
袖丈：60cm
（写真からもユーザー入力からも確認できない実寸は [着丈〇〇cm] のようなプレースホルダーで返す）
※素人採寸のため、多少の誤差はご了承ください。

大項目: （ジャンル: アメカジ / Y2K / スポーツウェア / フォーマル / ストリート 等から選ぶ）
中項目: （種類: フーディー / ニット / ジャケット / デニムパンツ 等から選ぶ）
小項目: （デザイン・柄・状態の詳細）
（検索キーワードを半角スペース区切りで並べる。#は使わない）

## 重要な制約
- 写真から確認できないブランド名・素材・年代などを推測で書かない
- サイズ数値は提供されたものだけを使い、不明なものは [〇〇cm] で返す
- 丁寧で誠実なトーン（購入者が安心できる文体）を保つ
- JSONのみを出力し、\`\`\`json などのコードブロックは使わない`;

function verifyPassword(input: string): boolean {
  const expected = process.env.ACCESS_PASSWORD ?? "";
  if (expected === "") return false;
  if (input.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(input, "utf-8"), Buffer.from(expected, "utf-8"));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const expected = process.env.ACCESS_PASSWORD ?? "";
  if (expected === "") {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!verifyPassword(body.password ?? "")) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  if (!body.images || body.images.length === 0) {
    return NextResponse.json({ error: "画像を1枚以上選択してください" }, { status: 400 });
  }
  if (body.images.length > 5) {
    return NextResponse.json({ error: "画像は最大5枚までです" }, { status: 400 });
  }

  const imageBlocks = body.images.map((dataUrl: string) => {
    const [header, data] = dataUrl.split(",");
    const mediaType = (header.match(/data:(.*);base64/)?.[1] ?? "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";
    return {
      type: "image" as const,
      source: { type: "base64" as const, media_type: mediaType, data },
    };
  });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let message;
  try {
    message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            {
              type: "text",
              text: `実寸情報：${body.measurements?.trim() || "入力なし"}`,
            },
          ],
        },
      ],
    });
  } catch (e) {
    console.error("Claude API error:", e);
    return NextResponse.json(
      { error: "生成に失敗しました。もう一度お試しください。" },
      { status: 500 }
    );
  }

  const rawText = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json(
      { error: "生成結果の解析に失敗しました。もう一度お試しください。" },
      { status: 500 }
    );
  }

  try {
    const result: GenerateResponse = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "生成結果の解析に失敗しました。もう一度お試しください。" },
      { status: 500 }
    );
  }
}
