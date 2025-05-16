// App.js con scroll infinito activado
import React, { useState, useMemo, useEffect, memo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { Moon, Sun, X } from "lucide-react";

export default function App() {
  const [videos, setVideos] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [visibleCount, setVisibleCount] = useState(18);
  const [dark, setDark] = useState(() => localStorage.getItem("vi-dark") === "1");
  const [keywordFilter, setKeywordFilter] = useState(null);
  const [showKeywords, setShowKeywords] = useState(false);
  const loaderRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    loadVideos();
    loadKeywords();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount((prev) => prev + 18);
      }
    });
    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }
    return () => {
      if (loaderRef.current) observer.unobserve(loaderRef.current);
    };
  }, []);

  const isoToSec = (iso = "") => {
    const [, m = 0, s = 0] = iso.match(/PT(?:(\d+)M)?(?:(\d+)S)?/) || [];
    return +m * 60 + +s;
  };

  const fmtDur = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const fmtDate = (d) => `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
  const labelFromVPD = (vpd) => vpd > 400000 ? "🧠 Hay que hacer guion" : vpd > 200000 ? "🔥 Muy Alta" : vpd > 100000 ? "👍 Alta" : vpd > 50000 ? "👌 Normal" : "⚠️ Baja";
  const colorFromLabel = (t) => t.includes("guion") ? "#d946ef" : t.includes("Muy Alta") ? "#f97316" : t.includes("Alta") ? "#facc15" : t.includes("Normal") ? "#3b82f6" : "#6b7280";

  const readRemoteSheet = async (url, callback) => {
    const res = await fetch(url);
    const blob = await res.blob();
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      callback(XLSX.utils.sheet_to_json(ws));
    };
    reader.readAsBinaryString(blob);
  };

  const loadVideos = () => {
    readRemoteSheet("https://video-insights-backend.onrender.com/data/youtube_rss_recent_videos.xlsx", (raw) => {
      const list = raw
        .map((v) => {
          const views = +(`${v.views}`.replace(/\D/g, "") || 0);
          const likes = +(`${v.likes}`.replace(/\D/g, "") || 0);
          const comments = +(`${v.comments}`.replace(/\D/g, "") || 0);
          const sec = isoToSec(v.duration);
          const pub = new Date(v.publishedAt);
          const days = Math.max((Date.now() - pub) / 864e5, 1);
          const vpd = Math.round(views / days);
          const tag = labelFromVPD(vpd);
          return {
            ...v,
            views,
            likes,
            comments,
            durationFmt: fmtDur(sec),
            durationSec: sec,
            publishedFmt: fmtDate(pub),
            daysAgo: `${Math.floor(days)} días`,
            tag,
            tagColor: colorFromLabel(tag),
          };
        })
        .filter((v) => v.durationSec > 60)
        .sort((a, b) => b.views - a.views);
      setVideos(list);
    });
  };

  const loadKeywords = () => {
    readRemoteSheet("https://video-insights-backend.onrender.com/data/tendencias_coloreadas_youtube.xlsx", (raw) => {
      const list = raw
        .map((k) => {
          const palabra = k["palabra_clave"] || "";
          const apariciones = +k["apariciones"] || 0;
          const media = +k["media_visitas"] || 0;
          return {
            keyword: palabra,
            uses: apariciones,
            avg: media,
            impacto: media * apariciones,
          };
        })
        .sort((a, b) => b.impacto - a.impacto)
        .slice(0, 100);
      setKeywords(list);
    });
  };

  const filteredVideos = keywordFilter
    ? videos.filter((v) => v.title.toLowerCase().includes(keywordFilter.toLowerCase()))
    : videos;

  const totalViews = useMemo(() => filteredVideos.reduce((s, v) => s + v.views, 0), [filteredVideos]);
  const avgVPD = useMemo(() => (filteredVideos.length ? Math.round(totalViews / filteredVideos.length) : 0), [filteredVideos, totalViews]);
  const shown = filteredVideos.slice(0, visibleCount);
  const hiScore = filteredVideos.filter((v) => v.tag.includes("guion")).length;

  const StatBox = ({ label, value }) => (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-2 shadow-sm flex flex-col gap-0.5 text-center w-28 sm:w-32">
      <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wide text-[10px]">{label}</span>
      <span className="text-sm font-bold whitespace-nowrap">{value}</span>
    </div>
  );

  const VideoCard = memo(({ v }) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow hover:shadow-xl transition hover:-translate-y-1 flex flex-col overflow-hidden">
      <div className="relative">
        <a href={`https://youtu.be/${v.videoId}`} target="_blank" rel="noreferrer">
          <img src={`https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`} alt={v.title} className="w-full aspect-video object-cover" loading="lazy" />
          <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[11px] font-semibold px-1.5 rounded">{v.durationFmt}</span>
        </a>
      </div>
      <div className="p-3 flex-1 flex flex-col gap-1">
        <h3 className="text-center text-sm font-semibold line-clamp-2 dark:text-slate-100">{v.title}</h3>
        <p className="text-center text-xl font-extrabold text-green-600 dark:text-green-400">{v.views.toLocaleString()} visitas</p>
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">{v.likes.toLocaleString()} likes · {v.comments.toLocaleString()} comentarios</p>
        <div className="flex justify-between text-[11px] text-gray-400 mt-auto">
          <span>{v.publishedFmt}</span>
          <span className="text-purple-600 dark:text-purple-400 font-semibold">{v.daysAgo}</span>
        </div>
      </div>
      <div style={{ backgroundColor: v.tagColor }} className="text-white text-center text-xs py-1 font-semibold">{v.tag}</div>
    </div>
  ));

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-slate-100 dark:bg-slate-900 shadow sticky top-0 z-30">
        <h1 className="text-lg sm:text-2xl font-extrabold flex items-center gap-2">📊 Video Insights</h1>
        <div className="flex gap-2 items-center">
          {keywordFilter && (
            <button onClick={() => setKeywordFilter(null)} className="text-xs bg-red-100 dark:bg-red-800 text-red-700 dark:text-white px-2 py-1 rounded flex items-center gap-1">
              <X size={14} /> Borrar filtro
            </button>
          )}
          <button
            onClick={() => {
              setDark((d) => {
                localStorage.setItem("vi-dark", d ? "0" : "1");
                return !d;
              });
            }}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <section className="flex flex-wrap gap-4 px-4 py-4 justify-center bg-slate-50 dark:bg-slate-800">
        <StatBox label="Videos" value={filteredVideos.length} />
        <StatBox label="Visitas totales" value={totalViews.toLocaleString()} />
        <StatBox label="Visitas/día prom" value={avgVPD.toLocaleString()} />
        <StatBox label="Muy altas / Guion" value={hiScore} />
      </section>

      <main className="w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 pb-16">
        {shown.map((v) => (<VideoCard key={v.videoId} v={v} />))}
      </main>

      <div ref={loaderRef} className="h-10"></div>

      <button
        onClick={() => setShowKeywords(true)}
        className="fixed bottom-4 right-4 z-50 bg-purple-600 text-white w-14 h-14 text-xl rounded-full shadow-xl hover:bg-purple-700 flex items-center justify-center"
        🔑
      </button>
    </div>
  );
}
