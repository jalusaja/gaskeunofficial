var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json());
var aiClient = null;
function getGemini() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY" && key !== "YOUR_API_KEY") {
      aiClient = new import_genai.GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
    }
  }
  return aiClient;
}
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "Gaskeun Ride-Hailing Backend" });
});
app.get("/api/places/search", async (req, res) => {
  try {
    const query = req.query.q || "Jakarta";
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query + ", Indonesia"
      )}&limit=5&countrycodes=id`,
      {
        headers: {
          "User-Agent": "GaskeunApp/1.0"
        }
      }
    );
    if (!response.ok) {
      return res.status(500).json({ error: "Failed to fetch places" });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/places/reverse-geocode", async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: "Missing lat/lng query parameters" });
    }
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`,
      {
        headers: {
          "User-Agent": "GaskeunApp/1.0"
        }
      }
    );
    if (!response.ok) {
      return res.status(500).json({ error: "Failed to reverse geocode" });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/route", async (req, res) => {
  try {
    const { startLat, startLng, endLat, endLng, mode } = req.query;
    if (!startLat || !startLng || !endLat || !endLng) {
      return res.status(400).json({ error: "Missing coordinates" });
    }
    const profile = mode === "motorcycle" ? "driving" : "driving";
    const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(osrmUrl);
    if (!response.ok) {
      return res.status(500).json({ error: "Route service unavailable" });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/gemini/driver-chat", async (req, res) => {
  try {
    const { message, driverName, vehiclePlate, pickupName, dropoffName, ridePreferences } = req.body;
    const ai = getGemini();
    const prefsText = Array.isArray(ridePreferences) && ridePreferences.length > 0 ? ` Preferensi perjalanan yang diminta penumpang: ${ridePreferences.join(", ")}.` : "";
    if (!ai) {
      const cannedResponses = [
        `Siap kak! Saya ${driverName || "Driver Gaskeun"} sedang meluncur ke ${pickupName || "titik jemput"}.${prefsText ? ` Noted untuk: ${ridePreferences.join(", ")}.` : ""}`,
        `Ok kak, posisi dekat lokasi. Permintaan Anda (${ridePreferences?.join(", ") || "sesuai aplikasi"}) sudah saya catat ya.`,
        `Siap kak, patokan lokasi sesuai di peta. Otw kak!`,
        `Halo kak, sudah sesuai aplikasi ya titiknya. Catatan preferensi Anda siap saya ikuti.`
      ];
      const reply2 = cannedResponses[Math.floor(Math.random() * cannedResponses.length)];
      return res.json({ reply: reply2 });
    }
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Anda adalah seorang driver ojek/taksi online Gaskeun bernama ${driverName} dengan plat nomor ${vehiclePlate}.
Anda sedang menjemput penumpang di ${pickupName} untuk diantar ke ${dropoffName}.${prefsText}
Jawab pesan penumpang berikut secara ramah, ringkas (1-2 kalimat), sopan, dan realistis seperti driver ojek online Indonesia. Jika penumpang menanyakan tentang preferensi perjalanannya (seperti Quiet Ride, AC dingin, atau bagasi), konfirmasikan bahwa Anda siap memenuhinya.
Pesan penumpang: "${message}"`
            }
          ]
        }
      ]
    });
    const reply = response.text || "Siap kak, ditunggu di titik ya!";
    res.json({ reply });
  } catch (err) {
    console.error("Gemini driver chat error:", err);
    res.json({ reply: "Siap kak, lokasi sudah sesuai titik di peta ya!" });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Gaskeun App server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
