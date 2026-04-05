import { useState, useEffect } from "react";
import { API_BASE } from "../lib/config";
import { PrescriptionViewer } from "./PrescriptionViewer";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { HealthProfilePage } from "./HealthProfilePage";
import {
  Calendar,
  Users,
  FileText,
  Home,
  Clock,
  Video,
  Download,
  Search,
  Plus,
  Heart,
  ChevronDown,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Eye,
  BookOpen,
  X,
  Star,
  CheckCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PatientDashboardProps {
  onLogout: () => void;
  onNavigateHome: () => void;
  onStartVideoCall?: (roomName?: string) => void;
  onViewDoctors?: () => void;
  onViewAppointments?: () => void;
}


const MORNING_SLOTS = ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM"];
const AFTERNOON_SLOTS = ["12:00 PM", "12:30 PM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM"];
const EVENING_SLOTS = ["04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM"];



const getLoggedInName = () => {
  try {
    const raw  = localStorage.getItem("user");
    if (!raw) return "User";
    const user = JSON.parse(raw);
    const name = user.fullName || user.full_name || "";
    return name.split(" ")[0] || "User";
  } catch { return "User"; }
};

const API = API_BASE;
const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});
const getTodayStr = () => new Date().toISOString().split("T")[0];

// ── Professional Booking Modal Component ──────────────────────────────────
function BookingModal({ doctor, onClose, onBooked }: { doctor: any; onClose: () => void; onBooked: (msg: string) => void }) {
  const [step, setStep]               = useState(1); // 1=datetime, 3=confirm (step 2 skipped)
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [bookingType, setBookingType] = useState("video"); // always video
  const [bookingNotes, setBookingNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canNext1 = bookingDate && bookingTime;

  const confirmBooking = async () => {
    const token = localStorage.getItem("token");
    if (!token) { alert("Please sign in first"); return; }

    const [year, month, day] = bookingDate.split("-");
    const timeStr            = bookingTime.replace(" AM","").replace(" PM","");
    let [hours, minutes]     = timeStr.split(":").map(Number);
    if (bookingTime.includes("PM") && hours !== 12) hours += 12;
    if (bookingTime.includes("AM") && hours === 12) hours  = 0;
    const appointmentDate    = new Date(
      parseInt(year), parseInt(month)-1, parseInt(day), hours, minutes
    ).toISOString();

    setIsSubmitting(true);
    try {
      const res  = await fetch(`${API}/appointments`, {
        method:  "POST",
        headers: authHeader(),
        body:    JSON.stringify({
          doctor_id:        doctor.id,
          appointment_date: appointmentDate,
          appointment_type: bookingType,
          notes:            bookingNotes || "Booked from dashboard",
        }),
      });
      const data = await res.json();
      if (data.id || data.success) {
        onBooked(`✅ Appointment confirmed with ${doctor.name} on ${new Date(appointmentDate).toLocaleDateString()} at ${bookingTime}!`);
        onClose();
      } else {
        onBooked("❌ " + (data.error || "Booking failed"));
        onClose();
      }
    } catch {
      onBooked("❌ Could not connect to server");
      onClose();
    }
    setIsSubmitting(false);
  };

  const TimeSlotGroup = ({ label, slots }: { label: string; slots: string[] }) => (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => (
          <button
            key={slot}
            onClick={() => setBookingTime(slot)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              bookingTime === slot
                ? "bg-[#008080] text-white border-[#008080] shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#008080] hover:text-[#008080]"
            }`}
          >
            {slot}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.25 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
      >
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${doctor.name}`} />
              <AvatarFallback className="bg-[#008080] text-white text-sm font-bold">DR</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{doctor.name}</p>
              <p className="text-xs text-gray-500">{doctor.specialty}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {/* Step indicators */}
            <div className="flex items-center space-x-1">
              {[1,2,3].map((s) => (
                <div key={s} className={`w-2 h-2 rounded-full transition-all ${step >= s ? "bg-[#008080]" : "bg-gray-200"}`} />
              ))}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full p-1.5 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Step 1: Date & Time ── */}
        {step === 1 && (
          <div className="p-6 space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Select Date & Time</h3>
              <p className="text-sm text-gray-500 mt-0.5">Choose your preferred appointment slot</p>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
              <input
                type="date"
                min={getTodayStr()}
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#008080] bg-gray-50 hover:border-gray-300 transition-colors"
              />
            </div>

            {/* Time slots grouped */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">Available Time Slots</label>
              <TimeSlotGroup label="Morning" slots={MORNING_SLOTS} />
              <TimeSlotGroup label="Afternoon" slots={AFTERNOON_SLOTS} />
              <TimeSlotGroup label="Evening" slots={EVENING_SLOTS} />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Reason for Visit <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                placeholder="e.g. Chest pain, follow-up checkup, skin rash..."
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#008080] bg-gray-50 resize-none"
              />
            </div>
          </div>
        )}



        {/* ── Step 3: Confirm ── */}
        {step === 3 && (
          <div className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Confirm Appointment</h3>
              <p className="text-sm text-gray-500 mt-0.5">Please review your booking details</p>
            </div>

            {/* Summary card */}
            <div className="bg-gradient-to-br from-[#008080]/5 to-[#00BFFF]/5 border border-[#008080]/20 rounded-2xl p-5 space-y-4">
              {/* Doctor */}
              <div className="flex items-center space-x-3 pb-4 border-b border-[#008080]/10">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${doctor.name}`} />
                  <AvatarFallback className="bg-[#008080] text-white font-bold">DR</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-gray-900">{doctor.name}</p>
                  <p className="text-sm text-gray-500">{doctor.specialty}</p>
                  <div className="flex items-center space-x-1 mt-0.5">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <span className="text-xs text-gray-500">{doctor.rating}</span>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Date</p>
                  <p className="text-sm font-semibold text-gray-800">{new Date(bookingDate).toDateString()}</p>
                </div>
                <div className="bg-white rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Time</p>
                  <p className="text-sm font-semibold text-gray-800">{bookingTime}</p>
                </div>
                <div className="bg-white rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Type</p>
                  <p className="text-sm font-semibold text-gray-800">🎥 Video Call</p>
                </div>
                <div className="bg-white rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Status</p>
                  <p className="text-sm font-semibold text-[#008080]">Pending Confirmation</p>
                </div>
              </div>

              {bookingNotes && (
                <div className="bg-white rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{bookingNotes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Footer buttons ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <Button
            variant="ghost"
            className="text-gray-500"
            onClick={() => step === 1 ? onClose() : setStep(1)}
          >
            {step === 1 ? "Cancel" : "← Back"}
          </Button>

          {step < 3 ? (
            <Button
              className="bg-[#008080] hover:bg-[#008080]/90 px-6"
              disabled={step === 1 && !canNext1}
              onClick={() => setStep(3)}
            >
              Continue →
            </Button>
          ) : (
            <Button
              className="bg-[#008080] hover:bg-[#008080]/90 px-6"
              onClick={confirmBooking}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Booking..." : "✅ Confirm Booking"}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
export function PatientDashboard({ onLogout, onNavigateHome, onStartVideoCall }: PatientDashboardProps) {
  const [activeSection, setActiveSection]       = useState("home");
  const [searchQuery, setSearchQuery]           = useState("");
  const [appointmentsPage, setAppointmentsPage] = useState(1);
  const [doctorsPage, setDoctorsPage]           = useState(1);
  const recordsPerPage = 10;

  const [allAppointments, setAllAppointments]         = useState<any[]>([]);
  const [allDoctors, setAllDoctors]                   = useState<any[]>([]);
  const [recentPrescriptions, setRecentPrescriptions] = useState<any[]>([]);
  const [userName, setUserName]                       = useState(getLoggedInName());
  const [bookingMsg, setBookingMsg]                   = useState("");
  const [selectedDoctor, setSelectedDoctor]           = useState<any>(null);
  const [viewPrescriptionId, setViewPrescriptionId]   = useState<number|null>(null);

  const loadRealData = async () => {
    try {
      const token = localStorage.getItem("token");

      if (token) {
        const meRes  = await fetch(`${API}/auth/me`, { headers: authHeader() });
        const meData = await meRes.json();
        const u      = meData.user || meData;
        const name   = u.fullName || u.full_name || "";
        if (name) {
          setUserName(name.split(" ")[0]);
          const stored = JSON.parse(localStorage.getItem("user") || "{}");
          localStorage.setItem("user", JSON.stringify({ ...stored, fullName: name }));
        }
      }

      const docRes  = await fetch(`${API}/doctors`);
      const docData = await docRes.json();
      setAllDoctors(
        Array.isArray(docData)
          ? docData.map((d: any) => ({
              id:            d.id,
              name:          d.full_name,
              specialty:     d.specialty,
              rating:        parseFloat(d.rating) || 4.5,
              nextAvailable: d.available ? "Available Now" : "Not Available",
            }))
          : []
      );

      if (token) {
        const apptRes  = await fetch(`${API}/appointments`, { headers: authHeader() });
        const apptData = await apptRes.json();
        setAllAppointments(
          Array.isArray(apptData)
            ? apptData.map((a: any) => ({
                id:        a.id,
                doctor:    a.doctor_name      || "Unknown Doctor",
                specialty: a.doctor_specialty || "",
                date:      new Date(a.appointment_date).toLocaleDateString(),
                time:      new Date(a.appointment_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                type:      a.appointment_type || "video",
                status:    a.status           || "scheduled",
              }))
            : []
        );

        const presRes  = await fetch(`${API}/prescriptions`, { headers: authHeader() });
        const presData = await presRes.json();
        setRecentPrescriptions(
          Array.isArray(presData)
            ? presData.map((p: any) => ({
                id:         p.id,
                doctor:     p.doctor_name || "Unknown Doctor",
                medication: p.medication,
                date:       new Date(p.prescribed_date).toLocaleDateString(),
                status:     p.status || "active",
              }))
            : []
        );
      } else {
        setAllAppointments([]);
        setRecentPrescriptions([]);
      }
    } catch {
      // keep whatever was already loaded; don't overwrite with stale mock
    }
  };

  useEffect(() => { loadRealData(); }, []);

  const handleCancelAppointment = async (id: number) => {
    if (!confirm("Cancel this appointment?")) return;
    try {
      await fetch(`${API}/appointments/${id}`, { method: "DELETE", headers: authHeader() });
      setBookingMsg("✅ Appointment cancelled");
      await loadRealData();
      setTimeout(() => setBookingMsg(""), 3000);
    } catch {
      setBookingMsg("❌ Could not cancel");
      setTimeout(() => setBookingMsg(""), 3000);
    }
  };

  const handleBooked = async (msg: string) => {
    setBookingMsg(msg);
    await loadRealData();
    setTimeout(() => setBookingMsg(""), 5000);
  };

  const handleMarkDone = async (id: number) => {
    try {
      const res = await fetch(`${API}/prescriptions/${id}`, {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify({ status: "completed" }),
      });
      if (res.ok) {
        setRecentPrescriptions((prev) =>
          prev.map((p) => p.id === id ? { ...p, status: "completed" } : p)
        );
        setBookingMsg("✅ Prescription marked as completed");
        setTimeout(() => setBookingMsg(""), 3000);
      }
    } catch {
      setBookingMsg("❌ Could not update prescription");
      setTimeout(() => setBookingMsg(""), 3000);
    }
  };

  const appointments  = allAppointments;
  const doctors       = allDoctors;
  const prescriptions = recentPrescriptions;

  const upcomingCount        = appointments.filter((a: any) => ["scheduled","upcoming","confirmed"].includes(a.status)).length;
  const upcomingAppointments = appointments.slice(0, 2);
  const myDoctors       = doctors.slice(0, 3);
  const filteredDoctors = doctors.filter(
    (d) => d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           d.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      {/* Booking Modal */}
      <AnimatePresence>
        {selectedDoctor && (
          <BookingModal
            doctor={selectedDoctor}
            onClose={() => setSelectedDoctor(null)}
            onBooked={handleBooked}
          />
        )}
      </AnimatePresence>

      {/* Prescription Viewer */}
      {viewPrescriptionId && (
        <PrescriptionViewer
          prescriptionId={viewPrescriptionId}
          onClose={() => setViewPrescriptionId(null)}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2 cursor-pointer" onClick={onNavigateHome}>
              <div className="w-10 h-10 bg-gradient-to-r from-[#008080] to-[#00BFFF] rounded-xl flex items-center justify-center">
                <Heart size={24} className="text-white" />
              </div>
              <span className="text-2xl text-gray-900">Mediscript</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center space-x-2 rounded-md px-2 py-1 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#008080]" aria-label="Open user menu">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`} />
                  <AvatarFallback>{userName.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="hidden md:block">{userName}</span>
                <ChevronDown className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-50 w-56">
                <DropdownMenuItem onClick={() => setActiveSection("home")}><Home className="w-4 h-4 mr-2" />Dashboard</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveSection("appointments")}><Calendar className="w-4 h-4 mr-2" />My Appointments</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveSection("doctors")}><Users className="w-4 h-4 mr-2" />Find Doctors</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveSection("prescriptions")}><FileText className="w-4 h-4 mr-2" />My Prescriptions</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveSection("profile")}><User className="w-4 h-4 mr-2" />My Health Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={onStartVideoCall}><Video className="w-4 h-4 mr-2" />Video Conference</DropdownMenuItem>
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
          {bookingMsg && (
            <div className={`p-3 rounded-lg text-sm mb-4 flex items-center justify-between ${bookingMsg.startsWith("✅") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              <span>{bookingMsg}</span>
              <button onClick={() => setBookingMsg("")}><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* HOME */}
          {activeSection === "home" && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl mb-2">Welcome back, {userName}!</h1>
                <p className="text-gray-600">Manage your health appointments and records</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm">Upcoming</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl">{upcomingCount}</div>
                    <p className="text-xs text-muted-foreground">Appointments</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm">My Doctors</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl">{doctors.length}</div>
                    <p className="text-xs text-muted-foreground">Healthcare providers</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm">Prescriptions</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl">{prescriptions.length}</div>
                    <p className="text-xs text-muted-foreground">Active medications</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Upcoming Appointments
                      <Button variant="outline" size="sm" onClick={() => setActiveSection("appointments")}>
                        <Plus className="w-4 h-4 mr-2" />View All
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {upcomingAppointments.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-400 mb-3">No upcoming appointments</p>
                        <Button size="sm" className="bg-[#008080] hover:bg-[#008080]/90" onClick={() => setActiveSection("doctors")}>
                          <BookOpen className="w-4 h-4 mr-2" />Book Now
                        </Button>
                      </div>
                    ) : upcomingAppointments.map((appointment) => (
                      <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <Avatar>
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${appointment.doctor}`} />
                            <AvatarFallback>DR</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm">{appointment.doctor}</p>
                            <p className="text-xs text-gray-500">{appointment.specialty}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Clock className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500">{appointment.date} at {appointment.time}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <Badge variant={appointment.status === "upcoming" ? "default" : "secondary"}>{appointment.type}</Badge>
                          {["upcoming","scheduled","confirmed"].includes(appointment.status) && (
                            <Button size="sm" className="w-full bg-[#008080] hover:bg-[#008080]/90" onClick={() => onStartVideoCall?.(`mediscript-appt-${appointment.id}`)}>
                              <Video className="w-4 h-4 mr-2" />Join Call
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Find a Doctor</CardTitle>
                    <CardDescription>Search for healthcare providers by specialty</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search by specialty, name, or condition..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && searchQuery.trim()) setActiveSection("doctors"); }}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008080]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {["Cardiology","Dermatology","Pediatrics","Neurology"].map((specialty) => (
                        <Button
                          key={specialty}
                          variant="outline"
                          className="justify-start border-[#008080]/20 hover:bg-[#008080]/10"
                          onClick={() => { setSearchQuery(specialty); setActiveSection("doctors"); }}
                        >
                          <Heart className="w-4 h-4 mr-2 text-[#008080]" />{specialty}
                        </Button>
                      ))}
                    </div>
                    {searchQuery && (
                      <Button
                        className="w-full bg-[#008080] hover:bg-[#008080]/90 text-white"
                        onClick={() => setActiveSection("doctors")}
                      >
                        <Search className="w-4 h-4 mr-2" />
                        Search "{searchQuery}" — View {filteredDoctors.length} doctor{filteredDoctors.length !== 1 ? "s" : ""}
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Recent Prescriptions
                      <Button variant="outline" size="sm" onClick={() => setActiveSection("prescriptions")}>
                        <FileText className="w-4 h-4 mr-2" />View All
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {prescriptions.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No prescriptions yet</p>
                    ) : prescriptions.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{p.medication}</p>
                          <p className="text-xs text-gray-500">Prescribed by {p.doctor}</p>
                          <p className="text-xs text-gray-500">{p.date}</p>
                        </div>
                        <div className="flex items-center space-x-2 flex-wrap gap-1 justify-end">
                          <Badge
                            className={
                              p.status === "active"
                                ? "bg-green-100 text-green-700 border-green-200"
                                : p.status === "completed"
                                ? "bg-gray-100 text-gray-600 border-gray-200"
                                : "bg-red-100 text-red-600 border-red-200"
                            }
                            variant="outline"
                          >
                            {p.status}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => setViewPrescriptionId(p.id)}>
                            <Download className="w-4 h-4 mr-1" />PDF
                          </Button>
                          {p.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:text-green-800 hover:border-green-400"
                              onClick={() => handleMarkDone(p.id)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />Mark Done
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>My Healthcare Team</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {filteredDoctors.map((doctor) => (
                      <div key={doctor.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <Avatar>
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${doctor.name}`} />
                            <AvatarFallback>DR</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm">{doctor.name}</p>
                            <p className="text-xs text-gray-500">{doctor.specialty}</p>
                            <div className="flex items-center space-x-1 mt-1">
                              <div className="flex">{[1,2,3,4,5].map((s) => <span key={s} className="text-yellow-400 text-xs">★</span>)}</div>
                              <span className="text-xs text-gray-500">{doctor.rating}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 mb-2">Next available:</p>
                          <p className="text-xs text-[#008080]">{doctor.nextAvailable}</p>
                          <Button size="sm" className="mt-2 bg-[#008080] hover:bg-[#008080]/90" onClick={() => setActiveSection("doctors")}>View All</Button>
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
                <h1 className="text-3xl">My Appointments</h1>
                <Button className="bg-[#008080] hover:bg-[#008080]/90" onClick={() => setActiveSection("doctors")}>
                  <Plus className="w-4 h-4 mr-2" />Book New
                </Button>
              </div>
              <Card>
                <CardHeader><CardTitle>All Appointments</CardTitle></CardHeader>
                <CardContent>
                  {appointments.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-400 mb-4">No appointments found.</p>
                      <Button className="bg-[#008080] hover:bg-[#008080]/90" onClick={() => setActiveSection("doctors")}>
                        <BookOpen className="w-4 h-4 mr-2" />Find a Doctor
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {paginateData(appointments, appointmentsPage).map((appointment) => (
                        <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <Avatar>
                              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${appointment.doctor}`} />
                              <AvatarFallback>DR</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm">{appointment.doctor}</p>
                              <p className="text-xs text-gray-500">{appointment.specialty}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <Clock className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-500">{appointment.date} at {appointment.time}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={appointment.status === "upcoming" ? "default" : "secondary"}>{appointment.type}</Badge>
                            <Badge variant="outline">{appointment.status}</Badge>
                            <Button size="sm" variant="outline" onClick={onStartVideoCall}><Video className="w-4 h-4" />Join Call</Button>
                            <Button size="sm" variant="outline" className="text-red-500 hover:text-red-700 hover:border-red-300" onClick={() => handleCancelAppointment(appointment.id)}>Cancel</Button>
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

          {/* DOCTORS */}
          {activeSection === "doctors" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl">Find Doctors</h1>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input type="text" placeholder="Search doctors..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setDoctorsPage(1); }} className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008080]" />
                </div>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>
                    {searchQuery
                      ? `Results for "${searchQuery}" (${filteredDoctors.length})`
                      : `Available Doctors (${doctors.length})`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filteredDoctors.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">
                        No doctors found for "{searchQuery}". Try a different search term.
                      </p>
                    ) : null}
                    {paginateData(filteredDoctors, doctorsPage).map((doctor) => (
                      <div key={doctor.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <Avatar>
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${doctor.name}`} />
                            <AvatarFallback>DR</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm">{doctor.name}</p>
                            <p className="text-xs text-gray-500">{doctor.specialty}</p>
                            <div className="flex items-center space-x-1 mt-1">
                              <div className="flex">{[1,2,3,4,5].map((s) => <span key={s} className="text-yellow-400 text-xs">★</span>)}</div>
                              <span className="text-xs text-gray-500">{doctor.rating}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-right mr-4">
                            <p className="text-xs text-gray-500">Next available:</p>
                            <p className="text-xs text-[#008080]">{doctor.nextAvailable}</p>
                          </div>
                          <Button size="sm" variant="outline"><Eye className="w-4 h-4" />View Details</Button>
                          <Button size="sm" variant="outline" onClick={() => setSelectedDoctor(doctor)}>
                            <BookOpen className="w-4 h-4" />Book Appointment
                          </Button>
                          <Button size="sm" className="bg-[#008080] hover:bg-[#008080]/90" onClick={onStartVideoCall}>
                            <Video className="w-4 h-4" />Join Call
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {renderPagination(doctorsPage, getTotalPages(filteredDoctors.length), setDoctorsPage)}
                </CardContent>
              </Card>
            </div>
          )}

          {/* PRESCRIPTIONS */}
          {activeSection === "prescriptions" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl">My Prescriptions</h1>
                  <p className="text-gray-500 text-sm mt-1">
                    Active prescriptions are ongoing medications. Mark them as done once you finish the course.
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setActiveSection("home")} className="text-[#008080]">← Back</Button>
              </div>

              {/* Status legend */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> Active — ongoing medication
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block" /> Completed — course finished
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Cancelled
                </span>
              </div>

              <Card>
                <CardContent className="pt-6">
                  {prescriptions.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-12">No prescriptions found.</p>
                  ) : (
                    <div className="space-y-3">
                      {prescriptions.map((p) => (
                        <div key={p.id} className={`flex items-center justify-between p-4 border rounded-xl transition-colors ${p.status === "completed" ? "bg-gray-50 opacity-75" : "bg-white hover:bg-gray-50"}`}>
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${p.status === "active" ? "bg-green-400" : p.status === "completed" ? "bg-gray-400" : "bg-red-400"}`} />
                            <div>
                              <p className={`text-sm font-medium ${p.status === "completed" ? "line-through text-gray-400" : "text-gray-800"}`}>{p.medication}</p>
                              <p className="text-xs text-gray-500 mt-0.5">Dr. {p.doctor}</p>
                              <p className="text-xs text-gray-400">{p.date}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge
                              variant="outline"
                              className={
                                p.status === "active"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : p.status === "completed"
                                  ? "bg-gray-100 text-gray-500 border-gray-200"
                                  : "bg-red-50 text-red-600 border-red-200"
                              }
                            >
                              {p.status}
                            </Badge>
                            <Button size="sm" variant="outline" onClick={() => setViewPrescriptionId(p.id)}>
                              <Eye className="w-4 h-4 mr-1" />View
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setViewPrescriptionId(p.id)}>
                              <Download className="w-4 h-4 mr-1" />PDF
                            </Button>
                            {p.status === "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:text-green-800 hover:border-green-400 hover:bg-green-50"
                                onClick={() => handleMarkDone(p.id)}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />Mark Done
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* PROFILE */}
          {activeSection === "profile" && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4 mb-6">
                <Button variant="ghost" onClick={() => setActiveSection("home")} className="text-[#008080] hover:bg-[#008080]/10">← Back to Dashboard</Button>
                <div>
                  <h1 className="text-3xl">My Health Profile</h1>
                  <p className="text-gray-600">Manage your personal and medical information</p>
                </div>
              </div>
              <HealthProfilePage onBackToDashboard={() => setActiveSection("home")} />
            </div>
          )}

          {/* SETTINGS */}
          {activeSection === "settings" && (
            <div className="max-w-3xl mx-auto">
              <h1 className="text-3xl mb-6">Settings</h1>
              <Card>
                <CardHeader>
                  <CardTitle>Account Settings</CardTitle>
                  <CardDescription>Manage your preferences and account details</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-500 py-8 text-center">Settings interface goes here.</p>
                </CardContent>
              </Card>
            </div>
          )}

        </motion.div>
      </div>
    </div>
  );
}