"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "../../../components/AuthProvider";
import { updateMe } from "../../../lib/api";

const VEHICLE_MODELS_BY_MAKE: Record<string, string[]> = {
  "Alfa Romeo": ["Giulia", "Giulietta", "MiTo", "Tonale", "Stelvio", "Junior", "Other"],
  Audi: ["A1","A3","A4","A5","A6","A7","A8","Q2","Q3","Q4 e-tron","Q5","Q7","Q8","Q8 e-tron","RS3","RS4","RS5","RS6","TT","R8","e-tron","Other"],
  BMW: ["1 Series","2 Series","3 Series","4 Series","5 Series","6 Series","7 Series","8 Series","M2","M3","M4","M5","X1","X2","X3","X4","X5","X6","X7","Z4","i3","i4","i5","i7","iX","Other"],
  BYD: ["ATTO 3","DOLPHIN","SEAL","SEAL U","SEALION 7","HAN","TANG","Other"],
  Citroën: ["C1","C2","C3","C3 Aircross","C4","C4 X","C5","C5 Aircross","Berlingo","Other"],
  Cupra: ["Born","Formentor","Leon","Ateca","Tavascan","Other"],
  Dacia: ["Sandero","Sandero Stepway","Duster","Jogger","Spring","Logan","Other"],
  Fiat: ["500","500e","500X","600","Panda","Punto","Tipo","Other"],
  Ford: ["Fiesta","Focus","Focus ST","Mondeo","Ka","Ka+","Puma","Kuga","Mustang","Mustang Mach-E","S-Max","Galaxy","Transit","Ranger","Other"],
  Honda: ["Civic","Jazz","Accord","CR-V","HR-V","ZR-V","e","e:Ny1","Other"],
  Hyundai: ["i10","i20","i30","i40","Kona","Tucson","Santa Fe","IONIQ","IONIQ 5","IONIQ 6","Other"],
  Jaguar: ["E-PACE","F-PACE","I-PACE","XE","XF","XJ","F-TYPE","Other"],
  Jeep: ["Avenger","Renegade","Compass","Cherokee","Grand Cherokee","Wrangler","Other"],
  Kia: ["Picanto","Rio","Ceed","XCeed","Stonic","Niro","Sportage","Sorento","EV6","EV9","Other"],
  "Land Rover": ["Defender","Discovery","Discovery Sport","Freelander","Range Rover","Range Rover Evoque","Range Rover Sport","Other"],
  Lexus: ["CT","IS","ES","UX","NX","RX","RZ","GX","LX","Other"],
  Mazda: ["Mazda2","Mazda3","Mazda6","CX-3","CX-30","CX-5","CX-60","MX-5","MX-30","Other"],
  "Mercedes-Benz": ["A-Class","B-Class","C-Class","CLA","CLS","E-Class","S-Class","SL","GLA","GLB","GLC","GLE","GLS","EQA","EQB","EQC","EQE","EQS","Sprinter","Other"],
  Mini: ["Hatch","Convertible","Clubman","Countryman","Aceman","Other"],
  Nissan: ["Micra","Note","Leaf","Juke","Qashqai","X-Trail","Ariya","350Z","370Z","Other"],
  Opel: ["Corsa","Astra","Insignia","Crossland","Grandland","Mokka","Vivaro","Other"],
  Peugeot: ["108","208","2008","308","3008","408","508","5008","Other"],
  Porsche: ["718 Boxster","718 Cayman","911","Cayenne","Macan","Panamera","Taycan","Other"],
  Renault: ["Clio","Megane","Captur","Austral","Arkana","Scenic","Twingo","Zoe","Kangoo","Master","Other"],
  SEAT: ["Mii","Ibiza","Leon","Arona","Ateca","Tarraco","Other"],
  Skoda: ["Fabia","Rapid","Scala","Octavia","Superb","Kamiq","Karoq","Kodiaq","Enyaq","Other"],
  Subaru: ["BRZ","Forester","Impreza","Outback","Solterra","XV","Other"],
  Suzuki: ["Across","Alto","Ignis","Jimny","S-Cross","Swift","Vitara","Other"],
  Tesla: ["Model 3","Model S","Model X","Model Y","Cybertruck","Other"],
  Toyota: ["Aygo","Aygo X","Yaris","Yaris Cross","Corolla","Auris","Avensis","Camry","Prius","bZ4X","C-HR","RAV4","Land Cruiser","Hilux","Other"],
  Volkswagen: ["up!","Polo","Golf","Golf GTI","Golf R","Passat","Arteon","ID. Buzz","T-Cross","Taigo","T-Roc","Tiguan","Touareg","ID.3","ID.4","ID.5","ID.7","Touran","Caddy","Transporter","Other"],
  Volvo: ["V40","V60","V90","S60","S90","XC40","XC60","XC90","C40","EX30","EX40","EX90","Other"],
  Other: ["Other"],
};

