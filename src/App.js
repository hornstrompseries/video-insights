import React, { useState, useMemo, useEffect, memo, useRef } from "react";
import * as XLSX from "xlsx";
import { Moon, Sun, X, CalendarDays, Flame, TrendingUp, ListFilter, KeyRound, Search } from "lucide-react"; // Iconos adicionales

export default function App() {
  const [videos, setVideos] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [visibleCount, setVisibleCount] = useState(18);
  const [dark, setDark] = useState(() => localStorage.getItem("vi-dark") === "1");
  const [keywordSearchTerm, setKeywordSearchTerm] = useState(""); // Para buscar en el modal de keywords
  const [activeKeywordFilter, setActiveKeywordFilter] = useState(null); // El keyword aplicado a los videos
  const [filterType, setFilterType] = useState(""); // popular, hornstromp, recent, muyAlta, likes, comments
  const [durationFilter, setDurationFilter] = useState("");
  const [showKeywords, setShowKeywords] = useState(false);
  const loaderRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("vi-dark", dark ? "1" : "0");
  }, [dark]);

  useEffect(() => {
    loadVideos();
    loadKeywords();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 18);
        }
      },
      { threshold: 0.5 } // Cargar un poco antes de que llegue al final
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => {
      if (loaderRef.current) observer.unobserve(loaderRef.current);
    };
  }, [loaderRef]); // Observar el loaderRef directamente

  useEffect(() => {
    setVisibleCount(18); // Resetear el contador de videos visibles al cambiar filtros
  }, [filterType, activeKeywordFilter, durationFilter]);

  const isoToSec = (iso = "") => {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const [, h = 0, m = 0, s = 0] = match;
    return +h * 3600 + +m * 60 + +s;
  };

  const fmtDur = (s) => {
    const minutes = String(Math.floor(s / 60)).padStart(2, "0");
    const seconds = String(s % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const fmtDate = (d) => {
    if (!(d instanceof Date) || isNaN(d)) return "Fecha inválida";
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
  };

  // Ajustamos los umbrales o etiquetas si es necesario para tu nicho (animación)
  const labelFromVPD = (vpd) => {
    if (vpd > 600000) return "✍️ Hacer guion YA"; // Prioridad máxima
    if (vpd > 400000) return "🧠 TOP Tendencia";
    if (vpd > 200000) return "🔥 Muy Alta Perf."; // "Muy Alta Performance"
    if (vpd > 100000) return "👍 Alta Performance";
    if (vpd > 50000) return "👌 Buen Performance";
    if (vpd > 20000) return "⚠️ Performance Media";
    return "❌ Bajo Performance";
  };

  const colorFromLabel = (label) => {
    if (label.includes("guion YA")) return "#d946ef"; // Fucsia/Morado para acción inmediata
    if (label.includes("TOP Tendencia")) return "#f59e0b"; // Naranja más intenso para TOP
    if (label.includes("Muy Alta")) return "#ef4444"; // Rojo para Muy Alta
    if (label.includes("Alta")) return "#facc15"; // Amarillo
    if (label.includes("Buen")) return "#3b82f6"; // Azul
    if (label.includes("Media")) return "#6b7280"; // Gris
    return "#9ca3af"; // Gris más claro para Bajo
  };

  const readRemoteSheet = async (url, callback) => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error("❌ No se pudo descargar el archivo Excel desde:", url, res.statusText);
        // Podrías intentar cargar datos de un localStorage como fallback si falla la red
        // o mostrar un mensaje de error más persistente al usuario.
        callback([]); // Llama al callback con un array vacío para evitar errores posteriores
        return;
      }
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: "binary" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          callback(XLSX.utils.sheet_to_json(ws));
        } catch (readErr) {
          console.error("⚠️ Error al leer el contenido del Excel:", readErr);
          callback([]);
        }
      };
      reader.onerror = (err) => {
        console.error("⚠️ Error del FileReader:", err);
        callback([]);
      };
      reader.readAsBinaryString(blob);
    } catch (fetchErr) {
      console.error("⚠️ Error al cargar Excel (fetch):", fetchErr);
      callback([]);
    }
  };

  const loadVideos = () => {
    readRemoteSheet("https://phqqstrqsmmqlkwvnztr.supabase.co/storage/v1/object/public/video-insights/stats/youtube_rss_recent_videos.xlsx", (raw) => {
      if (!raw || raw.length === 0) {
        setVideos([]); // Asegurar que videos sea un array vacío si no hay datos
        return;
      }
      const list = raw.map((v) => {
        const views = +(`${v.views}`.replace(/\D/g, "") || 0);
        const likes = +(`${v.likes}`.replace(/\D/g, "") || 0);
        const comments = +(`${v.comments}`.replace(/\D/g, "") || 0);
        const sec = isoToSec(v.duration);
        const pub = new Date(v.publishedAt);
        const days = Math.max((Date.now() - pub.getTime()) / 864e5, 1); // Usar getTime() para asegurar compatibilidad
        const vpd = views / days; // Permitir decimales para un ranking más preciso antes de redondear
        const tag = labelFromVPD(Math.round(vpd)); // Redondear VPD para el tag
        return {
          ...v,
          views,
          likes,
          comments,
          durationFmt: fmtDur(sec),
          durationSec: sec,
          publishedFmt: fmtDate(pub),
          publishedDate: pub, // Mantener como objeto Date para comparaciones
          daysAgo: `${Math.floor(days)} días`,
          vpd: vpd, // Guardar vpd original para posible uso futuro
          tag,
          tagColor: colorFromLabel(tag),
          channelId: v.channelId || "N/A", // Asegurar que channelId existe
          title: v.title || "Título no disponible", // Asegurar que title existe
        };
      }).sort((a, b) => b.views - a.views); // Orden inicial por vistas
      setVideos(list.filter((v) => v.durationSec > 30)); // Filtrar videos muy cortos si no son relevantes (ej. 30s)
    });
  };

  const loadKeywords = () => {
    readRemoteSheet("https://phqqstrqsmmqlkwvnztr.supabase.co/storage/v1/object/public/video-insights/stats/tendencias_coloreadas_youtube.xlsx", (raw) => {
      if (!raw || raw.length === 0) {
        setKeywords([]);
        return;
      }
      const list = raw.map((k) => {
        const palabra = k["palabra_clave"] || "";
        const apariciones = +k["apariciones"] || 0;
        const media = +k["media_visitas"] || 0;
        // Fórmula de impacto: considera tanto la popularidad (media_visitas) como la frecuencia (apariciones).
        // Podrías experimentar con la ponderación, ej. Math.pow(media, 1.2) * apariciones si quieres dar más peso a la media.
        const impacto = media * apariciones;
        return {
          keyword: palabra.toLowerCase(), // Normalizar a minúsculas para búsquedas/filtros
          uses: apariciones,
          avg: media,
          impacto,
        };
      }).sort((a, b) => b.impacto - a.impacto).slice(0, 150); // Mostrar más keywords si es útil
      setKeywords(list);
    });
  };

  const filteredVideos = useMemo(() => {
    let tempVideos = [...videos];

    // 1. Filtrar por texto (si hay activeKeywordFilter)
    if (activeKeywordFilter) {
      tempVideos = tempVideos.filter((v) =>
        v.title.toLowerCase().includes(activeKeywordFilter.toLowerCase())
      );
    }

    // 2. Filtrar por tipo específico (popular, hornstromp, muyAlta)
    if (filterType === "popular") {
      tempVideos = tempVideos.filter((v) => ["✍️ Hacer guion YA", "🧠 TOP Tendencia"].includes(v.tag));
    } else if (filterType === "hornstromp") {
      // Asegúrate que estos IDs de canal son los correctos para Hornstromp
      tempVideos = tempVideos.filter((v) => ["UCaCoS1ylN81PAgotBDyKgug", "UCpRx8BFSkdVx8MAW8unaJcw"].includes(v.channelId));
    } else if (filterType === "muyAlta") {
      tempVideos = tempVideos.filter((v) => v.tag === "🔥 Muy Alta Perf.");
    }

    // 3. Filtrar por duración
    if (durationFilter) {
      tempVideos = tempVideos.filter((v) => {
        if (durationFilter === "short") return v.durationSec < 240; // Ej: < 4 min
        if (durationFilter === "medium") return v.durationSec >= 240 && v.durationSec <= 1200; // Ej: 4-20 min
        if (durationFilter === "long") return v.durationSec > 1200; // Ej: > 20 min
        return true;
      });
    }
    
    // 4. Ordenar según filterType (después de todos los filtros)
    if (filterType === "recent") {
      tempVideos.sort((a, b) => b.publishedDate.getTime() - a.publishedDate.getTime());
    } else if (filterType === "likes") {
      tempVideos.sort((a, b) => b.likes - a.likes);
    } else if (filterType === "comments") {
      tempVideos.sort((a, b) => b.comments - a.comments);
    } else if (filterType !== "popular" && filterType !== "hornstromp" && filterType !== "muyAlta") {
      // Si no es un filtro que ya implica un orden (como 'popular' que se basa en VPD/views)
      // y no es 'recent', 'likes', o 'comments', entonces ordena por VPD como default.
      // Los videos ya están ordenados por views desde loadVideos, que es un buen proxy de VPD.
      // O podrías ordenar explícitamente por vpd aquí:
      tempVideos.sort((a, b) => b.vpd - a.vpd);
    }
    // Si es "popular", "hornstromp", "muyAlta", se mantiene el orden por defecto (views/VPD).

    return tempVideos;
  }, [videos, activeKeywordFilter, filterType, durationFilter]);


  const totalViews = useMemo(() => filteredVideos.reduce((s, v) => s + v.views, 0), [filteredVideos]);
  const avgVPD = useMemo(() => {
    if (filteredVideos.length === 0) return 0;
    const totalVPD = filteredVideos.reduce((s, v) => s + v.vpd, 0);
    return Math.round(totalVPD / filteredVideos.length);
  }, [filteredVideos]);
  
  const shownVideos = filteredVideos.slice(0, visibleCount);

  const hiPotentialCount = useMemo(() =>
    filteredVideos.filter(v => v.tag === "✍️ Hacer guion YA" || v.tag === "🔥 Muy Alta Perf.").length
  , [filteredVideos]);

  const filteredKeywords = useMemo(() => {
    if (!keywordSearchTerm) return keywords;
    return keywords.filter(k => k.keyword.toLowerCase().includes(keywordSearchTerm.toLowerCase()));
  }, [keywords, keywordSearchTerm]);


  const FilterButton = ({ onClick, type, currentFilter, children, icon, activeColorClass, defaultColorClass }) => (
    <button
      onClick={() => onClick(type)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 whitespace-nowrap
                  ${currentFilter === type 
                    ? (activeColorClass || "bg-sky-500 text-white shadow-md") 
                    : (defaultColorClass || "bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600")}`}
    >
      {icon && React.cloneElement(icon, { size: 16, className: "hidden sm:inline" })}
      {children}
    </button>
  );


  const VideoCard = memo(({ v }) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1.5 flex flex-col overflow-hidden group">
      <div className="relative">
        {/* Corregido el enlace de la imagen y video, usa el videoId directamente */}
        <a href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer">
          <img 
            src={`https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`} 
            alt={v.title} 
            className="w-full aspect-video object-cover transition-transform duration-300 group-hover:scale-105" 
            loading="lazy" 
          />
          <span className="absolute bottom-2 right-2 bg-black/75 text-white text-xs font-semibold px-2 py-0.5 rounded">
            {v.durationFmt}
          </span>
        </a>
      </div>
      <div className="p-3 sm:p-4 flex-1 flex flex-col">
        <h3 className="text-sm sm:text-base font-semibold line-clamp-2 mb-1.5 text-slate-800 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
          <a href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer">{v.title}</a>
        </h3>
        <p className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400 mb-1">
          {v.views.toLocaleString()} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">visitas</span>
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          {v.likes.toLocaleString()} likes · {v.comments.toLocaleString()} comentarios
        </p>
        <div className="mt-auto text-xs flex justify-between items-center text-slate-400 dark:text-slate-500">
          <span>{v.publishedFmt}</span>
          <span className="font-semibold text-purple-600 dark:text-purple-400">{v.daysAgo}</span>
        </div>
      </div>
      <div style={{ backgroundColor: v.tagColor }} className="text-white text-center text-xs sm:text-sm py-1.5 font-semibold tracking-wide">
        {v.tag}
      </div>
    </div>
  ));

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-50"> {/* Ajustado color de fondo dark */}
      {/* CABECERA */}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 bg-white dark:bg-slate-900 shadow-md sticky top-0 z-30 border-b border-slate-200 dark:border-slate-700">
        <h1 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2 text-sky-600 dark:text-sky-400">
          <TrendingUp size={28} /> Video Insights PRO
        </h1>
        <div className="flex gap-2 items-center">
          {activeKeywordFilter && (
            <button 
              onClick={() => setActiveKeywordFilter(null)} 
              className="text-xs bg-red-100 dark:bg-red-800 text-red-600 dark:text-red-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
            >
              <X size={14} /> Quitar: "{activeKeywordFilter}"
            </button>
          )}
          <button
            onClick={() => setDark((d) => !d)}
            className="p-2.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
          >
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* FILTROS */}
      <section className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-2"><ListFilter size={18}/>Filtros Principales</h2>
            <div className="flex flex-wrap gap-2 items-center">
                <FilterButton onClick={setFilterType} type="" currentFilter={filterType} icon={<TrendingUp />}>🔄 Todos</FilterButton>
                <FilterButton onClick={setFilterType} type="popular" currentFilter={filterType} icon={<Flame />} activeColorClass="bg-amber-500 text-white shadow-md" defaultColorClass="bg-amber-100 hover:bg-amber-200 dark:bg-amber-800 dark:hover:bg-amber-700">🏆 Populares</FilterButton>
                {/* NUEVO FILTRO "MUY ALTA" */}
                <FilterButton onClick={setFilterType} type="muyAlta" currentFilter={filterType} icon={<Flame />} activeColorClass="bg-red-500 text-white shadow-md" defaultColorClass="bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700">🔥 Muy Alta Perf.</FilterButton>
                {/* NUEVO FILTRO "RECIENTES" */}
                <FilterButton onClick={setFilterType} type="recent" currentFilter={filterType} icon={<CalendarDays />} activeColorClass="bg-teal-500 text-white shadow-md" defaultColorClass="bg-teal-100 hover:bg-teal-200 dark:bg-teal-800 dark:hover:bg-teal-700">🗓️ Recientes</FilterButton>
                <FilterButton onClick={setFilterType} type="hornstromp" currentFilter={filterType} activeColorClass="bg-pink-500 text-white shadow-md" defaultColorClass="bg-pink-100 hover:bg-pink-200 dark:bg-pink-800 dark:hover:bg-pink-700">🎮 Hornstromp</FilterButton>
                <FilterButton onClick={setFilterType} type="likes" currentFilter={filterType} activeColorClass="bg-emerald-500 text-white shadow-md" defaultColorClass="bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-800 dark:hover:bg-emerald-700">❤️ Likes</FilterButton>
                <FilterButton onClick={setFilterType} type="comments" currentFilter={filterType} activeColorClass="bg-blue-500 text-white shadow-md" defaultColorClass="bg-blue-100 hover:bg-blue-200 dark:bg-blue-800 dark:hover:bg-blue-700">💬 Comentarios</FilterButton>
            </div>
        </div>
        <div>
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-2"><ListFilter size={18}/>Filtros Adicionales</h2>
            <div className="flex flex-wrap gap-2 items-center">
                <FilterButton onClick={setDurationFilter} type="" currentFilter={durationFilter} icon={<ListFilter />}>⏱️ Todas Duraciones</FilterButton>
                <FilterButton onClick={setDurationFilter} type="short" currentFilter={durationFilter} icon={<ListFilter />} activeColorClass="bg-indigo-500 text-white shadow-md" defaultColorClass="bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-800 dark:hover:bg-indigo-700">⏱️ Cortos (&lt;4m)</FilterButton>
                <FilterButton onClick={setDurationFilter} type="medium" currentFilter={durationFilter} icon={<ListFilter />} activeColorClass="bg-indigo-500 text-white shadow-md" defaultColorClass="bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-800 dark:hover:bg-indigo-700">⏱️ Medios (4-20m)</FilterButton>
                <FilterButton onClick={setDurationFilter} type="long" currentFilter={durationFilter} icon={<ListFilter />} activeColorClass="bg-indigo-500 text-white shadow-md" defaultColorClass="bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-800 dark:hover:bg-indigo-700">⏱️ Largos (&gt;20m)</FilterButton>
            </div>
        </div>
      </section>
      
      {/* MÉTRICAS */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 px-3 sm:px-4 py-4 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        {[
          { label: "Videos Filtrados", value: filteredVideos.length.toLocaleString() },
          { label: "Visitas Totales", value: totalViews.toLocaleString() },
          { label: "VPD Promedio", value: avgVPD.toLocaleString() },
          { label: "Alto Potencial", value: hiPotentialCount.toLocaleString(), tip: "'Hacer Guion YA' o 'Muy Alta Perf.'" }
        ].map(metric => (
          <div key={metric.label} title={metric.tip} className="bg-white dark:bg-slate-800 rounded-lg p-3 shadow flex flex-col items-center justify-center text-center">
            <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px] sm:text-xs font-medium">{metric.label}</span>
            <span className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">{metric.value}</span>
          </div>
        ))}
      </section>

      {/* GRID DE VÍDEOS */}
      {filteredVideos.length > 0 ? (
        <main className="w-full max-w-screen-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-5 px-3 sm:px-4 py-6 flex-1">
          {shownVideos.map((v) => (
            <VideoCard key={`${v.videoId}-${v.publishedAt}`} v={v} /> // Key más única si hay duplicados de videoId por alguna razón
          ))}
        </main>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-4">
          <Search size={48} className="text-slate-400 dark:text-slate-500 mb-4" />
          <p className="text-xl font-semibold text-slate-700 dark:text-slate-300">No se encontraron vídeos</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Prueba a cambiar los filtros o a recargar la página.</p>
        </div>
      )}


      {/* Loader para scroll infinito */}
      {filteredVideos.length > visibleCount && <div ref={loaderRef} className="h-20 flex justify-center items-center"><p className="text-slate-500 dark:text-slate-400">Cargando más vídeos...</p></div>}

      {/* Botón keywords */}
      <button
        onClick={() => setShowKeywords(true)}
        className="fixed bottom-5 right-5 z-40 bg-purple-600 text-white w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-xl hover:bg-purple-700 active:bg-purple-800 transition-all duration-150 flex items-center justify-center"
        aria-label="Mostrar Top Keywords"
      >
        <KeyRound size={28} />
      </button>

      {/* Modal keywords */}
      {showKeywords && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4" onClick={() => setShowKeywords(false)}>
          <div 
            className="bg-white dark:bg-slate-800 w-full max-w-lg h-[90vh] overflow-hidden p-4 sm:p-5 shadow-2xl rounded-xl flex flex-col"
            onClick={(e) => e.stopPropagation()} // Evitar que el click dentro del modal lo cierre
          >
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <KeyRound size={22}/> Top Keywords
              </h2>
              <button onClick={() => setShowKeywords(false)} className="text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" aria-label="Cerrar modal">
                <X size={24} />
              </button>
            </div>
            
            <div className="mb-3">
                <input 
                    type="text"
                    placeholder="Buscar keyword..."
                    value={keywordSearchTerm}
                    onChange={(e) => setKeywordSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none dark:bg-slate-700 dark:text-slate-100"
                />
            </div>

            <div className="mb-3 text-xs text-slate-600 dark:text-slate-300 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-md">
              <p className="mb-1 font-semibold">📊 Leyenda de Impacto (Impacto = Usos * Media de Visitas):</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-1">
                <span><span className="text-lg">🚀</span> Explosiva (&gt;700k)</span>
                <span><span className="text-lg">📈</span> Muy Alta (&gt;400k)</span>
                <span><span className="text-lg">🔥</span> Alta (&gt;200k)</span>
                <span><span className="text-lg">👍</span> Media (&gt;100k)</span>
                <span><span className="text-lg">⚠️</span> Baja (&lt;100k)</span>
                {/* Cambié "Estable", "Bajando", "Irrelevante" por términos más directos sobre el impacto */}
              </div>
              <p className="mt-1 text-[10px]">Estos iconos indican el potencial general de una keyword basado en su uso y las visitas promedio que generan los vídeos que la utilizan.</p>
            </div>

            <div className="flex-1 overflow-y-auto pr-1"> {/* Contenedor para la tabla con scroll */}
              {filteredKeywords.length > 0 ? (
                <table className="text-xs sm:text-sm w-full border-collapse">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-700 z-10">
                    <tr className="border-b border-slate-300/70 dark:border-slate-600 text-left text-slate-600 dark:text-slate-300 uppercase text-[10px] sm:text-xs">
                      <th className="pl-2 pr-1 py-2.5 w-8 text-center">#</th>
                      <th className="py-2.5">Keyword</th>
                      <th className="text-right py-2.5 pr-2">Usos</th>
                      <th className="text-right py-2.5 pr-2">Media Visitas</th>
                      <th className="text-right py-2.5 pr-2">Impacto Total</th>
                      <th className="text-center py-2.5 pr-2 w-10">Pot.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKeywords.map((k, i) => {
                      const icon =
                        k.impacto > 700000 ? "🚀" :
                        k.impacto > 400000 ? "📈" :
                        k.impacto > 200000 ? "🔥" :
                        k.impacto > 100000 ? "👍" : "⚠️";

                      return (
                        <tr
                          key={k.keyword + i} // Asegurar key única
                          className={`border-b border-slate-100 dark:border-slate-700/70 hover:bg-sky-50 dark:hover:bg-sky-800/30 transition-colors cursor-pointer
                                      ${i % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-800/50'}`}
                          onClick={() => {
                            setActiveKeywordFilter(k.keyword);
                            setShowKeywords(false);
                            setKeywordSearchTerm(""); // Limpiar búsqueda al seleccionar
                          }}
                          title={`Filtrar vídeos por "${k.keyword}"`}
                        >
                          <td className="pl-2 pr-1 py-2.5 align-middle text-center text-slate-500 dark:text-slate-400">{i + 1}</td>
                          <td className="py-2.5 capitalize truncate max-w-[100px] sm:max-w-[150px] font-medium text-slate-700 dark:text-slate-200">{k.keyword}</td>
                          <td className="text-right py-2.5 pr-2 text-slate-600 dark:text-slate-300">{k.uses.toLocaleString()}</td>
                          <td className="text-right py-2.5 pr-2 text-slate-600 dark:text-slate-300">{k.avg.toLocaleString()}</td>
                          <td className="text-right py-2.5 pr-2 font-semibold text-sky-600 dark:text-sky-400">{k.impacto.toLocaleString()}</td>
                          <td className="text-center py-2.5 pr-2 text-lg sm:text-xl">{icon}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-center py-6 text-slate-500 dark:text-slate-400">No se encontraron keywords con ese término.</p>
              )}
            </div>
          </div>
        </div>
      )}
      {/* EL TEXTO ERRÓNEO HA SIDO ELIMINADO DE AQUÍ */}
    </div>
  );
}