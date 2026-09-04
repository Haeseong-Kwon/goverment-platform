"use client";

/**
 * 루트 레이아웃 자체가 실패한 경우의 마지막 그물.
 * error.tsx는 레이아웃 밖의 오류를 잡지 못하고, 이 화면은 레이아웃을 대체하므로
 * html·body를 직접 그리고 공용 컴포넌트에 의존하지 않습니다.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F8FAFC", color: "#0F172A" }}>
        <main style={{ display: "grid", minHeight: "100vh", placeItems: "center", padding: "20px" }}>
          <div style={{ maxWidth: "420px", width: "100%", background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "32px", textAlign: "center" }}>
            <h1 style={{ margin: 0, fontSize: "22px" }}>앱을 불러오지 못했습니다</h1>
            <p style={{ marginTop: "12px", fontSize: "14px", lineHeight: 1.7, color: "#475569" }}>
              페이지를 새로 고쳐 주세요. 계속 같은 화면이 나오면 담당자에게 아래 코드를 알려주세요.
            </p>
            {/* digest는 서버 오류에만 붙습니다. 없을 때 메시지라도 보여야 문의가 추적됩니다. */}
            {(error.digest || error.message) && (
              <p style={{ marginTop: "12px", background: "#F8FAFC", borderRadius: "8px", padding: "8px 12px", fontFamily: "monospace", fontSize: "12px", color: "#475569", textAlign: "left", wordBreak: "break-word" }}>
                {error.digest ?? error.message.slice(0, 200)}
              </p>
            )}
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: "24px", height: "44px", padding: "0 20px", borderRadius: "12px", border: "none", background: "#2563EB", color: "#fff", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
            >
              다시 시도
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
