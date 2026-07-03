"use client";

import { useRef, useState } from "react";

type GenerateResponse = {
  productName: string;
  description: string;
};

// ---- パスワードゲート ----
function PasswordGate({
  onAuth,
}: {
  onAuth: (password: string) => void;
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) {
      setError("パスワードを入力してください");
      return;
    }
    setLoading(true);
    setError("");
    // 画像なしで送信して認証だけ確認
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: input, images: [], measurements: "" }),
    });
    setLoading(false);
    if (res.status === 401) {
      setError("パスワードが違います");
    } else {
      // 400（画像なし）や 500 でも認証は通っているので解除
      onAuth(input);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-gray-800 mb-2 text-center">
          メルカリ出品アシスタント
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          パスワードを入力してください
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="パスワード"
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg py-3 text-base transition-colors"
          >
            {loading ? "確認中..." : "入る"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---- スピナー ----
function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ---- コピーボタン ----
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-1.5 transition-colors"
    >
      {copied ? "コピー済 ✓" : "コピー"}
    </button>
  );
}

// ---- メイン画面 ----
export default function Home() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 入力
  const [previews, setPreviews] = useState<string[]>([]);
  const [measurements, setMeasurements] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 生成状態
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 生成結果
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [hasResult, setHasResult] = useState(false);

  const handleAuth = (pw: string) => {
    setPassword(pw);
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <PasswordGate onAuth={handleAuth} />;
  }

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const remaining = 5 - previews.length;
    if (remaining <= 0) return;
    const newFiles = Array.from(files).slice(0, remaining);

    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index: number) => {
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, images: previews, measurements }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "生成に失敗しました");
      }
      const result = data as GenerateResponse;
      setProductName(result.productName);
      setDescription(result.description);
      setHasResult(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "予期しないエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  const charCount = productName.length;
  const isOverLimit = charCount > 40;

  return (
    <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-800 text-center">
        メルカリ出品アシスタント
      </h1>

      {/* 画像アップロード */}
      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        <p className="font-semibold text-gray-700">商品写真（最大5枚）</p>

        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {previews.map((src, i) => (
              <div key={i} className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`商品写真 ${i + 1}`}
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  onClick={() => handleRemoveImage(i)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {previews.length < 5 && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl py-6 text-gray-500 text-sm hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              タップして写真を選ぶ
              <br />
              <span className="text-xs">({previews.length}/5枚)</span>
            </button>
          </>
        )}
      </div>

      {/* 実寸入力 */}
      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-2">
        <p className="font-semibold text-gray-700">実寸</p>
        <textarea
          value={measurements}
          onChange={(e) => setMeasurements(e.target.value)}
          placeholder="例：着丈65cm 身幅52cm 袖丈60cm"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 作成ボタン */}
      <button
        onClick={handleGenerate}
        disabled={isLoading || previews.length === 0}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl py-4 text-base transition-colors"
      >
        {isLoading ? (
          <>
            <Spinner />
            生成中...
          </>
        ) : (
          "作成する"
        )}
      </button>

      {/* エラー */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-2">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={handleGenerate}
            className="text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-lg px-4 py-2 transition-colors"
          >
            もう一度
          </button>
        </div>
      )}

      {/* 生成結果 */}
      {hasResult && (
        <div className="space-y-4">
          {/* 商品名 */}
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-700">商品名</p>
              <CopyButton text={productName} />
            </div>
            <textarea
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p
              className={`text-sm text-right ${
                isOverLimit ? "text-red-500 font-bold" : "text-gray-400"
              }`}
            >
              {charCount}/40{isOverLimit && " ⚠️ 40文字を超えています"}
            </p>
          </div>

          {/* 説明文 */}
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-700">説明文</p>
              <CopyButton text={description} />
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={14}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
    </main>
  );
}
