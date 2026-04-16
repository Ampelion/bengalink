import { useState, useRef } from "react";


const BENGAL = "https://bengal-fetch.ampelion.workers.dev/?url=";

async function bengalFetch(url) {
  const res = await fetch(BENGAL + encodeURIComponent(url));
  if (!res.ok) throw new Error(`bengal-fetch returned ${res.status}`);
  return res.text();
}

function extractLinks(html, sourceUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const seen = new Set();
  const links = [];
  const sourceDomain = new URL(sourceUrl).hostname.replace(/^www\./, "");

  const NAV_WORDS = new Set([
    "home", "about", "contact", "subscribe", "login", "register",
    "tweet", "share", "facebook", "twitter", "instagram", "email",
    "next", "previous", "back", "more", "read more", "click here",
    "donate", "patreon", "newsletter", "rss", "feed", "search",
    "archive", "tag", "category", "author", "edit",
  ]);

  const container = doc.querySelector(".entry-content, article, main, #content");
  if (!container) return links;
  const anchors = Array.from(container.querySelectorAll("a[href]"));

  anchors.forEach((a) => {
    const href = a.getAttribute("href");
    const text = a.textContent.trim().replace(/\s+/g, " ");
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
    if (!text || text.length < 2) return;
    if (NAV_WORDS.has(text.toLowerCase())) return;

    let abs;
    try { abs = new URL(href, sourceUrl).href; } catch { return; }

    let domain;
    try { domain = new URL(abs).hostname.replace(/^www\./, ""); } catch { return; }

    if (new URL(abs).hostname.replace(/^www\./, "") === sourceDomain) return;
    const key = abs + "||" + text;
    if (seen.has(key)) return;
    seen.add(key);

    links.push({
      id: key,
      href: abs,
      text: text.length > 80 ? text.slice(0, 77) + "…" : text,
      domain,
      status: "loading",
      ogImage: null,
    });
  });

  return links;
}

async function fetchOgMeta(url) {
  try {
    const html = await bengalFetch(url);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const ogImage =
      doc.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
      doc.querySelector('meta[name="twitter:image"]')?.getAttribute("content") ||
      null;
    const ogTitle =
      doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
      doc.querySelector("title")?.textContent || null;
    return { ogImage, ogTitle };
  } catch {
    return { ogImage: null, ogTitle: null };
  }
}

function textPalette(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash);
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 42 + (Math.abs(hash >> 4) % 30)) % 360;
  const h3 = (h2 + 35 + (Math.abs(hash >> 6) % 25)) % 360;
  const s = 30 + (Math.abs(hash >> 8) % 20);
  const l1 = 45 + (Math.abs(hash >> 12) % 15);
  const l2 = 38 + (Math.abs(hash >> 16) % 15);
  const l3 = 42 + (Math.abs(hash >> 20) % 15);
  return {
    a: `hsl(${h1}, ${s}%, ${l1}%)`,
    b: `hsl(${h2}, ${s - 5}%, ${l2}%)`,
    c: `hsl(${h3}, ${s - 2}%, ${l3}%)`,
    text: `hsl(${h1}, ${Math.max(s - 15, 10)}%, 88%)`,
  };
}

function SkeletonCard() {
  return (
    <div style={{
      background: "#f5f1eb", borderRadius: "8px", overflow: "hidden",
      height: "220px", animation: "pulse 1.4s ease-in-out infinite",
    }}>
      <div style={{ height: "130px", background: "#e8e3da" }} />
      <div style={{ padding: "12px" }}>
        <div style={{ height: "10px", background: "#e8e3da", borderRadius: "4px", marginBottom: "8px", width: "80%" }} />
        <div style={{ height: "8px", background: "#e8e3da", borderRadius: "4px", width: "50%" }} />
      </div>
    </div>
  );
}

function LinkCard({ link, visited, onVisit }) {
  const isVisited = visited.has(link.href);
  const palette = textPalette(link.text);

  return (
    <a href={link.href} target="_blank" rel="noopener noreferrer"
      onClick={() => onVisit(link.href)}
      style={{
        display: "block", textDecoration: "none", borderRadius: "8px",
        overflow: "hidden", background: "#faf7f2", border: "1px solid #e8e2d8",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        opacity: isVisited ? 0.55 : 1, cursor: "pointer",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.12)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {link.ogImage ? (
        <img src={link.ogImage} alt="" style={{ width: "100%", height: "130px", objectFit: "cover", display: "block" }}
          onError={e => { e.target.style.display = "none"; }} />
      ) : (
        <div style={{
          height: "130px", position: "relative", overflow: "hidden",
          background: `linear-gradient(135deg, ${palette.a} 0%, ${palette.b} 55%, ${palette.c} 100%)`,
        }}>
          {/* watermark letter */}
          <span style={{
            position: "absolute", bottom: "-7.5px", right: "-4px",
            fontFamily: "'Playfair Display', serif", fontSize: "96px",
            color: "rgba(255,255,255,0.12)", fontWeight: "600",
            lineHeight: 1, userSelect: "none", pointerEvents: "none",
          }}>
            {link.domain[0].toUpperCase()}
          </span>
        </div>
      )}
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: "8.5px",
          color: palette.a, letterSpacing: "0.08em", textTransform: "uppercase",
          marginBottom: "4px", fontWeight: "400",
        }}>{link.domain}</div>
        <div style={{
          fontFamily: "'Playfair Display', serif", fontSize: "12.5px",
          color: "#2a2520", lineHeight: "1.45", fontStyle: "italic",
        }}>{link.text}</div>
      </div>
    </a>
  );
}

