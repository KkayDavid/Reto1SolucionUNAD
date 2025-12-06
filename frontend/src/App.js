import React, { useEffect, useState, useRef } from "react";
import "./index.css";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Reports from "./Reports";

/* ============================================================
   UTILIDADES
============================================================ */


function decodeMime(str) {
  if (!str) return "";
  try {
    return decodeURIComponent(
      str
        .replace(/^=\?UTF-8\?Q\?/i, "")
        .replace(/\?=$/, "")
        .replace(/_/g, " ")
        .replace(/=([0-9A-F]{2})/gi, "%$1")
    );
  } catch {
    return str;
  }
}

function extractEmail(addr) {
  if (!addr) return "";
  const m = addr.match(/<([^>]+)>/);
  return m ? m[1] : addr;
}

function getCategory(email) {
  const subject = (email.subject || "").toLowerCase();
  const from = (email.from_address || "").toLowerCase();
  if (subject.includes("urgente") || subject.includes("ayuda")) return "Urgente";
  if (from.includes("google") || subject.includes("alerta")) return "Seguridad";
  if (subject.includes("re:") || subject.includes("confirmación")) return "Respuesta";
  return "General";
}

function getIcon(category) {
  switch (category) {
    case "Urgente": return "🔥";
    case "Seguridad": return "🛡️";
    case "Respuesta": return "🔁";
    default: return "📄";
  }
}

function parseUTCDate(dateStr) {
  if (!dateStr) return new Date();
  const fixed = dateStr.endsWith("Z") ? dateStr : dateStr + "Z";
  const d = new Date(fixed);
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatColombia(dateStr) {
  const d = parseUTCDate(dateStr);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);
}


