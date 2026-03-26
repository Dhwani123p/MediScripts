import { useState, useEffect } from "react";
import { API_BASE } from "../lib/config";
import { WritePrescription } from "./WritePrescription";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import {
  Calendar, Users, FileText, MessageSquare, Settings, Home,
  Clock, Video, Plus, Search, Eye, Edit, ChevronDown,
  User, LogOut, Heart, ChevronLeft, ChevronRight, X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DoctorDashboardProps {
  onLogout: () => void;
  onNavigateHome: () => void;
  onStartVideoCall?: (roomName?: string) => void;
}

// ── Mock fallback data ────────────────────────────────────────────────────
const MOCK_APPOINTMENTS = [
  { id: 1, patient: "John Smith",    time: "9:00 AM",  type: "video", status: "upcoming",     condition: "Follow-up consultation" },
  { id: 2, patient: "Sarah Wilson",  time: "10:30 AM", type: "video", status: "in-progress",  condition: "Chest pain evaluation" },
  { id: 3, patient: "Mike Johnson",  time: "2:00 PM",  type: "video", status: "upcoming",     condition: "Annual physical" },
  { id: 4, patient: "Alice Brown",   time: "3:30 PM",  type: "video", status: "upcoming",     condition: "Medication review" },
  { id: 5, patient: "David Lee",     time: "4:00 PM",  type: "video", status: "upcoming",     condition: "Mental health check" },
  { id: 6, patient: "Mary Wilson",   time: "4:30 PM",  type: "video", status: "upcoming",     condition: "Blood pressure check" },
  { id: 7, patient: "Tom Garcia",    time: "5:00 PM",  type: "video", status: "upcoming",     condition: "Consultation" },
  { id: 8, patient: "Jane Miller",   time: "5:30 PM",  type: "video", status: "completed",    condition: "Routine checkup" },
  { id: 9, patient: "Chris Taylor",  time: "6:00 PM",  type: "video", status: "completed",    condition: "Lab results discussion" },
  { id: 10, patient: "Lisa Chen",    time: "6:30 PM",  type: "video", status: "completed",    condition: "Follow-up" },
];

const MOCK_PATIENTS = [
  { id: 1,  name: "Emma Davis",      age: 34, lastVisit: "2 days ago",  condition: "Hypertension",    status: "stable" },
  { id: 2,  name: "Robert Chen",     age: 45, lastVisit: "1 week ago",  condition: "Diabetes Type 2", status: "monitoring" },
  { id: 3,  name: "Lisa Anderson",   age: 28, lastVisit: "3 days ago",  condition: "Anxiety",         status: "improving" },
  { id: 4,  name: "Michael Brown",   age: 52, lastVisit: "1 week ago",  condition: "Heart Disease",   status: "stable" },
  { id: 5,  name: "Sarah Miller",    age: 31, lastVisit: "5 days ago",  condition: "Migraine",        status: "improving" },
  { id: 6,  name: "James Wilson",    age: 67, lastVisit: "2 weeks ago", condition: "Arthritis",       status: "monitoring" },
  { id: 7,  name: "Jennifer Garcia", age: 29, lastVisit: "4 days ago",  condition: "Allergies",       status: "stable" },
  { id: 8,  name: "David Martinez",  age: 41, lastVisit: "1 week ago",  condition: "Sleep Apnea",     status: "improving" },
  { id: 9,  name: "Amanda Lee",      age: 36, lastVisit: "3 days ago",  condition: "Depression",      status: "monitoring" },
  { id: 10, name: "Kevin Taylor",    age: 58, lastVisit: "1 week ago",  condition: "COPD",            status: "stable" },
];

const MOCK_PRESCRIPTIONS = [
  { id: 1,  patient: "John Smith",      medication: "Lisinopril 10mg",    date: "Today",      status: "sent" },
  { id: 2,  patient: "Sarah Wilson",    medication: "Ibuprofen 400mg",    date: "Yesterday",  status: "filled" },
  { id: 3,  patient: "Emma Davis",      medication: "Metformin 500mg",    date: "2 days ago", status: "sent" },
  { id: 4,  patient: "Robert Chen",     medication: "Insulin Glargine",   date: "3 days ago", status: "filled" },
  { id: 5,  patient: "Lisa Anderson",   medication: "Sertraline 50mg",    date: "4 days ago", status: "sent" },
  { id: 6,  patient: "Michael Brown",   medication: "Atorvastatin 20mg",  date: "5 days ago", status: "filled" },
  { id: 7,  patient: "Sarah Miller",    medication: "Sumatriptan 50mg",   date: "6 days ago", status: "sent" },
  { id: 8,  patient: "James Wilson",    medication: "Naproxen 250mg",     date: "1 week ago", status: "filled" },
  { id: 9,  patient: "Jennifer Garcia", medication: "Cetirizine 10mg",    date: "1 week ago", status: "sent" },
  { id: 10, patient: "David Martinez",  medication: "Zolpidem 10mg",      date: "1 week ago", status: "filled" },
];

const getLoggedInName = () => {
  try {
    const raw  = localStorage.getItem("user");
    if (!raw) return "Doctor";
    const user = JSON.parse(raw);
    const name = user.fullName || user.full_name || "";
    return name || "Doctor";
  } catch { return "Doctor"; }
};

const getTodayStr = () => new Date().toISOString().split("T")[0];
const SCHED_SLOTS  = ["09:00 AM","10:00 AM","11:00 AM","12:00 PM","02:00 PM","03:00 PM","04:00 PM","05:00 PM"];

const API = API_BASE;
const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

export function DoctorDashboard({ onLogout, onNavigateHome, onStartVideoCall }: DoctorDashboardProps) {
  const [activeSection, setActiveSection]         = useState("home");
  const [searchQuery, setSearchQuery]             = useState("");
  const [appointmentsPage, setAppointmentsPage]   = useState(1);
  const [patientsPage, setPatientsPage]           = useState(1);
  const [prescriptionsPage, setPrescriptionsPage] = useState(1);
  const recordsPerPage = 10;

  const [allAppointments, setAllAppointments]         = useState<any[]>([]);
  const [allPrescriptions, setAllPrescriptions]       = useState<any[]>([]);
  const [doctorName, setDoctorName]                   = useState(getLoggedInName());
  const [toastMsg, setToastMsg]                       = useState("");
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);

  // ── Schedule modal state ─────────────────────────────────────────────────
  const [showScheduleModal,  setShowScheduleModal]  = useState(false);
  const [schedStep,          setSchedStep]          = useState(1);
  const [schedEmail,         setSchedEmail]         = useState("");
  const [schedPatient,       setSchedPatient]       = useState<any>(null);
  const [schedDate,          setSchedDate]          = useState("");
  const [schedTime,          setSchedTime]          = useState("");
  const [schedNotes,         setSchedNotes]         = useState("");
  const [schedSearching,     setSchedSearching]     = useState(false);
  const [schedSubmitting,    setSchedSubmitting]    = useState(false);

  // patients are still mock — no patients table yet
  const allPatients = MOCK_PATIENTS;

  const loadRealData = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      // get real name
      const meRes  = await fetch(`${API}/auth/me`, { headers: authHeader() });
      const meData = await meRes.json();
      const u      = meData.user || meData;
      const name   = u.fullName || u.full_name || "";
      if (name) setDoctorName(name);

      // appointments (doctor sees their own via doctor user_id join)
      const apptRes  = await fetch(`${API}/appointments`, { headers: authHeader() });
      const apptData = await apptRes.json();
      if (Array.isArray(apptData)) {
        setAllAppointments(apptData.map((a: any) => ({
          id:        a.id,
          patient:   a.patient_name      || "Unknown Patient",
          time:      new Date(a.appointment_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          date:      new Date(a.appointment_date).toLocaleDateString(),
          type:      a.appointment_type  || "video",
          status:    a.status            || "scheduled",
          condition: a.notes             || "General consultation",
        })));
      }

      // prescriptions
      const presRes  = await fetch(`${API}/prescriptions`, { headers: authHeader() });
      const presData = await presRes.json();
      if (Array.isArray(presData) && presData.length > 0) {
        setAllPrescriptions(presData.map((p: any) => ({
          id:         p.id,
          patient:    p.patient_name || "Unknown Patient",
          medication: p.medication,
          date:       new Date(p.prescribed_date).toLocaleDateString(),
          status:     p.status || "sent",
        })));
      }
    } catch {
      // silently use mock
    }
  };

  useEffect(() => { loadRealData(); }, []);

  const searchPatient = async () => {
    if (!schedEmail.trim()) return;
    setSchedSearching(true);
    setSchedPatient(null);
    try {
      const res  = await fetch(`${API}/users/search?email=${encodeURIComponent(schedEmail.trim())}`, { headers: authHeader() });
      const data = await res.json();
      if (data.id) {
        setSchedPatient(data);
      } else {
        setToastMsg("❌ Patient not found with that email");
        setTimeout(() => setToastMsg(""), 3000);
      }
    } catch {
      setToastMsg("❌ Could not search — check server connection");
      setTimeout(() => setToastMsg(""), 3000);
    }
    setSchedSearching(false);
  };

  const bookForPatient = async () => {
    setSchedSubmitting(true);
    try {
      const [year,month,day] = schedDate.split("-");
      const timeStr = schedTime.replace(" AM","").replace(" PM","");
      let [hours, mins] = timeStr.split(":").map(Number);
      if (schedTime.includes("PM") && hours !== 12) hours += 12;
      if (schedTime.includes("AM") && hours === 12) hours = 0;
      const iso = new Date(parseInt(year), parseInt(month)-1, parseInt(day), hours, mins).toISOString();

      const res  = await fetch(`${API}/appointments/for-patient`, {
        method:  "POST",
        headers: authHeader(),
        body:    JSON.stringify({ patient_email: schedEmail.trim(), appointment_date: iso, appointment_type: "video", notes: schedNotes }),
      });
      const data = await res.json();
      if (data.id) {
        setToastMsg(`✅ Appointment scheduled for ${schedPatient?.full_name || schedEmail}`);
        setShowScheduleModal(false);
        setSchedStep(1); setSchedEmail(""); setSchedPatient(null);
        setSchedDate(""); setSchedTime(""); setSchedNotes("");
        await loadRealData();
      } else {
        setToastMsg("❌ " + (data.error || "Scheduling failed"));
      }
    } catch {
      setToastMsg("❌ Could not connect to server");
    }
    setTimeout(() => setToastMsg(""), 4000);
    setSchedSubmitting(false);
  };

  const closeScheduleModal = () => {
    setShowScheduleModal(false);
    setSchedStep(1); setSchedEmail(""); setSchedPatient(null);
    setSchedDate(""); setSchedTime(""); setSchedNotes("");
  };

  const handleUpdateStatus = async (appointmentId: number, newStatus: string) => {
    try {
      await fetch(`${API}/appointments/${appointmentId}`, {
        method:  "PATCH",
        headers: authHeader(),
        body:    JSON.stringify({ status: newStatus }),
      });
      setToastMsg(`✅ Appointment marked as ${newStatus}`);
      await loadRealData();
      setTimeout(() => setToastMsg(""), 3000);
    } catch {
      setToastMsg("❌ Could not update appointment");
      setTimeout(() => setToastMsg(""), 3000);
    }
  };

  const appointments  = allAppointments;
  const prescriptions = allPrescriptions;

  const todayAppointments   = appointments.slice(0, 3);
  const recentPatients      = allPatients.slice(0, 3);
  const recentPrescriptions = prescriptions.slice(0, 2);

  const filteredPatients = allPatients.filter(
    (p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           p.condition.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const upcomingCount   = appointments.filter((a) => ["scheduled","upcoming","confirmed"].includes(a.status)).length;
  const completedCount  = appointments.filter((a) => a.status === "completed").length;

  const paginateData  = (data: any[], page: number) => data.slice((page-1)*recordsPerPage, page*recordsPerPage);
  const getTotalPages = (len: number) => Math.ceil(len / recordsPerPage);

  const renderPagination = (cur: number, total: number, onChange: (p: number) => void) => {
    if (total <= 1) return null;
    return (
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-gray-500">Showing {((cur-1)*recordsPerPage)+1} to {Math.min(cur*recordsPerPage, total*recordsPerPage)} of {total*recordsPerPage} entries</p>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => onChange(cur-1)} disabled={cur===1}><ChevronLeft className="w-4 h-4" />Previous</Button>
          <span className="text-sm text-gray-500">Page {cur} of {total}</span>
          <Button variant="outline" size="sm" onClick={() => onChange(cur+1)} disabled={cur===total}>Next<ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Prescription Modal */}
      <AnimatePresence>
        {showPrescriptionModal && (
          <WritePrescription onClose={() => { setShowPrescriptionModal(false); loadRealData(); }} />
        )}
      </AnimatePresence>

      {/* Schedule New Appointment Modal */}
      <AnimatePresence>
        {showScheduleModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.25 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
                <div>
                  <h2 className="font-semibold text-gray-900">Schedule Appointment</h2>
                  <p className="text-xs text-gray-500">{schedStep === 1 ? "Step 1: Find patient" : "Step 2: Pick date & time"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {[1,2].map(s => <div key={s} className={`w-2 h-2 rounded-full ${schedStep >= s ? "bg-[#008080]" : "bg-gray-200"}`} />)}
                  </div>
                  <button onClick={closeScheduleModal} className="text-gray-400 hover:text-gray-600 rounded-full p-1.5 hover:bg-gray-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Step 1: Patient lookup */}
              {schedStep === 1 && (
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Patient Email</label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={schedEmail}
                        onChange={e => setSchedEmail(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && searchPatient()}
                        placeholder="patient@email.com"
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#008080] bg-gray-50"
                      />
                      <button
                        onClick={searchPatient}
                        disabled={!schedEmail || schedSearching}
                        className="px-4 py-2.5 bg-[#008080] text-white rounded-xl text-sm font-medium hover:bg-[#008080]/90 disabled:opacity-50"
                      >
                        {schedSearching ? "..." : "Find"}
                      </button>
                    </div>
                  </div>
                  {schedPatient && (
                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#008080] rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {schedPatient.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-teal-800">{schedPatient.full_name}</p>
                        <p className="text-xs text-teal-600">{schedPatient.email} · {schedPatient.role}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Date & time */}
              {schedStep === 2 && (
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                    <input
                      type="date"
                      min={getTodayStr()}
                      value={schedDate}
                      onChange={e => setSchedDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#008080] bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Time Slot</label>
                    <div className="flex flex-wrap gap-2">
                      {SCHED_SLOTS.map(slot => (
                        <button
                          key={slot}
                          onClick={() => setSchedTime(slot)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            schedTime === slot
                              ? "bg-[#008080] text-white border-[#008080]"
                              : "bg-white text-gray-600 border-gray-200 hover:border-[#008080] hover:text-[#008080]"
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Notes <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={schedNotes}
                      onChange={e => setSchedNotes(e.target.value)}
                      placeholder="Reason or instructions..."
                      rows={2}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#008080] bg-gray-50 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
                <button
                  onClick={() => schedStep === 1 ? closeScheduleModal() : setSchedStep(1)}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
                >
                  {schedStep === 1 ? "Cancel" : "← Back"}
                </button>
                {schedStep === 1 ? (
                  <button
                    onClick={() => setSchedStep(2)}
                    disabled={!schedPatient}
                    className="px-6 py-2.5 bg-[#008080] text-white rounded-xl text-sm font-medium hover:bg-[#008080]/90 disabled:opacity-50"
                  >
                    Continue →
                  </button>
                ) : (
                  <button
                    onClick={bookForPatient}
                    disabled={!schedDate || !schedTime || schedSubmitting}
                    className="px-6 py-2.5 bg-[#008080] text-white rounded-xl text-sm font-medium hover:bg-[#008080]/90 disabled:opacity-50"
                  >
                    {schedSubmitting ? "Scheduling…" : "✅ Schedule"}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2 cursor-pointer" onClick={onNavigateHome}>
              <div className="w-10 h-10 bg-gradient-to-r from-[#008080] to-[#00BFFF] rounded-xl flex items-center justify-center">
                <Heart size={24} className="text-white" />
              </div>
              <span className="text-2xl text-gray-900">Mediscript</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center space-x-2 bg-white px-2 py-1 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#008080]">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${doctorName}`} />
                    <AvatarFallback>{doctorName.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="hidden md:block">{doctorName}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setActiveSection("home")}><Home className="w-4 h-4 mr-2" />Dashboard</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveSection("appointments")}><Calendar className="w-4 h-4 mr-2" />Appointments</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveSection("patients")}><Users className="w-4 h-4 mr-2" />Patients</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveSection("prescriptions")}><FileText className="w-4 h-4 mr-2" />Prescriptions</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}><LogOut className="w-4 h-4 mr-2" />Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="container mx-auto px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

          {/* Toast */}
          {toastMsg && (
            <div className={`p-3 rounded-lg text-sm mb-4 flex items-center justify-between ${toastMsg.startsWith("✅") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              <span>{toastMsg}</span>
              <button onClick={() => setToastMsg("")}><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* HOME */}
          {activeSection === "home" && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl mb-2">Good day, {doctorName}!</h1>
                <p className="text-gray-600">You have {upcomingCount} upcoming appointments</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm">Today's Patients</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl">{upcomingCount}</div>
                    <p className="text-xs text-muted-foreground">{completedCount} completed</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm">Total Appointments</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl">{appointments.length}</div>
                    <p className="text-xs text-muted-foreground">All time</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm">Prescriptions</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl">{prescriptions.length}</div>
                    <p className="text-xs text-muted-foreground">Total issued</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Today's Appointments */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                      Today's Appointment Timeline
                      <Button variant="outline" size="sm" onClick={() => setActiveSection("appointments")}>
                        <Calendar className="w-4 h-4 mr-2" />View All
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {todayAppointments.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">No appointments today</p>
                    ) : (
                      <div className="space-y-4">
                        {todayAppointments.map((appt, index) => (
                          <div key={appt.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                            <div className="flex flex-col items-center">
                              <div className={`w-3 h-3 rounded-full ${
                                appt.status === "in-progress" ? "bg-green-500" :
                                appt.status === "completed"   ? "bg-blue-500"  : "bg-gray-300"
                              }`} />
                              {index < todayAppointments.length - 1 && <div className="w-px h-8 bg-gray-200 mt-2" />}
                            </div>
                            <div className="flex-1 flex items-center space-x-4">
                              <Avatar>
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${appt.patient}`} />
                                <AvatarFallback>PT</AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm">{appt.patient}</p>
                                  <Badge variant={appt.status === "in-progress" ? "default" : "secondary"}>
                                    {appt.status}
                                  </Badge>
                                </div>
                                <p className="text-xs text-gray-500">{appt.condition}</p>
                                <div className="flex items-center space-x-2 mt-1">
                                  <Clock className="w-3 h-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">{appt.time}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              {appt.status === "completed" ? (
                                <Button size="sm" variant="outline">View Notes</Button>
                              ) : (
                                <>
                                  <Button size="sm" className="bg-[#008080] hover:bg-[#008080]/90" onClick={() => onStartVideoCall?.(`mediscript-appt-${appt.id}`)}>
                                    <Video className="w-4 h-4 mr-2" />
                                    {appt.status === "in-progress" ? "Join Call" : "Start Call"}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(appt.id, "completed")}>
                                    Complete
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Patients */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                      Recent Patients
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          placeholder="Search patients..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-8 pr-4 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-[#008080]"
                        />
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {recentPatients.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((patient) => (
                      <div key={patient.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <Avatar>
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${patient.name}`} />
                            <AvatarFallback>PT</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm">{patient.name}</p>
                            <p className="text-xs text-gray-500">Age {patient.age} · {patient.condition}</p>
                            <p className="text-xs text-gray-500">Last visit: {patient.lastVisit}</p>
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <Badge variant={patient.status === "stable" ? "secondary" : patient.status === "improving" ? "default" : "outline"}>
                            {patient.status}
                          </Badge>
                          <div className="flex space-x-1">
                            <Button size="sm" variant="outline"><Eye className="w-4 h-4" /></Button>
                            <Button size="sm" variant="outline"><Edit className="w-4 h-4" /></Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Recent Prescriptions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                      Recent Prescriptions
                      <Button variant="outline" size="sm" onClick={() => setShowPrescriptionModal(true)}>
                        <Plus className="w-4 h-4 mr-2" />View All
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {recentPrescriptions.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No prescriptions yet</p>
                    ) : recentPrescriptions.map((prescription) => (
                      <div key={prescription.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="text-sm">{prescription.medication}</p>
                          <p className="text-xs text-gray-500">For {prescription.patient}</p>
                          <p className="text-xs text-gray-500">{prescription.date}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={prescription.status === "sent" ? "default" : "secondary"}>
                            {prescription.status}
                          </Badge>
                          <Button size="sm" variant="outline"><Eye className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* APPOINTMENTS */}
          {activeSection === "appointments" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl">Appointments</h1>
                <Button className="bg-[#008080] hover:bg-[#008080]/90" onClick={() => setShowScheduleModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />Schedule New
                </Button>
              </div>
              <Card>
                <CardHeader><CardTitle>All Appointments ({appointments.length})</CardTitle></CardHeader>
                <CardContent>
                  {appointments.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No appointments yet</p>
                  ) : (
                    <div className="space-y-4">
                      {paginateData(appointments, appointmentsPage).map((appt) => (
                        <div key={appt.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <Avatar>
                              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${appt.patient}`} />
                              <AvatarFallback>PT</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm">{appt.patient}</p>
                              <p className="text-xs text-gray-500">{appt.condition}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <Clock className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-500">{appt.date ? `${appt.date} ` : ""}{appt.time}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={appt.status === "in-progress" ? "default" : "secondary"}>{appt.status}</Badge>
                            <Button size="sm" variant="outline"><Eye className="w-4 h-4" /></Button>
                            {appt.status !== "completed" && (
                              <>
                                <Button size="sm" className="bg-[#008080] hover:bg-[#008080]/90" onClick={() => onStartVideoCall?.(`mediscript-appt-${appt.id}`)}>
                                  <Video className="w-4 h-4" />Join Call
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(appt.id, "completed")}>
                                  Complete
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {renderPagination(appointmentsPage, getTotalPages(appointments.length), setAppointmentsPage)}
                </CardContent>
              </Card>
            </div>
          )}

          {/* PATIENTS */}
          {activeSection === "patients" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl">Patients</h1>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input type="text" placeholder="Search patients..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008080]" />
                </div>
              </div>
              <Card>
                <CardHeader><CardTitle>All Patients</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {paginateData(filteredPatients, patientsPage).map((patient) => (
                      <div key={patient.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <Avatar>
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${patient.name}`} />
                            <AvatarFallback>PT</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm">{patient.name}</p>
                            <p className="text-xs text-gray-500">Age {patient.age} · {patient.condition}</p>
                            <p className="text-xs text-gray-500">Last visit: {patient.lastVisit}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={patient.status === "stable" ? "secondary" : patient.status === "improving" ? "default" : "outline"}>{patient.status}</Badge>
                          <Button size="sm" variant="outline"><Eye className="w-4 h-4" />View Details</Button>
                          <Button size="sm" className="bg-[#008080] hover:bg-[#008080]/90" onClick={() => onStartVideoCall?.()}><Video className="w-4 h-4" />Join Call</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {renderPagination(patientsPage, getTotalPages(filteredPatients.length), setPatientsPage)}
                </CardContent>
              </Card>
            </div>
          )}

          {/* PRESCRIPTIONS */}
          {activeSection === "prescriptions" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl">Prescriptions</h1>
                <Button className="bg-[#008080] hover:bg-[#008080]/90" onClick={() => setShowPrescriptionModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />New Prescription
                </Button>
              </div>
              <Card>
                <CardHeader><CardTitle>All Prescriptions ({prescriptions.length})</CardTitle></CardHeader>
                <CardContent>
                  {prescriptions.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No prescriptions yet</p>
                  ) : (
                    <div className="space-y-4">
                      {paginateData(prescriptions, prescriptionsPage).map((prescription) => (
                        <div key={prescription.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="text-sm">{prescription.medication}</p>
                            <p className="text-xs text-gray-500">For {prescription.patient}</p>
                            <p className="text-xs text-gray-500">{prescription.date}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={prescription.status === "sent" ? "default" : "secondary"}>{prescription.status}</Badge>
                            <Button size="sm" variant="outline"><Eye className="w-4 h-4" />View Details</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {renderPagination(prescriptionsPage, getTotalPages(prescriptions.length), setPrescriptionsPage)}
                </CardContent>
              </Card>
            </div>
          )}

          {/* OTHER SECTIONS */}
          {!["home","appointments","patients","prescriptions"].includes(activeSection) && (
            <div className="max-w-4xl mx-auto text-center py-12">
              <h1 className="text-3xl mb-4 capitalize">{activeSection.replace("-"," ")}</h1>
              <p className="text-gray-500">This section is under development.</p>
            </div>
          )}

        </motion.div>
      </div>
    </div>
  );
}