export default function App() {
  const [url, setUrl] = useState("");
  const [links, setLinks] = useState([]);
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [visited, setVisited] = useState(new Set());
  const abortRef = useRef(false);

  function handleVisit(href) {
    setVisited(prev => new Set([...prev, href]));
  }

  async function handleParse() {
    if (!url.trim()) return;
    abortRef.current = false;
    setLinks([]);
    setProgress(0);
    setPhase("fetching");

    let html;
    try {
      html = await bengalFetch(url.trim());
    } catch (e) {
      setPhase("idle");
      alert("Could not fetch that URL.");
      return;
    }

    const extracted = extractLinks(html, url.trim());
    if (!extracted.length) { setPhase("idle"); return; }

    setLinks(extracted);
    setPhase("running");

    const ogQueue = [...extracted];
    let done = 0;

    async function worker() {
      while (ogQueue.length && !abortRef.current) {
        const link = ogQueue.shift();
        const meta = await fetchOgMeta(link.href);
        done++;
        setProgress(Math.round((done / extracted.length) * 100));
        setLinks(prev => prev.map(l =>
          l.id === link.id
            ? { ...l, ogImage: meta.ogImage, ogTitle: meta.ogTitle, status: "done" }
            : l
        ));
      }
    }

    await Promise.all(Array.from({ length: 8 }, worker));

    setProgress(100);
    setPhase("done");
  }

  return (
    <>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f0ece4; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #e8e3da; }
        ::-webkit-scrollbar-thumb { background: #c4bfb5; border-radius: 3px; }
      `}</style>

      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(240,236,228,0.92)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid #ddd8ce", padding: "18px 40px",
        display: "flex", alignItems: "center", gap: "16px",
      }}>
        <div style={{
          fontFamily: "'Playfair Display', serif", fontSize: "13px",
          fontStyle: "italic", color: "#7a7060", whiteSpace: "nowrap", letterSpacing: "0.02em",
        }}>essay companion</div>

        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleParse()}
          placeholder="paste an essay URL…"
          style={{
            flex: 1, background: "transparent", border: "none",
            borderBottom: "1px solid #c4bfb5", outline: "none",
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px",
            color: "#3a3530", padding: "4px 0", letterSpacing: "0.04em",
          }}
        />

        <button
          onClick={handleParse}
          disabled={phase === "fetching" || phase === "running"}
          style={{
            background: (phase === "fetching" || phase === "running") ? "#c4bfb5" : "#3a3530",
            color: "#f0ece4", border: "none", borderRadius: "4px",
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px",
            letterSpacing: "0.12em", padding: "7px 16px", cursor: "pointer",
            textTransform: "uppercase", whiteSpace: "nowrap",
          }}
        >
          {phase === "fetching" ? "fetching…" : phase === "running" ? `${progress}%` : "parse"}
        </button>
      </div>

      {(phase === "running" || phase === "fetching") && (
        <div style={{ height: "2px", background: "#e8e3da" }}>
          <div style={{
            height: "100%", background: "#8b7355",
            width: `${progress}%`, transition: "width 0.3s ease",
          }} />
        </div>
      )}

      <div style={{ padding: "40px", maxWidth: "1400px", margin: "0 auto" }}>
        {links.length === 0 && phase === "idle" ? (
          <div style={{
            paddingTop: "100px", textAlign: "center",
            fontFamily: "'Playfair Display', serif", fontStyle: "italic",
            fontSize: "15px", color: "#b0a898",
          }}>
            paste an essay URL and press parse
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "36px 22px" }}>
            {links.map(link =>
              link.status === "loading"
                ? <SkeletonCard key={link.id} />
                : <LinkCard key={link.id} link={link} visited={visited} onVisit={handleVisit} />
            )}
          </div>
        )}

        {phase === "done" && links.length > 0 && (
          <div style={{
            marginTop: "48px", textAlign: "center",
            fontFamily: "'IBM Plex Mono', monospace", fontWeight: "300",
            fontSize: "10px", letterSpacing: "0.12em", color: "#b0a898", textTransform: "uppercase",
          }}>
            {links.length} links · {links.filter(l => l.ogImage).length} with thumbnails
          </div>
        )}
      </div>
    </>
  );
}