export default function App() {
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [files, setFiles] = useState([]);
  const [showReports, setShowReports] = useState(false);


  const [activeFollowEmail, setActiveFollowEmail] = useState(null);
  const [followDate, setFollowDate] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() }; 
  });

  const [notifiedMap, setNotifiedMap] = useState(() => {
    return JSON.parse(localStorage.getItem("notifiedMap") || "{}");
  });

  const perPage = 10;
  const notificationIntervalRef = useRef(null);

  useEffect(() => {
  const interval = setInterval(() => {
    fetchEmails();
  }, 10000);

  return () => clearInterval(interval);
}, []);


  function logout() {
    localStorage.removeItem("logged");
    window.location.reload();
  }

  async function fetchEmails() {
    try {
      const res = await fetch("https://reto1solucionunad.onrender.com/api/emails");
      const data = await res.json();

      const saved = JSON.parse(localStorage.getItem("followDates") || "{}");

      const cleaned = data
        .map((e) => ({
          ...e,
          from_address: decodeMime(e.from_address || ""),
          subject: decodeMime(e.subject || ""),
          category: getCategory(e),
          follow: saved[e.id] || null,
        }))
        .sort((a, b) => new Date(b.received_at) - new Date(a.received_at));

      setEmails(cleaned);
    } catch (err) {
      console.error("Error fetch emails", err);
      alert("Error cargando correos.");
    }
  }


  function exportToExcel() {
    const rows = emails.map((e) => ({
      ID: e.id,
      Remitente: e.from_address,
      Asunto: e.subject,
      Fecha: formatColombia(e.received_at),
      Radicado: e.radicado_in,
      Categoria: e.category,
      Seguimiento: e.follow || "Sin fecha",
      Mensaje: e.body,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Correos");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbout]), "correos.xlsx");
  }

  function exportToPDF() {
    try {
      const pdf = new jsPDF({ orientation: "landscape" });
      pdf.setFontSize(14);
      pdf.text("Listado de correos", 10, 10);
      const rows = emails.map((e) => [
        e.from_address,
        e.subject,
        e.follow || "Sin fecha",
        formatColombia(e.received_at),
        e.category,
      ]);
      autoTable(pdf, {
        head: [["Remitente", "Asunto", "Seguimiento", "Fecha", "Categoría"]],
        body: rows,
        startY: 20,
      });
      pdf.save("correos.pdf");
    } catch (err) {
      console.error(err);
      alert("Error exportando PDF.");
    }
  }

 
  async function handleDelete() {
    if (!selectedEmail) return;
    if (!window.confirm("¿Eliminar este correo?")) return;
    try {
      await fetch(`https://reto1solucionunad.onrender.com/api/emails/${selectedEmail.id}`, { method: "DELETE" });
      setEmails((prev) => prev.filter((x) => x.id !== selectedEmail.id));
      setSelectedEmail(null);
      setReplyText("");
      setFiles([]);
    } catch (err) {
      alert("No se pudo eliminar.");
    }
  }

  async function handleReply() {
    if (!selectedEmail) return;
    const to = extractEmail(selectedEmail.from_address);
    const subject = selectedEmail.subject ? `Re: ${selectedEmail.subject}` : "Respuesta";
    if (!replyText.trim() && files.length === 0) {
      alert("Escribe un mensaje o adjunta archivos.");
      return;
    }
    try {
      const form = new FormData();
      form.append("to", to);
      form.append("subject", subject);
      form.append("message", replyText);
      files.forEach((f) => form.append("files", f));
      const res = await fetch("https://reto1solucionunad.onrender.com/api/emails", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      alert("Respuesta enviada.");
      setReplyText("");
      setFiles([]);
    } catch (err) {
      alert("Error enviando respuesta.");
    }
  }

  const searchedEmails = emails.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.from_address.toLowerCase().includes(q) ||
      e.subject.toLowerCase().includes(q) ||
      (e.body || "").toLowerCase().includes(q)
    );
  });
  const categoryFiltered = categoryFilter === "Todos" ? searchedEmails : searchedEmails.filter((e) => e.category === categoryFilter);
  const totalPages = Math.ceil(categoryFiltered.length / perPage) || 1;
  const paginatedEmails = categoryFiltered.slice((currentPage - 1) * perPage, currentPage * perPage);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(1); }, [totalPages]);

  
  function saveFollowDate() {
    if (!activeFollowEmail || !followDate) return;
    const saved = JSON.parse(localStorage.getItem("followDates") || "{}");
    saved[activeFollowEmail.id] = followDate;
    localStorage.setItem("followDates", JSON.stringify(saved));
    setEmails((prev) => prev.map((e) => (e.id === activeFollowEmail.id ? { ...e, follow: followDate } : e)));
    setActiveFollowEmail(null);
    setFollowDate("");
  }

  function removeFollowDate(emailId) {
    const saved = JSON.parse(localStorage.getItem("followDates") || "{}");
    delete saved[emailId];
    localStorage.setItem("followDates", JSON.stringify(saved));
    setEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, follow: null } : e)));
  }


  function buildMonth(year, month) {
    
    const first = new Date(year, month, 1);
    const startDay = first.getDay(); 
    const days = new Date(year, month + 1, 0).getDate();
    
    const matrix = [];
    let week = new Array(7).fill(null);
    let dayCounter = 1;
   
    for (let d = startDay, i = 0; i < 7; i++) {
      if (i < startDay) week[i] = null;
      else { week[i] = new Date(year, month, dayCounter++); }
    }
    matrix.push(week);
    while (dayCounter <= days) {
      week = new Array(7).fill(null);
      for (let i = 0; i < 7 && dayCounter <= days; i++) {
        week[i] = new Date(year, month, dayCounter++);
      }
      matrix.push(week);
    }
    return matrix;
  }


  function requestNotificationPermission() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        
      });
    }
  }

  function startNotificationChecker() {
    
    if (notificationIntervalRef.current) return;
    notificationIntervalRef.current = setInterval(checkNotifications, 60 * 1000);
    
    checkNotifications();
  }
  function stopNotificationChecker() {
    if (notificationIntervalRef.current) {
      clearInterval(notificationIntervalRef.current);
      notificationIntervalRef.current = null;
    }
  }

  function checkNotifications() {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10); // YYYY-MM-DD

    const saved = JSON.parse(localStorage.getItem("followDates") || "{}");
    const notified = JSON.parse(localStorage.getItem("notifiedMap") || "{}");

    Object.entries(saved).forEach(([id, dateStr]) => {
      if (!dateStr) return;
  
      if (dateStr === todayKey && !notified[id]) {
        const email = emails.find((x) => String(x.id) === String(id));
        const title = email ? `Seguimiento: ${email.subject}` : "Seguimiento pendiente";
        const body = email ? `Recordatorio para el correo de ${email.from_address}` : "Tienes una tarea programada";
        try {
          new Notification(title, { body });
        } catch (e) {
       
          console.log("Notification failed", e);
        }
        notified[id] = true;
      }
    });

    localStorage.setItem("notifiedMap", JSON.stringify(notified));
    setNotifiedMap(notified);
  }


  function emailsForDate(isoDate) {
    return emails.filter((e) => e.follow === isoDate);
  }

  const monthMatrix = buildMonth(calendarMonth.year, calendarMonth.month);

  return (
    <div className="app-wrap">
      {/* TOP BAR: reportes + calendar + logout */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "18px 32px" }}>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => setShowReports(true)} className="btn btn-refresh" style={{ background: "#0d6efd" }}>
            📊 Abrir Reportes
          </button>

          <button onClick={() => setShowCalendar((s) => !s)} className="btn btn-excel" style={{ background: "#10b981" }}>
            📅 Calendario
          </button>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn-logout-top" onClick={logout}>🔒 Cerrar sesión</button>
              </div>
      </div>
          {showReports && (
              <Reports
                  onClose={() => setShowReports(false)}
              />
          )}
      {/* Show calendar panel */}
      {showCalendar && (
        <div style={{
          margin: "8px 28px",
          padding: 16,
          borderRadius: 10,
          background: "#ffffff",
          boxShadow: "0 6px 20px rgba(0,0,0,0.08)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <strong style={{ fontSize: 18 }}>
                Calendario — {new Date(calendarMonth.year, calendarMonth.month).toLocaleString('es-CO', { month: 'long', year: 'numeric' })}
              </strong>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => setCalendarMonth(m => {
                const d = new Date(m.year, m.month - 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })}>◀</button>
              <button className="btn" onClick={() => setCalendarMonth(m => {
                const d = new Date(m.year, m.month + 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })}>▶</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, textAlign: "center" }}>
            {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(d => (
              <div key={d} style={{ fontWeight: 700, padding: "8px 0" }}>{d}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginTop: 8 }}>
            {monthMatrix.map((week, wi) => (
              week.map((day, di) => {
                if (!day) {
                  return <div key={`${wi}-${di}`} style={{ minHeight: 86, background: "#fbfbfb", borderRadius: 8 }} />;
                }
                const iso = day.toISOString().slice(0, 10);
                const dayEmails = emailsForDate(iso);
                const isToday = iso === (new Date().toISOString().slice(0, 10));
                return (
                  <div
                    key={`${wi}-${di}`}
                    style={{
                      minHeight: 86,
                      borderRadius: 8,
                      padding: 8,
                      background: isToday ? "linear-gradient(180deg,#fef3c7,#fff)" : "#fff",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between"
                    }}
                    onClick={() => {
                      // abrir modal con los correos de ese día
                      const list = emailsForDate(iso);
                      if (list.length) {
                        // seleccionar primer correo y abrir detalle (o abrir una lista modal)
                        setSelectedEmail(list[0]);
                      } else {
                        alert(`No hay seguimientos para el ${iso}`);
                      }
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 600 }}>{day.getDate()}</div>
                      {dayEmails.length > 0 && (
                        <div style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "#f97316", color: "white" }}>
                          {dayEmails.length}
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: 12, textAlign: "left", marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                      {dayEmails.slice(0, 3).map((ee) => (
                        <div key={ee.id} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          • {ee.subject || "(sin asunto)"}
                        </div>
                      ))}
                      {dayEmails.length > 3 && <div style={{ color: "#555", fontSize: 12 }}>+{dayEmails.length - 3} más</div>}
                    </div>
                  </div>
                );
              })
            ))}
          </div>
        </div>
      )}

      {/* Main content area */}
      <div style={{ padding: "0 28px 24px 28px" }}>
        <input
          className="search-input"
          placeholder="Buscar correo, remitente, texto…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
        />

        <div className="category-buttons" style={{ marginTop: 12 }}>
          {["Todos", "Urgente", "Seguridad", "Respuesta", "General"].map(cat => (
            <button key={cat} className={categoryFilter === cat ? "active" : ""} onClick={() => { setCategoryFilter(cat); setCurrentPage(1); }}>
              {cat}
            </button>
          ))}
        </div>

        <div className="top-buttons" style={{ marginTop: 12 }}>
          <button className="btn btn-refresh" onClick={fetchEmails}>🔄 Actualizar</button>
          <button className="btn btn-excel" onClick={exportToExcel}>📥 Excel</button>
          <button className="btn btn-pdf" onClick={exportToPDF}>📄 PDF</button>
        </div>

        <table className="email-table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Remitente</th>
              <th>Asunto</th>
              <th>Mensaje</th>
              <th>Fecha</th>
              <th>Seguimiento</th>
              <th>Categoría</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEmails.map(e => (
              <tr key={e.id} className="email-row" onClick={() => { setSelectedEmail(e); setReplyText(""); setFiles([]); }}>
                <td>{e.from_address}</td>
                <td><b>{e.subject}</b></td>
                <td>{(e.body || "").substring(0, 70)}...</td>
                <td>{formatColombia(e.received_at)}</td>
                <td>
                  {e.follow ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span>📅 {e.follow}</span>
                      <button className="btn" onClick={(ev) => { ev.stopPropagation(); removeFollowDate(e.id); }}>❌</button>
                    </div>
                  ) : <span style={{ opacity: 0.6 }}>—</span>}
                </td>
                <td>
                  <div className="badge-container">
                    <span>{getIcon(e.category)}</span>
                    <span className={`badge badge-${e.category.toLowerCase()}`}>{e.category}</span>
                  </div>
                </td>
                <td>
                  <button className="btn-small" onClick={(ev) => { ev.stopPropagation(); setActiveFollowEmail(e); setFollowDate(e.follow || ""); }}>
                    📅 Seguimiento
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pagination" style={{ marginTop: 12 }}>
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>◀</button>
          <span>Página {currentPage} de {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>▶</button>
        </div>

        {/* Detalle modal (abre al hacer click en fila) */}
        {selectedEmail && (
          <div className="modal-overlay" onClick={(e) => { if (e.target.classList.contains("modal-overlay")) setSelectedEmail(null); }}>
            <div className="modal-box">
              <div className="modal-title">Detalles del mensaje</div>
              <p><b>De:</b> {selectedEmail.from_address}</p>
              <p><b>Asunto:</b> {selectedEmail.subject}</p>
              <p><b>Radicado:</b> {selectedEmail.radicado_in}</p>
              <p><b>Fecha:</b> {formatColombia(selectedEmail.received_at)}</p>

              <div className="email-content-box">{selectedEmail.body?.replace(/^>/gm, "")?.replace(/&gt;/g, "")}</div>

              {/* Adjuntar archivos */}
              <div className="file-input-wrapper">
                <label className="file-input-label" htmlFor="fileUpload">📎 Adjuntar archivos</label>
                <input id="fileUpload" className="file-input" type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files))} />
                <span className="file-text">{files.length > 0 ? `${files.length} archivo(s)` : "Ningún archivo seleccionado"}</span>
              </div>

              <textarea className="reply-textarea" placeholder="Escribe tu respuesta…" value={replyText} onChange={(e) => setReplyText(e.target.value)} />

              <div className="reply-buttons">
                <button className="btn-send" onClick={handleReply}>Enviar</button>
                <button className="btn-delete" onClick={handleDelete}>Eliminar</button>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="btn" onClick={() => { setActiveFollowEmail(selectedEmail); setFollowDate(selectedEmail.follow || ""); }}>
                  📅 Agregar / Editar seguimiento
                </button>
                <button className="btn" onClick={() => setSelectedEmail(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de seguimiento */}
        {activeFollowEmail && (
          <div className="modal-overlay" onClick={(e) => { if (e.target.classList.contains("modal-overlay")) setActiveFollowEmail(null); }}>
            <div className="modal-box">
              <h3>📅 Seleccionar fecha de seguimiento</h3>
              <p><b>Correo:</b> {activeFollowEmail.subject}</p>
              <input type="date" value={followDate} onChange={(e) => setFollowDate(e.target.value)} style={{ padding: 10, marginTop: 12, width: "100%" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button className="btn-send" onClick={() => saveFollowDate()}>Guardar Seguimiento</button>
                <button className="btn" onClick={() => { removeFollowDate(activeFollowEmail.id); setActiveFollowEmail(null); }}>Eliminar Seguimiento</button>
                <button className="btn" onClick={() => setActiveFollowEmail(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        )}

      </div>

      
    </div>
  );
}
