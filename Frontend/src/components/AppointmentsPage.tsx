import { useState, useEffect } from "react";
import { API_BASE } from "../lib/config";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  Calendar, Search, Filter, Video, Phone, MapPin, Clock,
  ChevronLeft, ChevronRight, X
} from "lucide-react";
import { motion } from "motion/react";

interface AppointmentsPageProps {
  onBack: () => void;
  onJoinCall?: (roomName?: string) => void;
}

const MOCK_APPOINTMENTS = [
  { id: 1,  doctor: "Dr. Sarah Johnson",   specialty: "Cardiologist",      date: "2024-01-15", time: "2:30 PM",  type: "Video Call", status: "upcoming",   location: "Online",                    reason: "Follow-up consultation" },
  { id: 2,  doctor: "Dr. Michael Chen",    specialty: "General Physician",  date: "2024-01-12", time: "10:00 AM", type: "Video Call", status: "completed",  location: "Online",                    reason: "Annual physical exam" },
  { id: 3,  doctor: "Dr. Emily Rodriguez", specialty: "Dermatologist",      date: "2024-01-18", time: "11:30 AM", type: "Video Call", status: "upcoming",   location: "Online",                    reason: "Skin condition checkup" },
  { id: 4,  doctor: "Dr. James Wilson",    specialty: "Orthopedist",        date: "2024-01-10", time: "3:00 PM",  type: "Video Call", status: "completed",  location: "Online",                    reason: "Knee pain evaluation" },
  { id: 5,  doctor: "Dr. Lisa Brown",      specialty: "Psychiatrist",       date: "2024-01-22", time: "2:00 PM",  type: "Video Call", status: "upcoming",   location: "Online",                    reason: "Mental health consultation" },
  { id: 6,  doctor: "Dr. Robert Davis",    specialty: "Endocrinologist",    date: "2024-01-08", time: "9:15 AM",  type: "Video Call", status: "cancelled",  location: "Online",                    reason: "Diabetes management" },
  { id: 7,  doctor: "Dr. Maria Garcia",    specialty: "Neurologist",        date: "2024-01-28", time: "4:45 PM",  type: "Video Call", status: "upcoming",   location: "Online",                    reason: "Migraine treatment" },
  { id: 8,  doctor: "Dr. Daniel Lee",      specialty: "Urologist",          date: "2024-01-05", time: "1:15 PM",  type: "Video Call", status: "completed",  location: "Online",                    reason: "Routine checkup" },
];

const API = API_BASE;
const authHeader = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });

