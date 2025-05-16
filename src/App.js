// App.js FINAL COMPLETO (visitas 👁️ + iconos por AVG + filtros + métricas + modal)
// --- BLOQUE 1 / 3 -----------------------------------------------------------
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  memo,
} from "react";
import * as XLSX from "xlsx";
import { Moon, Sun, X } from "lucide-react";

/* ────────── Helpers ────────── */
const isoToSec = (iso = "") => {
  const [, h = 0, m = 0, s = 0] =
    iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/) || [];
  return +h * 3600 + +m * 60 + +s;
};
const fmtDur = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(
    s % 60
  ).padStart(2, "0")}`;
const fmtDate = (d) =>
  `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${d.getFullYear()}`;
const vpdLabel = (v) =>
  v > 600000
    ? "✍️ Hacer guion"
    : v > 400000
    ? "🧠 TOP"
    : v > 200000
    ? "🔥 Muy Alta"
    : v > 100000
    ? "👍 Alta"
    : v > 50000
    ? "👌 Normal"
    : v > 20000
    ? "⚠️ Baja"
    : "❌ Horrible";
const labelColor = (t) =>
  t.includes("guion")
    ? "#d946ef"
    : t.includes("Muy Alta")
    ? "#f97316"
    : t.includes("Alta")
    ? "#facc15"
    : t.includes("Normal")
    ? "#3b82f6"
    : "#6b7280";
const impactIcon = (avg) =>
  avg > 400000
    ? "🚀"
    : avg > 250000
    ? "📈"
    : avg > 100000
    ? "➖"
    : avg > 50000
    ? "📉"
    : "❌";

/* ────────── Sheet loader ────────── */
const fetchSheet = async (url, cb) => {
  const res = await fetch(url);
  const blob = await res.blob();
  await new Promise((done) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: "binary" });
      cb(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
      done();
    };
    reader.readAsBinaryString(blob);
  });
};

/* ────────── Main component ────────── */
export default function App() {
  /* State */
  const [videos, setVideos] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [visible, setVisible] = useState(18);
  const [dark, setDark] = useState(
    () => localStorage.getItem("vi-dark") === "1"
  );
  const [kwFilter, setKW] = useState(null);
  const [typeFilter, setType] = useState("");
  const [durFilter, setDur] = useState("");
  const [dates, setDates] = useState({ start: "", end: "" });
  const [showKW, setShowKW] = useState(false);
  const loaderRef = useRef(null);

  /* Theme toggle */
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  /* Load data */
  useEffect(() => {
    fetchSheet(
      "https://phqqstrqsmmqlkwvnztr.supabase.co/storage/v1/object/public/video-insights/stats/youtube_rss_recent_videos.xlsx",
      (rows) => {
        const parsed = rows
          .map((r) => {
            const views = +`${r.views}`.replace(/\D/g, "") || 0;
            const likes = +`${r.likes}`.replace(/\D/g, "") || 0;
            const comments = +`${r.comments}`.replace(/\D/g, "") || 0;
            const sec = isoToSec(r.duration);
            const pub = new Date(r.publishedAt);
            const days = Math.max((Date.now() - pub) / 864e5, 1);
            const vpd = Math.round(views / days);
            const tag = vpdLabel(vpd);
            return {
              ...r,
              views,
              likes,
              comments,
              durationSec: sec,
              durationFmt: fmtDur(sec),
              publishedDate: pub,
              publishedFmt: fmtDate(pub),
              daysAgo: `${Math.floor(days)} días`,
              tag,
              tagColor: labelColor(tag),
            };
          })
          .filter((v) => v.durationSec > 60)
          .sort((a, b) => b.views - a.views);
        setVideos(parsed);
      }
    );
    fetchSheet(
      "https://phqqstrqsmmqlkwvnztr.supabase.co/storage/v1/object/public/video-insights/stats/tendencias_coloreadas_youtube.xlsx",
      (rows) => {
        setKeywords(
          rows
            .map((k) => ({
              keyword: k.palabra_clave || "",
              uses: +k.apariciones || 0,
              avg: +k.media_visitas || 0,
            }))
            .sort((a, b) => b.avg - a.avg)
            .slice(0, 100)
        );
      }
    );
  }, []);
  /* Infinite scroll */
  useEffect(() => {
    const obs = new IntersectionObserver((e) => {
      if (e[0].isIntersecting) setVisible((c) => c + 18);
    });
    if (loaderRef.current) obs.observe(loaderRef.current);
    return () =>
      loaderRef.current && obs.unobserve(loaderRef.current);
  }, []);

  /* Reset paginado al cambiar filtros */
  useEffect(() => setVisible(18), [
    typeFilter,
    kwFilter,
    durFilter,
    dates,
  ]);

  /* Filtering */
  const filtered = useMemo(() => {
    return videos
      .filter(
        (v) =>
          !kwFilter ||
          v.title.toLowerCase().includes(kwFilter.toLowerCase())
      )
      .filter((v) => {
        if (typeFilter === "popular")
          return ["✍️ Hacer guion", "🧠 TOP"].includes(v.tag);
        if (typeFilter === "hornstromp")
          return [
            "UCaCoS1ylN81PAgotBDyKgug",
            "UCpRx8BFSkdVx8MAW8unaJcw",
          ].includes(v.channelId);
        return true;
      })
      .filter((v) => {
        if (durFilter === "short") return v.durationSec < 60;
        if (durFilter === "medium")
          return v.durationSec >= 60 && v.durationSec <= 600;
        if (durFilter === "long") return v.durationSec > 600;
        return true;
      })
      .filter((v) => {
        if (dates.start && new Date(v.publishedDate) < new Date(dates.start))
          return false;
        if (dates.end && new Date(v.publishedDate) > new Date(dates.end))
          return false;
        return true;
      })
      .sort((a, b) => {
        if (typeFilter === "likes") return b.likes - a.likes;
        if (typeFilter === "comments") return b.comments - a.comments;
        if (typeFilter === "recent") return b.publishedDate - a.publishedDate;
        return 0;
      });
  }, [videos, kwFilter, typeFilter, durFilter, dates]);

  /* Metrics */
  const totalViews = useMemo(
    () => filtered.reduce((s, v) => s + v.views, 0),
    [filtered]
  );
  const avgVPD = useMemo(
    () =>
      filtered.length ? Math.round(totalViews / filtered.length) : 0,
    [filtered, totalViews]
  );
  const veryHigh = filtered.filter((v) => v.tag.includes("guion")).length;
  const shown = filtered.slice(0, visible);

  /* Video card */
  const VideoCard = memo(({ v }) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow hover:shadow-xl transition hover:-translate-y-1 flex flex-col overflow-hidden">
      <div className="relative">
        <a
          href={`https://youtu.be/${v.videoId}`}
          target="_blank"
          rel="noreferrer"
        >
          <img
            src={`https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`}
            alt={v.title}
            className="w-full aspect-video object-cover"
            loading="lazy"
          />
          <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[11px] font-semibold px-1.5 rounded">
            {v.durationFmt}
          </span>
        </a>
      </div>
      <div className="p-3 flex-1 flex flex-col gap-1">
        <h3 className="text-center text-sm font-semibold line-clamp-2 dark:text-slate-100">
          {v.title}
        </h3>
        <p className="text-center text-2xl font-extrabold text-rose-600 dark:text-rose-400">
          👁️ {v.views.toLocaleString()} visitas
        </p>
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          {v.likes.toLocaleString()} likes ·{" "}
          {v.comments.toLocaleString()} comentarios
        </p>
        <div className="flex justify-between text-[11px] text-gray-400 mt-auto">
          <span>{v.publishedFmt}</span>
          <span className="text-purple-600 dark:text-purple-400 font-semibold">
            {v.daysAgo}
          </span>
        </div>
      </div>
      <div
        style={{ backgroundColor: v.tagColor }}
        className="text-white text-center text-xs py-1 font-semibold"
      >
        {v.tag}
      </div>
    </div>
  ));
  /* Render */
  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {/* ───── CABECERA ───── */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-slate-100 dark:bg-slate-900 shadow sticky top-0 z-30">
        <h1 className="text-lg sm:text-2xl font-extrabold flex items-center gap-2">
          📊 Video Insights
        </h1>
        <div className="flex gap-2 items-center">
          {kwFilter && (
            <button
              onClick={() => setKW(null)}
              className="text-xs bg-red-100 dark:bg-red-800 text-red-700 dark:text-white px-2 py-1 rounded flex items-center gap-1"
            >
              <X size={14} /> Borrar filtro
            </button>
          )}
          <button
            onClick={() =>
              setDark((d) => {
                localStorage.setItem("vi-dark", d ? "0" : "1");
                return !d;
              })
            }
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* ───── FILTROS PRINCIPALES ───── */}
      <div className="flex flex-wrap gap-2 justify-center items-center p-2">
        {[
          { id: "", label: "🔄 Todos", bg: "bg-slate-200 dark:bg-slate-700" },
          { id: "popular", label: "🏆 Populares", bg: "bg-yellow-300" },
          { id: "hornstromp", label: "🎮 Hornstromp", bg: "bg-pink-300" },
          { id: "likes", label: "❤️ Likes", bg: "bg-emerald-300" },
          { id: "comments", label: "💬 Comentarios", bg: "bg-blue-300" },
          { id: "recent", label: "🆕 Recientes", bg: "bg-sky-300" },
        ].map((b) => (
          <button
            key={b.id || "all"}
            onClick={() => setType(b.id)}
            className={`px-2 py-1 rounded text-xs ${b.bg} ${