const COLORS = [
  { label: "Black",  hex: "#1a1a1a" },
  { label: "White",  hex: "#f5f5f5" },
  { label: "Silver", hex: "#c0c0c0" },
  { label: "Grey",   hex: "#808080" },
  { label: "Blue",   hex: "#1d4ed8" },
  { label: "Red",    hex: "#dc2626" },
  { label: "Green",  hex: "#16a34a" },
  { label: "Yellow", hex: "#ca8a04" },
  { label: "Orange", hex: "#ea580c" },
  { label: "Brown",  hex: "#78350f" },
];

function formatIrishPlate(raw: string) {
  const upper = raw.toUpperCase();
  const endsWithSep = /[\s-]$/.test(raw);
  const segments = upper.split(/[\s-]+/).filter(Boolean);

  if (segments.length === 0) return "";

  // User has typed a separator — split into explicit segments
  if (segments.length >= 2 || endsWithSep) {
    const year   = (segments[0] ?? "").replace(/[^0-9]/g, "").slice(0, 3);
    const county = (segments[1] ?? "").replace(/[^A-Z]/g, "").slice(0, 2);
    const serial = (segments[2] ?? "").replace(/[^0-9]/g, "").slice(0, 6);
    if (!year) return "";
    if (endsWithSep && segments.length === 1) return `${year}-`;
    if (!county) return year;
    if (endsWithSep && segments.length === 2) return `${year}-${county}-`;
    if (!serial) return `${year}-${county}`;
    return `${year}-${county}-${serial}`;
  }

  // Single unbroken segment — auto-detect from character types
  const compact = segments[0].replace(/[^A-Z0-9]/g, "");
  const firstLetter = compact.search(/[A-Z]/);
  if (firstLetter === -1) return compact.slice(0, 3);
  const year   = compact.slice(0, firstLetter).slice(0, 3);
  const after  = compact.slice(firstLetter);
  const county = (after.match(/[A-Z]/g) ?? []).join("").slice(0, 2);
  const serial = after.replace(/[A-Z]/g, "").slice(0, 6);
  if (!year)   return compact.slice(0, 11);
  if (!county) return year;
  if (!serial) return `${year}-${county}`;
  return `${year}-${county}-${serial}`;
}

export default function VehiclePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>}>
      <VehiclePageContent />
    </Suspense>
  );
}

function VehiclePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get("next") ?? null;
  const { user, token, setUser } = useAuth();

  const [plate,  setPlate]  = useState(user?.vehiclePlate ?? "");
  const [make,   setMake]   = useState(user?.vehicleMake ?? "");
  const [model,  setModel]  = useState(user?.vehicleType ?? "");
  const [color,  setColor]  = useState(user?.vehicleColor ?? "");

  const availableModels = make ? (VEHICLE_MODELS_BY_MAKE[make] ?? ["Other"]) : [];
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true); setError(null); setSuccess(false);
    try {
      const res = await updateMe(token, {
        vehiclePlate: plate.trim().toUpperCase() || null,
        vehicleMake:  make  || null,
        vehicleType:  model || null,
        vehicleColor: color || null,
      });
      if (user) setUser({ ...user, ...res.user });
      setSuccess(true);
      if (next) router.push(next as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save vehicle");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600">Account</p>
        <h1 className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-slate-900">My Vehicle</h1>
        <p className="mt-1 text-[13.5px] text-slate-600">Your vehicle details are shared with hosts when you make a booking.</p>
      </div>

      {success && <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-[13px] text-brand-700">Vehicle saved.</div>}
      {error   && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">{error}</div>}

      {/* Registration plate */}
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <h2 className="mb-3 text-[15px] font-bold text-slate-900">Registration Plate</h2>
        <div className="flex overflow-hidden rounded-lg border-2 border-slate-800 shadow-sm">
          <div className="w-8 shrink-0 bg-[#003399]" />
          <input
            type="text"
            value={plate}
            onChange={(e) => setPlate(formatIrishPlate(e.target.value))}
            placeholder="221-D-12345"
            className="flex-1 bg-[#FAFAF8] px-4 py-3 text-[20px] font-bold uppercase tracking-[0.1em] text-slate-900 outline-none placeholder:text-[15px] placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400"
            maxLength={14}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>

      {/* Make & model */}
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <h2 className="mb-4 text-[15px] font-bold text-slate-900">Vehicle Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-slate-600">Make</label>
            <select
              value={make}
              onChange={(e) => { setMake(e.target.value); setModel(""); }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[14px] text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              <option value="">Select make…</option>
              {Object.keys(VEHICLE_MODELS_BY_MAKE).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-slate-600">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!make}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[14px] text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">{make ? "Select model…" : "Select make first"}</option>
              {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Colour */}
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <h2 className="mb-4 text-[15px] font-bold text-slate-900">Colour</h2>
        <select
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[14px] text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        >
          <option value="">Select colour…</option>
          {COLORS.map(({ label }) => (
            <option key={label} value={label}>{label}</option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-brand-500 py-3.5 text-[15px] font-bold text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save vehicle"}
      </button>
    </div>
  );
}
