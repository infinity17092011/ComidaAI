require("dotenv").config();
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_MODEL = process.env.GROK_MODEL || "grok-4";

app.use(express.json({ limit: "15mb" }));

const SYSTEM_PROMPT = `Eres un nutriologo experto en comida mexicana y latinoamericana
(tacos al pastor, pozole, tamales, pupusas, arepas, chilaquiles, empanadas, etc.).
Analiza la foto de comida y estima calorias y macros por porcion visible.
Responde SOLO con JSON valido, sin texto extra, con este formato:
{
  "platillo": "nombre del platillo en espanol",
  "porcion": "descripcion corta de la porcion estimada",
  "calorias": 0,
  "proteina_g": 0,
  "carbohidratos_g": 0,
  "grasa_g": 0,
  "ingredientes": ["..."],
  "confianza": "alta | media | baja",
  "nota": "consejo breve en espanol"
}
Si la imagen no es comida, responde {"error": "No veo comida en la foto"}.`;

app.post("/api/analizar", async (req, res) => {
  try {
    if (!GROK_API_KEY) {
      return res.status(500).json({ error: "Falta GROK_API_KEY en las variables de entorno" });
    }
    const { image } = req.body; // data URL: "data:image/jpeg;base64,..."
    if (!image || !image.startsWith("data:image/")) {
      return res.status(400).json({ error: "Manda una imagen valida" });
    }

    const r = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: image, detail: "high" } },
              { type: "text", text: "Analiza esta comida." },
            ],
          },
        ],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("Grok error:", data);
      return res.status(502).json({ error: data?.error?.message || "Error de Grok" });
    }

    const raw = data.choices?.[0]?.message?.content || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    res.json(JSON.parse(clean));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo analizar la imagen" });
  }
});

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Calorias AI</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:20px;background:#0f1115;color:#f2f2f2}
  h1{font-size:1.5rem}
  .btn{display:block;width:100%;padding:14px;border:0;border-radius:12px;background:#22c55e;color:#04210f;font-size:1rem;font-weight:700;text-align:center;cursor:pointer}
  img{width:100%;border-radius:12px;margin:16px 0;display:none}
  .card{background:#1a1d24;border-radius:12px;padding:16px;margin-top:16px;line-height:1.6}
  .big{font-size:2.4rem;font-weight:800;color:#22c55e}
</style></head><body>
<h1>Calorias AI</h1>
<p>Toma una foto de tu comida y te digo las calorias.</p>
<label class="btn">Tomar o subir foto
  <input id="file" type="file" accept="image/*" capture="environment" hidden>
</label>
<img id="preview">
<div id="out"></div>
<script>
const file = document.getElementById("file");
const preview = document.getElementById("preview");
const out = document.getElementById("out");

file.addEventListener("change", () => {
  const f = file.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = async () => {
    preview.src = reader.result;
    preview.style.display = "block";
    out.innerHTML = '<div class="card">Analizando...</div>';
    try {
      const r = await fetch("/api/analizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: reader.result }),
      });
      const d = await r.json();
      if (d.error) { out.innerHTML = '<div class="card">' + d.error + '</div>'; return; }
      out.innerHTML = '<div class="card">' +
        '<b>' + d.platillo + '</b><br><small>' + d.porcion + '</small>' +
        '<div class="big">' + d.calorias + ' kcal</div>' +
        'Proteina: ' + d.proteina_g + ' g<br>' +
        'Carbohidratos: ' + d.carbohidratos_g + ' g<br>' +
        'Grasa: ' + d.grasa_g + ' g<br>' +
        '<small>Confianza: ' + d.confianza + '</small><br>' +
        '<small>' + d.nota + '</small></div>';
    } catch (e) {
      out.innerHTML = '<div class="card">Error de conexion</div>';
    }
  };
  reader.readAsDataURL(f);
});
</script></body></html>`);
});

app.listen(PORT, () => console.log("Demo corriendo en http://localhost:" + PORT));
