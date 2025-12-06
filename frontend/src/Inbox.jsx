import { useEffect, useState } from "react";

function Inbox() {
  const [emails, setEmails] = useState([]);

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/emails/`);
    const data = await res.json();
    setEmails(data);
  };

  return (
    <div style={{ padding: "30px" }}>
      <h1 style={{ marginBottom: "20px", color: "#0a4b9a" }}>
        📬 Bandeja de Entrada
      </h1>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: "#e8f1ff" }}>
            <th style={th}>Radicado</th>
            <th style={th}>Remitente</th>
            <th style={th}>Asunto</th>
            <th style={th}>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {emails.map((mail) => (
            <tr key={mail.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={td}>{mail.radicado_in}</td>
              <td style={td}>{mail.from_address}</td>
              <td style={td}>{mail.subject}</td>
              <td style={td}>{new Date(mail.received_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th = {
  padding: "12px",
  textAlign: "left",
  fontWeight: "bold",
  borderBottom: "2px solid #0a4b9a",
};

const td = {
  padding: "10px",
};

export default Inbox;

