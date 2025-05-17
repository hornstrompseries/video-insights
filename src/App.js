// App.js FINAL UNIFICADO (con todos los filtros, scroll infinito, keywords con leyenda e iconos, y diseño completo)
import React, { useState, useMemo, useEffect, memo, useRef } from "react";
import * as XLSX from "xlsx";
import { Moon, Sun, X } from "lucide-react";

export default function App() {
  const [videos, setVideos] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [visibleCount, setVisibleCount] = useState(18);
  const [dark, setDark] = useState(() => localStorage.getItem("vi-dark") === "1");
  const [keywordFilter, setKeywordFilter] = useState(null);
  const [filterType, setFilterType] = useState("");
  const [durationFilter, setDurationFilter] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
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
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => loaderRef.current && observer.unobserve(loaderRef.current);
  }, []);

  useEffect(() => {
    setVisibleCount(18);
  }, [filterType, keywordFilter, durationFilter, dateRange]);

  const isoToSec = (iso = "") => {
    const [, h = 0, m = 0, s = 0] = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/) || [];
    return +h * 3600 + +m * 60 + +s;
  };
  const fmtDur = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const fmtDate = (d) => `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
  const labelFromVPD = (vpd) => vpd > 600000 ? "✍️ Hacer guion" : vpd > 400000 ? "🧠 TOP" : vpd > 200000 ? "🔥 Muy Alta" : vpd > 100000 ? "👍 Alta" : vpd > 50000 ? "👌 Normal" : vpd > 20000 ? "⚠️ Baja" : "❌ Horrible";
  const colorFromLabel = (t) => t.includes("guion") ? "#d946ef" : t.includes("Muy Alta") ? "#f97316" : t.includes("Alta") ? "#facc15" : t.includes("Normal") ? "#3b82f6" : "#6b7280";

  const readRemoteSheet = async (url, callback) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("❌ No se pudo descargar el archivo Excel");
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        callback(XLSX.utils.sheet_to_json(ws));
      };
      reader.readAsBinaryString(blob);
    } catch (err) {
      console.error("⚠️ Error al cargar Excel:", err);
    }
  };

  const loadVideos = () => {
    readRemoteSheet("https://phqqstrqsmmqlkwvnztr.supabase.co/storage/v1/object/public/video-insights/stats/youtube_rss_recent_videos.xlsx", (raw) => {
      const list = raw.map((v) => {
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
          publishedDate: pub,
          daysAgo: `${Math.floor(days)} días`,
          tag,
          tagColor: colorFromLabel(tag),
        };
      }).sort((a, b) => b.views - a.views);
      setVideos(list.filter((v) => v.durationSec > 60));
    });
  };

  const loadKeywords = () => {
    readRemoteSheet("https://phqqstrqsmmqlkwvnztr.supabase.co/storage/v1/object/public/video-insights/stats/tendencias_coloreadas_youtube.xlsx", (raw) => {
      const list = raw.map((k) => {
        const palabra = k["palabra_clave"] || "";
        const apariciones = +k["apariciones"] || 0;
        const media = +k["media_visitas"] || 0;
        return {
          keyword: palabra,
          uses: apariciones,
          avg: media,
          impacto: media * apariciones,
        };
      }).sort((a, b) => b.impacto - a.impacto).slice(0, 100);
      setKeywords(list);
    });
  };

  const filteredVideos = videos
    .filter((v) => {
      if (keywordFilter && !v.title.toLowerCase().includes(keywordFilter.toLowerCase())) return false;
      if (filterType === "popular") return ["✍️ Hacer guion", "🧠 TOP"].includes(v.tag);
      if (filterType === "hornstromp") return ["UCaCoS1ylN81PAgotBDyKgug", "UCpRx8BFSkdVx8MAW8unaJcw"].includes(v.channelId);
      return true;
    })
    .filter((v) => {
      if (durationFilter === "short") return v.durationSec < 60;
      if (durationFilter === "medium") return v.durationSec >= 60 && v.durationSec <= 600;
      if (durationFilter === "long") return v.durationSec > 600;
      return true;
    })
    .filter((v) => {
      if (dateRange.start && new Date(v.publishedDate) < new Date(dateRange.start)) return false;
      if (dateRange.end && new Date(v.publishedDate) > new Date(dateRange.end)) return false;
      return true;
    })
    .sort((a, b) => {
      if (filterType === "likes") return b.likes - a.likes;
      if (filterType === "comments") return b.comments - a.comments;
      return 0;
    });

  const totalViews = useMemo(() => filteredVideos.reduce((s, v) => s + v.views, 0), [filteredVideos]);
  const avgVPD = useMemo(() => filteredVideos.length ? Math.round(totalViews / filteredVideos.length) : 0, [filteredVideos, totalViews]);
  const shown = filteredVideos.slice(0, visibleCount);
  const hiScore = filteredVideos.filter((v) => v.tag.includes("guion")).length;

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
      {/* CABECERA */}
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

      {/* FILTROS PRINCIPALES */}
      <div className="flex flex-wrap gap-2 justify-center items-center p-2">
        <button onClick={() => setFilterType("")} className="px-2 py-1 rounded text-xs bg-slate-200 dark:bg-slate-700">🔄 Todos</button>
        <button onClick={() => setFilterType("popular")} className="px-2 py-1 rounded text-xs bg-yellow-300">🏆 Populares</button>
        <button onClick={() => setFilterType("hornstromp")} className="px-2 py-1 rounded text-xs bg-pink-300">🎮 Hornstromp</button>
        <button onClick={() => setFilterType("likes")} className="px-2 py-1 rounded text-xs bg-emerald-300">❤️ Likes</button>
        <button onClick={() => setFilterType("comments")} className="px-2 py-1 rounded text-xs bg-blue-300">💬 Comentarios</button>
      </div>

      {/* FILTROS ADICIONALES */}
      <div className="flex flex-wrap gap-2 justify-center items-center p-2">
        <label className="flex items-center gap-1 text-xs">
          Desde
          <input type="date" value={dateRange.start} onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))} className="border rounded px-1 py-0.5 text-xs dark:bg-slate-700" />
        </label>
        <label className="flex items-center gap-1 text-xs">
          Hasta
          <input type="date" value={dateRange.end} onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))} className="border rounded px-1 py-0.5 text-xs dark:bg-slate-700" />
        </label>
        {(dateRange.start || dateRange.end) && (
          <button onClick={() => setDateRange({ start: "", end: "" })} className="px-2 py-1 rounded text-xs bg-red-300">❌ Limpiar fechas</button>
        )}

        <button onClick={() => setDurationFilter("")} className={`px-2 py-1 rounded text-xs ${durationFilter === "" ? "bg-slate-400 dark:bg-slate-600 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>⏱️ Todas</button>
        <button onClick={() => setDurationFilter("short")} className={`px-2 py-1 rounded text-xs ${durationFilter === "short" ? "bg-indigo-500 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>⏱️ Cortos</button>
        <button onClick={() => setDurationFilter("medium")} className={`px-2 py-1 rounded text-xs ${durationFilter === "medium" ? "bg-indigo-500 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>⏱️ Medios</button>
        <button onClick={() => setDurationFilter("long")} className={`px-2 py-1 rounded text-xs ${durationFilter === "long" ? "bg-indigo-500 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>⏱️ Largos</button>
      </div>
            {/* ────────── MÉTRICAS ────────── */}
      <section className="flex flex-wrap gap-4 px-4 py-4 justify-center bg-slate-50 dark:bg-slate-800">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-2 shadow-sm flex flex-col gap-0.5 text-center w-28 sm:w-32">
          <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wide text-[10px]">Videos</span>
          <span className="text-sm font-bold whitespace-nowrap">{filteredVideos.length}</span>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-2 shadow-sm flex flex-col gap-0.5 text-center w-28 sm:w-32">
          <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wide text-[10px]">Visitas totales</span>
          <span className="text-sm font-bold whitespace-nowrap">{totalViews.toLocaleString()}</span>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-2 shadow-sm flex flex-col gap-0.5 text-center w-28 sm:w-32">
          <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wide text-[10px]">Visitas/día prom</span>
          <span className="text-sm font-bold whitespace-nowrap">{avgVPD.toLocaleString()}</span>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-2 shadow-sm flex flex-col gap-0.5 text-center w-28 sm:w-32">
          <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wide text-[10px]">Muy altas / Guion</span>
          <span className="text-sm font-bold whitespace-nowrap">{hiScore}</span>
        </div>
      </section>

      {/* ────────── GRID DE VÍDEOS ────────── */}
      <main className="w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 pb-16">
        {shown.map((v) => (
          <VideoCard key={v.videoId} v={v} />
        ))}
      </main>

      {/* Loader para scroll infinito */}
      <div ref={loaderRef} className="h-10" />

      {/* Botón keywords */}
      <button
        onClick={() => setShowKeywords(true)}
        className="fixed bottom-4 right-4 z-50 bg-purple-600 text-white w-14 h-14 text-xl rounded-full shadow-xl hover:bg-purple-700 flex items-center justify-center"
      >
        🔑
      </button>

      {/* Modal keywords */}
      {showKeywords && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-center">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm h-[90vh] overflow-y-auto p-4 shadow-xl rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">🔑 Top Keywords</h2>
              <button onClick={() => setShowKeywords(false)} className="text-slate-500 dark:text-slate-300 hover:text-red-500">
                <X size={20} />
              </button>
            </div>
            <div className="mb-3 text-xs text-slate-600 dark:text-slate-300">
              <p className="mb-1 font-semibold">📊 Leyenda de impacto:</p>
              <div className="grid grid-cols-2 gap-1">
                <span>🚀 Explosiva</span>
                <span>📈 Subiendo</span>
                <span>➖ Estable</span>
                <span>📉 Bajando</span>
                <span>❌ Irrelevante</span>
              </div>
            </div>
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-300/40 dark:border-slate-600 text-left bg-slate-100 dark:bg-slate-700 text-[11px] uppercase text-slate-600 dark:text-slate-300">
                  <th className="pr-1 py-2">#</th>
                  <th className="py-2">Keyword</th>
                  <th className="text-right py-2 pr-2">Uses</th>
                  <th className="text-right py-2 pr-2">Avg</th>
                  <th className="text-right py-2">Impacto</th>
                  <th className="text-right py-2 pr-2">📊</th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((k, i) => {
                  const icon =
                    k.impacto > 50000000 ? "🚀" :
                    k.impacto > 4000000 ? "📈" :
                    k.impacto > 200000 ? "➖" :
                    k.impacto > 100000 ? "📉" : "❌";

                  return (
                    <tr
                      key={i}
                      className={`cursor-pointer border-b border-slate-100 dark:border-slate-700 ${i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-700'}`}
                      onClick={() => {
                        setKeywordFilter(k.keyword);
                        setShowKeywords(false);
                      }}
                    >
                      <td className="pr-1 align-top text-[10px] text-slate-500 dark:text-slate-400">{i + 1}</td>
                      <td className="capitalize truncate max-w-[120px]" title={k.keyword}>
                        <span className="text-slate-800 dark:text-slate-100 font-medium">{k.keyword}</span>
                      </td>
                      <td className="text-right pr-2 text-slate-600 dark:text-slate-300">{k.uses}</td>
                      <td className="text-right pr-2 text-slate-600 dark:text-slate-300">{k.avg.toLocaleString()}</td>
                      <td className="text-right text-slate-600 dark:text-slate-300">{k.impacto.toLocaleString()}</td>
                      <td className="text-right text-xl">{icon}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )} flex flex-col bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {/* Cabecera y botones de filtro están integrados en tu código original */}
      {/* ... CONTINÚA CON TU INTERFAZ EXACTA (cabecera, filtros, secciones, keywords modal...) ... */}
    </div>
  );
}
