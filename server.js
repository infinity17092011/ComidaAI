require("dotenv").config();
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_MODEL = process.env.GROK_MODEL || "grok-4";

app.use(express.json({ limit: "15mb" }));

const SYSTEM_PROMPT = `You are an expert nutritionist with deep knowledge of Mexican and Latin American food
(tacos al pastor, pozole, tamales, pupusas, arepas, chilaquiles, empanadas, birria, etc.).
Analyze the food photo and estimate calories and macros for the visible portion.
Reply ONLY with valid JSON, no extra text, in this format:
{
  "dish": "name of the dish",
  "portion": "short description of the estimated portion",
  "calories": 0,
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0,
  "ingredients": ["..."],
  "confidence": "high | medium | low",
  "tip": "one short helpful tip"
}
If the image is not food, reply {"error": "I can't see any food in this photo"}.`;

app.post("/api/analyze", async (req, res) => {
  try {
    if (!GROK_API_KEY) {
      return res.status(500).json({ error: "Missing GROK_API_KEY environment variable" });
    }
    const { image } = req.body; // data URL: "data:image/jpeg;base64,..."
    if (!image || !image.startsWith("data:image/")) {
      return res.status(400).json({ error: "Please send a valid image" });
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
              { type: "text", text: "Analyze this meal." },
            ],
          },
        ],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("Grok error:", data);
      return res.status(502).json({ error: data?.error?.message || "Grok API error" });
    }

    const raw = data.choices?.[0]?.message?.content || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    res.json(JSON.parse(clean));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not analyze the image" });
  }
});

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#000000">
<title>Cal</title>
<style>
  :root{--bg:#000;--fg:#fff;--muted:#8a8a8a;--line:#262626;--card:#0d0d0d}
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
  html,body{background:var(--bg);color:var(--fg)}
  body{font-family:-apple-system,BlinkMacSystemFont,"Inter","Helvetica Neue",Arial,sans-serif;
    max-width:480px;margin:0 auto;padding:max(20px,env(safe-area-inset-top)) 20px 60px;min-height:100vh}
  header{display:flex;justify-content:space-between;align-items:center;padding:8px 0 28px}
  .logo{font-size:1.35rem;font-weight:800;letter-spacing:-.03em}
  .date{font-size:.8rem;color:var(--muted)}
  .today{border:1px solid var(--line);background:var(--card);border-radius:24px;padding:22px;margin-bottom:16px}
  .label{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
  .total{display:flex;align-items:baseline;gap:8px;margin:6px 0 16px}
  .total b{font-size:3.4rem;font-weight:800;letter-spacing:-.04em;line-height:1}
  .total span{color:var(--muted);font-size:.95rem}
  .bar{height:6px;border-radius:99px;background:var(--line);overflow:hidden}
  .bar i{display:block;height:100%;background:var(--fg);border-radius:99px;transition:width .6s ease}
  .scan{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:18px;
    border-radius:20px;background:var(--fg);color:var(--bg);font-size:1rem;font-weight:700;cursor:pointer;
    transition:transform .1s}
  .scan:active{transform:scale(.98)}
  .scan svg{width:20px;height:20px}
  .shot{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:24px;margin:16px 0 0;display:none;border:1px solid var(--line)}
  .card{border:1px solid var(--line);background:var(--card);border-radius:24px;padding:22px;margin-top:16px}
  .dish{font-size:1.3rem;font-weight:700;letter-spacing:-.02em}
  .portion{color:var(--muted);font-size:.9rem;margin-top:2px}
  .kcal{display:flex;align-items:baseline;gap:8px;margin:18px 0 20px}
  .kcal b{font-size:3.6rem;font-weight:800;letter-spacing:-.04em;line-height:1}
  .kcal span{color:var(--muted)}
  .macro{margin-bottom:14px}
  .macro .row{display:flex;justify-content:space-between;font-size:.9rem;margin-bottom:6px}
  .macro .row span:last-child{color:var(--muted)}
  .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
  .chip{border:1px solid var(--line);border-radius:99px;padding:6px 12px;font-size:.78rem;color:#cfcfcf}
  .tip{margin-top:18px;padding-top:16px;border-top:1px solid var(--line);font-size:.9rem;color:#cfcfcf;line-height:1.5}
  .conf{font-size:.75rem;color:var(--muted);margin-top:14px}
  .add{width:100%;margin-top:18px;padding:15px;border-radius:16px;border:1px solid var(--fg);background:transparent;
    color:var(--fg);font-size:.95rem;font-weight:600;cursor:pointer}
  .add:active{background:var(--fg);color:var(--bg)}
  .loading{display:flex;align-items:center;gap:14px}
  .pulse{width:14px;height:14px;border-radius:50%;background:var(--fg);animation:p 1s ease-in-out infinite}
  @keyframes p{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}
  h2{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:30px 0 10px;font-weight:600}
  .meal{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--line)}
  .meal small{display:block;color:var(--muted);font-size:.75rem;margin-top:2px}
  .empty{color:var(--muted);font-size:.9rem;padding:8px 0}
</style></head><body>

<header>
  <div class="logo">Cal</div>
  <div class="date" id="date"></div>
</header>

<section class="today">
  <div class="label">Today</div>
  <div class="total"><b id="total">0</b><span>/ 2,000 kcal</span></div>
  <div class="bar"><i id="barfill" style="width:0%"></i></div>
</section>

<label class="scan">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
  Scan your meal
  <input id="file" type="file" accept="image/*" capture="environment" hidden>
</label>

<img id="shot" class="shot" alt="">
<div id="result"></div>

<h2>Today's meals</h2>
<div id="log"></div>

<script>
var TARGET = 2000;
var current = null;
var meals = [];
try { meals = JSON.parse(localStorage.getItem("cal_meals_" + today()) || "[]"); } catch (e) {}

function today(){ return new Date().toISOString().slice(0,10); }
function esc(s){ var d = document.createElement("div"); d.textContent = String(s == null ? "" : s); return d.innerHTML; }
function $(id){ return document.getElementById(id); }

$("date").textContent = new Date().toLocaleDateString("en-US", {weekday:"long", month:"short", day:"numeric"});

function save(){ try { localStorage.setItem("cal_meals_" + today(), JSON.stringify(meals)); } catch (e) {} }

function renderLog(){
  var sum = meals.reduce(function(a, m){ return a + (Number(m.calories) || 0); }, 0);
  $("total").textContent = sum.toLocaleString();
  $("barfill").style.width = Math.min(100, sum / TARGET * 100) + "%";
  if (!meals.length) { $("log").innerHTML = '<div class="empty">Nothing logged yet.</div>'; return; }
  $("log").innerHTML = meals.map(function(m){
    return '<div class="meal"><div>' + esc(m.dish) + '<small>' + esc(m.portion) + '</small></div><b>' + esc(m.calories) + ' kcal</b></div>';
  }).reverse().join("");
}

function macro(name, grams, max){
  var pct = Math.min(100, (Number(grams) || 0) / max * 100);
  return '<div class="macro"><div class="row"><span>' + name + '</span><span>' + esc(grams) + ' g</span></div>' +
         '<div class="bar"><i style="width:' + pct + '%"></i></div></div>';
}

function renderResult(d){
  current = d;
  var chips = (d.ingredients || []).map(function(i){ return '<span class="chip">' + esc(i) + '</span>'; }).join("");
  $("result").innerHTML =
    '<div class="card">' +
      '<div class="dish">' + esc(d.dish) + '</div>' +
      '<div class="portion">' + esc(d.portion) + '</div>' +
      '<div class="kcal"><b>' + esc(d.calories) + '</b><span>kcal</span></div>' +
      macro("Protein", d.protein_g, 60) + macro("Carbs", d.carbs_g, 120) + macro("Fat", d.fat_g, 50) +
      '<div class="chips">' + chips + '</div>' +
      '<div class="tip">' + esc(d.tip) + '</div>' +
      '<div class="conf">Confidence: ' + esc(d.confidence) + '</div>' +
      '<button class="add" id="addbtn">Add to today</button>' +
    '</div>';
  $("addbtn").onclick = function(){
    meals.push({dish: current.dish, portion: current.portion, calories: current.calories});
    save(); renderLog();
    $("result").innerHTML = ""; $("shot").style.display = "none";
    window.scrollTo({top: 0, behavior: "smooth"});
  };
}

$("file").addEventListener("change", function(){
  var f = this.files[0];
  if (!f) return;
  var reader = new FileReader();
  reader.onload = function(){
    $("shot").src = reader.result;
    $("shot").style.display = "block";
    $("result").innerHTML = '<div class="card loading"><div class="pulse"></div><div>Analyzing your meal...</div></div>';
    fetch("/api/analyze", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({image: reader.result})
    }).then(function(r){ return r.json(); }).then(function(d){
      if (d.error) { $("result").innerHTML = '<div class="card">' + esc(d.error) + '</div>'; return; }
      renderResult(d);
    }).catch(function(){
      $("result").innerHTML = '<div class="card">Connection error. Try again.</div>';
    });
  };
  reader.readAsDataURL(f);
  this.value = "";
});

renderLog();
</script></body></html>`);
});

app.listen(PORT, () => console.log("Demo running at http://localhost:" + PORT));
