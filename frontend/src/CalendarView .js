// src/CalendarView.js
import React, { useState } from "react";
import "./calendar.css";

export default function CalendarView({ emails, onClose }) {
  const [selectedDate, setSelectedDate] = useState(null);

  // Agrupar correos por fecha (Año-Mes-Día)
  const grouped = emails.reduce((acc, email) => {
    const d = new Date(email.received_at);
    const key = d.toISOString().split("T")[0]; // YYYY-MM-DD
    if (!acc[key]) acc[key] = [];
    acc[key].push(email);
    return acc;
  }, {});

  const days = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div className="calendar-wrap">
      <div className="calendar-box">
        <button className="btn-close-calendar" onClick={onClose}>✖</button>
        <h2 className="title-cal">📅 Seguimiento por fechas</h2>

        {!selectedDate ? (
          <>
            <p className="sub">Selecciona un día para ver los correos recibidos</p>

            <div className="calendar-grid">
              {days.map(day => (
                <div
                  key={day}
                  className="calendar-day"
                  onClick={() => setSelectedDate(day)}
                >
                  <strong>{day}</strong>
                  <span>{grouped[day].length} correos</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <button className="btn-back" onClick={() => setSelectedDate(null)}>
              ◀ Volver al calendario
            </button>

            <h3 className="date-title">{selectedDate}</h3>

            <ul className="email-list">
              {grouped[selectedDate].map((e) => (
                <li key={e.id} className="email-item">
                  <b>{e.subject}</b> — {e.from_address}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
