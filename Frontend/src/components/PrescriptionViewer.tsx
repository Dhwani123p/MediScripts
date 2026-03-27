import { useEffect, useState } from "react";
import { API_BASE } from "../lib/config";
import { X, Printer, Loader2 } from "lucide-react";
import { Button } from "./ui/button";

interface PrescriptionViewerProps {
  prescriptionId: number;
  onClose: () => void;
}

const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

/** Deterministic SVG signature path generated from doctor's name */
function SignatureSVG({ name }: { name: string }) {
  const seed = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng  = (n: number) => ((seed * 9301 + n * 49297) % 233280) / 233280;

  const pts: [number, number][] = [[10, 30]];
  for (let i = 0; i < 10; i++) {
    const prev = pts[pts.length - 1];
    pts.push([
      Math.min(180, Math.max(10, prev[0] + 15 + rng(i * 3) * 10)),
      Math.min(55,  Math.max(5,  prev[1] + (rng(i * 7) - 0.5) * 28)),
    ]);
  }
  const d = pts
    .map((p, i) =>
      i === 0 ? `M ${p[0]} ${p[1]}` : `Q ${p[0]} ${pts[i - 1][1]} ${p[0]} ${p[1]}`
    )
    .join(" ");

  return (
    <svg width="190" height="60" viewBox="0 0 190 60" xmlns="http://www.w3.org/2000/svg">
      <path d={d} fill="none" stroke="#1a3a5c" strokeWidth="2" strokeLinecap="round" />
      <line x1="10" y1="58" x2="180" y2="58" stroke="#1a3a5c" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

/** Build a print-ready HTML string for the prescription */
function buildPrintHTML(p: any): string {
  const rxId    = `RX-${String(p.id).padStart(6, "0")}`;
  const date    = new Date(p.prescribed_date).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
  const doctor  = p.doctor_name      || "Doctor";
  const qual    = p.doctor_qualification ? `, ${p.doctor_qualification}` : "";
  const spec    = p.doctor_specialty  || "General Physician";
  const hosp    = p.doctor_hospital   || p.doctor_location || "MediScript Clinic";
  const patient = p.patient_name      || "Patient";
  const dosage  = p.dosage            || "—";
  const instr   = p.instructions      || "—";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Prescription ${rxId}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color:#1a1a2e; background:#fff; }
  .rx-wrap { max-width:720px; margin:0 auto; padding:32px; }
  /* ── Header ── */
  .rx-header { display:flex; justify-content:space-between; align-items:flex-start;
    border-bottom:3px solid #008080; padding-bottom:16px; margin-bottom:20px; }
  .rx-logo { font-size:22px; font-weight:800; color:#008080; letter-spacing:1px; }
  .rx-logo span { color:#1a3a5c; }
  .rx-doctor h2 { font-size:18px; font-weight:700; color:#1a3a5c; }
  .rx-doctor p  { font-size:12px; color:#555; margin-top:2px; }
  .rx-hospital  { font-size:11px; color:#008080; font-weight:600; margin-top:4px; }
  /* ── Meta strip ── */
  .rx-meta { display:flex; justify-content:space-between; background:#f0f9f9;
    border-radius:8px; padding:10px 16px; margin-bottom:20px; font-size:12px; }
  .rx-meta strong { color:#1a3a5c; }
  /* ── Patient box ── */
  .rx-patient { border:1px solid #d1e8e8; border-radius:8px; padding:12px 16px;
    margin-bottom:20px; }
  .rx-patient h4 { font-size:11px; text-transform:uppercase; color:#008080;
    letter-spacing:1px; margin-bottom:6px; }
  .rx-patient p  { font-size:14px; font-weight:600; color:#1a3a5c; }
  /* ── Rx symbol ── */
  .rx-symbol { font-size:36px; font-weight:900; color:#008080; line-height:1;
    margin-bottom:12px; }
  /* ── Medication table ── */
  table { width:100%; border-collapse:collapse; margin-bottom:24px; }
  th { background:#008080; color:#fff; font-size:12px; padding:8px 12px; text-align:left; }
  td { padding:10px 12px; font-size:13px; border-bottom:1px solid #e8f4f4; }
  tr:last-child td { border-bottom:none; }
  tr:nth-child(even) td { background:#f7fcfc; }
  .med-name { font-weight:600; color:#1a3a5c; }
  /* ── Signature ── */
  .rx-sig { display:flex; justify-content:flex-end; margin-top:32px; }
  .rx-sig-box { text-align:center; }
  .rx-sig-box p { font-size:11px; color:#555; margin-top:4px; border-top:1px solid #1a3a5c;
    padding-top:4px; }
  /* ── Footer ── */
  .rx-footer { margin-top:24px; border-top:1px solid #e0e0e0; padding-top:12px;
    font-size:10px; color:#888; text-align:center; }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .rx-wrap { padding:16px; }
  }
</style></head><body>
<div class="rx-wrap">
  <!-- Header -->
  <div class="rx-header">
    <div>
      <div class="rx-logo">Medi<span>Script</span></div>
      <div style="font-size:11px;color:#555;margin-top:4px;">Telemedicine Platform</div>
    </div>
    <div class="rx-doctor" style="text-align:right">
      <h2>${doctor}${qual}</h2>
      <p>${spec}${p.doctor_experience ? ` · ${p.doctor_experience} yrs exp` : ""}</p>
      <div class="rx-hospital">${hosp}</div>
    </div>
  </div>

  <!-- Meta strip -->
  <div class="rx-meta">
    <div><strong>Rx ID:</strong> ${rxId}</div>
    <div><strong>Date:</strong> ${date}</div>
    <div><strong>Status:</strong> ${p.status || "active"}</div>
  </div>

  <!-- Patient -->
  <div class="rx-patient">
    <h4>Patient</h4>
    <p>${patient}</p>
    ${p.patient_email ? `<div style="font-size:12px;color:#555;margin-top:2px;">${p.patient_email}</div>` : ""}
  </div>

  <!-- Rx symbol + medications -->
  <div class="rx-symbol">℞</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Medication</th>
        <th>Dosage &amp; Frequency</th>
        <th>Instructions</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td class="med-name">${p.medication}</td>
        <td>${dosage}</td>
        <td>${instr}</td>
      </tr>
    </tbody>
  </table>

  <!-- Signature -->
  <div class="rx-sig">
    <div class="rx-sig-box">
      <svg width="190" height="60" viewBox="0 0 190 60" xmlns="http://www.w3.org/2000/svg">
        ${buildSigPath(doctor)}
        <line x1="10" y1="58" x2="180" y2="58" stroke="#1a3a5c" stroke-width="1" opacity="0.4"/>
      </svg>
      <p>Dr. ${doctor.replace(/^Dr\.?\s*/i, "")}'s Digital Signature</p>
    </div>
  </div>

  <!-- Footer -->
  <div class="rx-footer">
    This prescription was issued via MediScript Telemedicine Platform.
    Valid for use as directed by the prescribing physician.
    Prescription ID: ${rxId}
  </div>
</div>
</body></html>`;
}

function buildSigPath(name: string): string {
  const seed = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng  = (n: number) => ((seed * 9301 + n * 49297) % 233280) / 233280;
  const pts: [number, number][] = [[10, 30]];
  for (let i = 0; i < 10; i++) {
    const prev = pts[pts.length - 1];
    pts.push([
      Math.min(180, Math.max(10, prev[0] + 15 + rng(i * 3) * 10)),
      Math.min(55,  Math.max(5,  prev[1] + (rng(i * 7) - 0.5) * 28)),
    ]);
  }
  const d = pts
    .map((p, i) =>
      i === 0
        ? `M ${p[0]} ${p[1]}`
        : `Q ${p[0]} ${pts[i - 1][1]} ${p[0]} ${p[1]}`
    )
    .join(" ");
  return `<path d="${d}" fill="none" stroke="#1a3a5c" stroke-width="2" stroke-linecap="round"/>`;
}

export function PrescriptionViewer({ prescriptionId, onClose }: PrescriptionViewerProps) {
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/prescriptions/${prescriptionId}`, { headers: authHeader() })
      .then((r) => r.json())
      .then((d) => {
        setLoading(false);
        if (d.error) { setError(d.error); return; }
        // Fetch patient health profile to enrich the prescription
        if (d.patient_id) {
          fetch(`${API_BASE}/health-profile/patient/${d.patient_id}`, { headers: authHeader() })
            .then(r => r.json())
            .then(hp => { setData({ ...d, healthProfile: hp.error ? null : hp }); })
            .catch(() => setData(d));
        } else {
          setData(d);
        }
      })
      .catch(() => { setError("Failed to load prescription"); setLoading(false); });
  }, [prescriptionId]);

  const handlePrint = () => {
    if (!data) return;
    const pw = window.open("", "_blank", "width=800,height=900");
    if (!pw) { alert("Please allow popups for this site to download the prescription."); return; }
    pw.document.write(buildPrintHTML(data));
    pw.document.close();
    pw.focus();
    setTimeout(() => { pw.print(); }, 400);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="font-semibold text-gray-800 text-lg">Prescription Details</h2>
          <div className="flex items-center gap-2">
            {data && (
              <Button onClick={handlePrint} className="bg-[#008080] hover:bg-[#008080]/90 text-sm">
                <Printer className="w-4 h-4 mr-2" />
                Print / Download PDF
              </Button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 ml-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#008080]" />
            </div>
          )}
          {error && (
            <p className="text-red-500 text-center py-8">{error}</p>
          )}
          {data && !loading && (
            <div className="space-y-5 font-sans text-gray-800">

              {/* Clinic header */}
              <div className="flex justify-between items-start border-b-2 border-[#008080] pb-4">
                <div>
                  <p className="text-2xl font-extrabold text-[#008080] tracking-wide">
                    Medi<span className="text-[#1a3a5c]">Script</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Telemedicine Platform</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#1a3a5c] text-base">
                    {data.doctor_name || "Doctor"}
                    {data.doctor_qualification ? `, ${data.doctor_qualification}` : ""}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {data.doctor_specialty || "General Physician"}
                    {data.doctor_experience ? ` · ${data.doctor_experience} yrs exp` : ""}
                  </p>
                  <p className="text-xs text-[#008080] font-semibold mt-1">
                    {data.doctor_hospital || data.doctor_location || "MediScript Clinic"}
                  </p>
                </div>
              </div>

              {/* Meta row */}
              <div className="flex justify-between bg-teal-50 rounded-xl px-4 py-2.5 text-sm">
                <span><strong>Rx ID:</strong> RX-{String(data.id).padStart(6, "0")}</span>
                <span><strong>Date:</strong> {new Date(data.prescribed_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
                <span className="capitalize"><strong>Status:</strong> {data.status || "active"}</span>
              </div>

              {/* Patient */}
              <div className="border border-teal-200 rounded-xl p-4 space-y-2">
                <p className="text-xs uppercase tracking-widest text-[#008080] font-semibold">Patient</p>
                <p className="font-semibold text-[#1a3a5c] text-base">{data.patient_name || "Patient"}</p>
                {data.patient_email && <p className="text-xs text-gray-500">{data.patient_email}</p>}
                {data.healthProfile && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs text-gray-600">
                    {data.healthProfile.age && (
                      <div><span className="font-semibold text-gray-700">Age:</span> {data.healthProfile.age} yrs</div>
                    )}
                    {data.healthProfile.gender && (
                      <div><span className="font-semibold text-gray-700">Gender:</span> {data.healthProfile.gender}</div>
                    )}
                    {data.healthProfile.blood_group && (
                      <div>
                        <span className="font-semibold text-gray-700">Blood Group:</span>{" "}
                        <span className="text-red-600 font-bold">{data.healthProfile.blood_group}</span>
                      </div>
                    )}
                    {data.healthProfile.weight_kg && (
                      <div><span className="font-semibold text-gray-700">Weight:</span> {data.healthProfile.weight_kg} kg</div>
                    )}
                  </div>
                )}
                {data.healthProfile?.allergies && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-xs text-red-700 mt-1">
                    <strong>⚠️ Known Allergies:</strong> {data.healthProfile.allergies}
                  </div>
                )}
                {data.healthProfile?.chronic_conditions && (
                  <div className="text-xs text-gray-600 mt-1">
                    <span className="font-semibold">Chronic Conditions:</span> {data.healthProfile.chronic_conditions}
                  </div>
                )}
              </div>

              {/* Medications */}
              <div>
                <p className="text-3xl font-black text-[#008080] mb-3">℞</p>
                <div className="rounded-xl overflow-hidden border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#008080] text-white">
                        <th className="py-2 px-3 text-left font-semibold">#</th>
                        <th className="py-2 px-3 text-left font-semibold">Medication</th>
                        <th className="py-2 px-3 text-left font-semibold">Dosage & Frequency</th>
                        <th className="py-2 px-3 text-left font-semibold">Instructions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 px-3 text-gray-500">1</td>
                        <td className="py-3 px-3 font-semibold text-[#1a3a5c]">{data.medication}</td>
                        <td className="py-3 px-3">{data.dosage || "—"}</td>
                        <td className="py-3 px-3">{data.instructions || "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Digital Signature */}
              <div className="flex justify-end pt-4">
                <div className="text-center">
                  <SignatureSVG name={data.doctor_name || "Doctor"} />
                  <p className="text-xs text-gray-500 mt-1 border-t border-gray-300 pt-1">
                    Dr. {(data.doctor_name || "Doctor").replace(/^Dr\.?\s*/i, "")}'s Digital Signature
                  </p>
                </div>
              </div>

              {/* Footer */}
              <p className="text-xs text-gray-400 text-center border-t pt-3">
                This prescription was issued via MediScript Telemedicine Platform.
                Valid for use as directed by the prescribing physician.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
