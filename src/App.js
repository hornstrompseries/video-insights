// Archivo App.js completo actualizado
import React, { useState, useMemo, useEffect, memo, useRef } from "react";
import * as XLSX from "xlsx";
import { Moon, Sun, X } from "lucide-react";

export default function App() {
  const [videos, setVideos] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [visibleCount, setVisibleCount] = useState(18);
  const [dark, setDark] = useState(() => localStorage.getItem("vi-dark") === "1");
  const [keywordFilter, setKeywordFilter] = useState(null);
  const [showKeywords, setShowKeywords] = useState(false);
  const [sortKey, setSortKey] = useState("impacto");
  const [sortAsc, setSortAsc] = useState(false);
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

  const isoToSec = (iso = "") => {
    const [, m = 0, s = 0] = iso.match(/PT(?:(\d+)M)?(?:(\d+)S)?/) || [];
    return +m * 60 + +s;
  };
  const fmtDur = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const fmtDate = (d) => `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;

  const labelFromVPD = (vpd) =>
    vpd > 600000 ? "✍️ Hacer guion" :
    vpd > 400000 ? "🧠 TOP" :
    vpd > 200000 ? "🔥 Muy Alta" :
    vpd > 100000 ? "👍 Alta" :
    vpd > 50000  ? "👌 Normal" :
    vpd > 20000  ? "⚠️ Baja" :
                  "❌ Horrible";

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
    readRemoteSheet(
      "https://phqqstrqsmmqlkwvnztr.supabase.co/storage/v1/object/public/video-insights/stats/youtube_rss_recent_videos.xlsx",
      (raw) => {
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
            daysAgo: `${Math.floor(days)} días`,
            tag,
            channel: v.channel?.toLowerCase() || "",
          };
        }).filter(v => v.durationSec > 60).sort((a, b) => b.views - a.views);
        setVideos(list);
      }
    );
  };

  const loadKeywords = () => {
    readRemoteSheet(
      "https://phqqstrqsmmqlkwvnztr.supabase.co/storage/v1/object/public/video-insights/stats/tendencias_coloreadas_youtube.xlsx",
      (raw) => {
        const uniqueMap = new Map();
        raw.forEach((k) => {
          const keyword = (k["palabra_clave"] || "").toLowerCase();
          const id = k["video_id"] || Math.random();
          uniqueMap.set(`${id}_${keyword}`, {
            keyword,
            uses: +k["apariciones"] || 0,
            avg: +k["media_visitas"] || 0
          });
        });
        const keywords = Array.from(uniqueMap.values()).map(k => ({
          ...k,
          impacto: k.avg * k.uses
        }));
        setKeywords(keywords);
      }
    );
  };

  const sortKeywords = (key) => {
    const asc = key === sortKey ? !sortAsc : false;
    setSortAsc(asc);
    setSortKey(key);
    setKeywords([...keywords].sort((a, b) => asc ? a[key] - b[key] : b[key] - a[key]));
  };

  const filteredVideos = useMemo(() => {
    let list = videos;
    if (keywordFilter) list = list.filter(v => v.title.toLowerCase().includes(keywordFilter.toLowerCase()));
    return list;
  }, [videos, keywordFilter]);

  const totalViews = useMemo(() => filteredVideos.reduce((s, v) => s + v.views, 0), [filteredVideos]);
  const avgVPD = useMemo(() => filteredVideos.length ? Math.round(totalViews / filteredVideos.length) : 0, [filteredVideos, totalViews]);
  const shown = filteredVideos.slice(0, visibleCount);
  const hiScore = filteredVideos.filter((v) => v.tag.includes("guion")).length;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-900 px-4 py-3 shadow flex justify-between items-center">
        <h1 className="text-lg font-bold">📊 Video Insights</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setDark(d => { localStorage.setItem("vi-dark", d ? "0" : "1"); return !d; })} className="p-2">
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <section className="p-4 flex flex-wrap gap-4 justify-center">
        <div className="bg-white dark:bg-slate-800 p-2 rounded shadow w-28 text-center">
          <div className="text-xs text-gray-500">Videos</div>
          <div className="text-lg font-bold">{filteredVideos.length}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-2 rounded shadow w-28 text-center">
          <div className="text-xs text-gray-500">Vistas</div>
          <div className="text-lg font-bold">{totalViews.toLocaleString()}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-2 rounded shadow w-28 text-center">
          <div className="text-xs text-gray-500">VPD prom</div>
          <div className="text-lg font-bold">{avgVPD.toLocaleString()}</div>
        </div>
      </section>

      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
        {shown.map((v, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow">
            <img src={`https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`} className="w-full rounded" alt="thumbnail" />
            <div className="mt-2 font-bold text-sm">{v.title}</div>
            <div className="text-xs text-gray-500">{v.tag}</div>
            <div className="text-xs">{v.views.toLocaleString()} visitas</div>
          </div>
        ))}
      </main>

      <button onClick={() => setShowKeywords(true)} className="fixed bottom-4 right-4 bg-purple-600 text-white p-4 rounded-full shadow">🔑</button>

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
                <span>🚀 &nbsp;Explosiva / viral fuerte</span>
                <span>📈 &nbsp;Tendencia en subida</span>
                <span>➖ &nbsp;Estable / media</span>
                <span>📉 &nbsp;Bajada / flojeando</span>
                <span>❌ &nbsp;Muy floja / irrelevante</span>
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
                    k.impacto > 700000 ? "🚀" :
                    k.impacto > 400000 ? "📈" :
                    k.impacto > 200000 ? "➖" :
                    k.impacto > 100000 ? "📉" :
                                        "❌";

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
                      <td className="text-right pr-2 text-slate-600 dark:text-slate-300">{k.uses.toLocaleString()}</td>
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
      )}
    </div>
  );
}