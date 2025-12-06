import React, { useState, useEffect } from "react";
import "./index.css";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"; // 👉 IMPORTACIÓN CORRECTA

export default function Reports({ onClose }) {
  const [reports, setReports] = useState([]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [search, setSearch] = useState("");

  // Cargar reportes de localStorage
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("reportes") || "[]");
    setReports(saved);
  }, []);

  function saveReports(list) {
    localStorage.setItem("reportes", JSON.stringify(list));
    setReports(list);
  }

  function createReport() {
    if (!title.trim() || !detail.trim()) {
      alert("Completa todos los campos");
      return;
    }

    const newReport = {
      id: Date.now(),
      title,
      detail,
      date: new Date().toLocaleString("es-CO", {
        timeZone: "America/Bogota",
      }),
    };

    saveReports([newReport, ...reports]);
    setTitle("");
    setDetail("");
  }

  function deleteReport(id) {
    if (!window.confirm("¿Eliminar reporte?")) return;
    saveReports(reports.filter((r) => r.id !== id));
  }

  const filtered = reports.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase())
  );

  /* ============================
        EXPORTAR EXCEL
  ============================ */
  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reportes");
    XLSX.writeFile(wb, "reportes.xlsx");
  }

  /* ============================
        EXPORTAR PDF
  ============================ */
  function exportPDF() {
    try {
      const pdf = new jsPDF();

      pdf.text("Reporte general - Sistema", 14, 15);

      autoTable(pdf, {
        head: [["Título", "Detalle", "Fecha"]],
        body: filtered.map((r) => [r.title, r.detail, r.date]),
        startY: 20,
      });

      pdf.save("reportes.pdf");
    } catch (err) {
      console.error(err);
      alert("Error exportando a PDF");
    }
  }

  return (
    <div className="app-wrap">

      <header className="header">
        <span className="logo-emoji">📘</span>
        <div>Panel de Reportes</div>

        <button className="btn-delete" style={{ marginLeft: "auto" }} onClick={onClose}>
          Cerrar
        </button>
      </header>

      <div style={{ padding: "0 28px 24px 28px" }}>

        <h2>Crear reporte</h2>

        <input
          className="search-input"
          placeholder="Título del reporte…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="reply-textarea"
          placeholder="Detalles del reporte…"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
        />

        <button className="btn btn-refresh" onClick={createReport}>
          Guardar reporte
        </button>

        <hr />

        <h2>Historial de reportes</h2>

        <input
          className="search-input"
          placeholder="Buscar por título…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button className="btn btn-excel" onClick={exportExcel}>📥 Excel</button>
          <button className="btn btn-refresh" onClick={exportPDF}>📄 PDF</button>
        </div>

        <table className="email-table" style={{ marginTop: 20 }}>
          <thead>
            <tr>
              <th>Título</th>
              <th>Detalle</th>
              <th>Fecha</th>
              <th>Acción</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: "center" }}>
                  No hay reportes aún.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.title}</td>
                  <td>{r.detail}</td>
                  <td>{r.date}</td>
                  <td>
                    <button className="btn-delete" onClick={() => deleteReport(r.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

      </div>
    </div>
  );
}