export function AppointmentsPage({ onBack, onJoinCall }: AppointmentsPageProps) {
  const [currentPage, setCurrentPage]   = useState(1);
  const [searchQuery, setSearchQuery]   = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter]     = useState("all");
  const [appointments, setAppointments] = useState<any[]>(MOCK_APPOINTMENTS);
  const [toastMsg, setToastMsg]         = useState("");
  const appointmentsPerPage = 10;

  const loadAppointments = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res  = await fetch(`${API}/appointments`, { headers: authHeader() });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setAppointments(data.map((a: any) => ({
          id:        a.id,
          doctor:    a.doctor_name      || "Unknown Doctor",
          specialty: a.doctor_specialty || "",
          date:      new Date(a.appointment_date).toLocaleDateString("en-CA"), // YYYY-MM-DD
          time:      new Date(a.appointment_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          type:      a.appointment_type === "video" ? "Video Call" : a.appointment_type,
          status:    a.status           || "scheduled",
          location:  "Online",
          reason:    a.notes            || "General consultation",
        })));
      }
    } catch {
      // keep mock
    }
  };

  useEffect(() => { loadAppointments(); }, []);

  const handleCancel = async (id: number) => {
    if (!confirm("Cancel this appointment?")) return;
    try {
      await fetch(`${API}/appointments/${id}`, { method: "DELETE", headers: authHeader() });
      setToastMsg("✅ Appointment cancelled successfully");
      await loadAppointments();
      setTimeout(() => setToastMsg(""), 3000);
    } catch {
      setToastMsg("❌ Could not cancel appointment");
      setTimeout(() => setToastMsg(""), 3000);
    }
  };

  const filteredAppointments = appointments.filter((a) => {
    const matchesSearch = a.doctor.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.reason.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    const matchesType   = typeFilter   === "all" || a.type.toLowerCase().includes(typeFilter.toLowerCase());
    return matchesSearch && matchesStatus && matchesType;
  });

  const totalPages         = Math.ceil(filteredAppointments.length / appointmentsPerPage);
  const startIndex         = (currentPage - 1) * appointmentsPerPage;
  const currentAppointments = filteredAppointments.slice(startIndex, startIndex + appointmentsPerPage);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming":   return "bg-blue-100 text-blue-800";
      case "scheduled":  return "bg-blue-100 text-blue-800";
      case "confirmed":  return "bg-green-100 text-green-800";
      case "completed":  return "bg-green-100 text-green-800";
      case "cancelled":  return "bg-red-100 text-red-800";
      default:           return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeIcon = (type: string) => {
    if (type === "Video Call") return <Video className="w-4 h-4" />;
    if (type === "Phone Call") return <Phone className="w-4 h-4" />;
    return <MapPin className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-6xl mx-auto">

        {/* Toast */}
        {toastMsg && (
          <div className={`p-3 rounded-lg text-sm mb-4 flex items-center justify-between ${toastMsg.startsWith("✅") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            <span>{toastMsg}</span>
            <button onClick={() => setToastMsg("")}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-2" />Back</Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Appointments</h1>
              <p className="text-gray-600">Manage and view all your appointments</p>
            </div>
          </div>
          <Button className="bg-gradient-to-r from-[#008080] to-[#00BFFF] hover:from-[#008080]/90 hover:to-[#00BFFF]/90 text-white" onClick={onBack}>
            <Calendar className="w-4 h-4 mr-2" />Book New Appointment
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input placeholder="Search appointments..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="pl-10" />
              </div>

              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Filter by type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="video">Video Call</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">{filteredAppointments.length} results</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appointments List */}
        <Card>
          <CardHeader>
            <CardTitle>Appointments ({filteredAppointments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {currentAppointments.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No appointments found</p>
                <Button className="bg-[#008080] hover:bg-[#008080]/90" onClick={onBack}>
                  Book Your First Appointment
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {currentAppointments.map((appointment) => (
                  <motion.div
                    key={appointment.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${appointment.doctor}`} />
                        <AvatarFallback>DR</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-medium text-gray-900">{appointment.doctor}</h3>
                          <Badge variant="outline" className="text-xs">{appointment.specialty}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{appointment.reason}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{appointment.date}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{appointment.time}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            {getTypeIcon(appointment.type)}
                            <span>{appointment.location}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Badge className={`${getStatusColor(appointment.status)} border-0`}>
                        {appointment.status}
                      </Badge>
                      <div className="flex space-x-2">
                        {["upcoming","scheduled","confirmed"].includes(appointment.status) && (
                          <>
                            <Button size="sm" variant="outline">View Details</Button>
                            {appointment.type === "Video Call" && (
                              <Button size="sm" className="bg-[#008080] hover:bg-[#008080]/90 text-white" onClick={() => onJoinCall?.(`mediscript-appt-${appointment.id}`)}>
                                <Video className="w-4 h-4 mr-2" />Join Call
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="text-red-500 hover:text-red-700 hover:border-red-300" onClick={() => handleCancel(appointment.id)}>
                              Cancel
                            </Button>
                          </>
                        )}
                        {appointment.status === "completed" && (
                          <Button size="sm" variant="outline">View Notes</Button>
                        )}
                        {appointment.status === "cancelled" && (
                          <Button size="sm" variant="outline">Reschedule</Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1} to {Math.min(startIndex + appointmentsPerPage, filteredAppointments.length)} of {filteredAppointments.length} appointments
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.max(1, currentPage-1))} disabled={currentPage===1}>
                    <ChevronLeft className="w-4 h-4 mr-1" />Previous
                  </Button>
                  <div className="flex space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i+1).map((page) => (
                      <Button key={page} variant={currentPage===page ? "default" : "outline"} size="sm" onClick={() => setCurrentPage(page)} className={`w-8 h-8 p-0 ${currentPage===page ? "bg-[#008080] hover:bg-[#008080]/90 text-white" : ""}`}>{page}</Button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.min(totalPages, currentPage+1))} disabled={currentPage===totalPages}>
                    Next<ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}