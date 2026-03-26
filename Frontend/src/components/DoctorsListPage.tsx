import { useState, useEffect } from "react";
import { API_BASE } from "../lib/config";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  Search, Star, MapPin, Calendar, Video, Phone, Clock,
  ChevronLeft, ChevronRight, Heart, Award, X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DoctorsListPageProps {
  onBack: () => void;
  onBookAppointment: (doctorId: number) => void;
  onJoinCall?: () => void;
  onViewDetails?: (doctorId: number) => void;
}

// ── Mock fallback ─────────────────────────────────────────────────────────
const MOCK_DOCTORS = [
  { id: 1, name: "Dr. Sarah Mitchell", specialty: "Cardiologist", experience: 12, rating: 4.9, reviews: 245, location: "New York, NY", image: "https://images.unsplash.com/photo-1706565029539-d09af5896340?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmZW1hbGUlMjBkb2N0b3IlMjBwb3J0cmFpdCUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NTg5OTM1MTh8MA&ixlib=rb-4.1.0&q=80&w=1080", available: true, price: 80, availableSlots: ["Today 2:00 PM", "Tomorrow 10:00 AM"], consultationTypes: ["Video Call"] },
  { id: 2, name: "Dr. James Rodriguez", specialty: "General Physician", experience: 8, rating: 4.8, reviews: 189, location: "Los Angeles, CA", image: "https://images.unsplash.com/photo-1632054224659-280be3239aff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYWxlJTIwZG9jdG9yJTIwcHJvZmVzc2lvbmFsJTIwaGVhZHNob3R8ZW58MXx8fHwxNzU5MDY4OTcxfDA&ixlib=rb-4.1.0&q=80&w=1080", available: true, price: 60, availableSlots: ["Today 4:00 PM", "Tomorrow 9:00 AM"], consultationTypes: ["Video Call"] },
  { id: 3, name: "Dr. Emily Chen", specialty: "Pediatrician", experience: 15, rating: 5.0, reviews: 312, location: "Chicago, IL", image: "https://images.unsplash.com/photo-1666886573230-2b730505f298?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpY2FsJTIwc3BlY2lhbGlzdCUyMHBoeXNpY2lhbnxlbnwxfHx8fDE3NTkwNjg5NzJ8MA&ixlib=rb-4.1.0&q=80&w=1080", available: false, price: 90, availableSlots: [], consultationTypes: ["Video Call"] },
];

const TIME_SLOTS = ["09:00 AM","09:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","12:30 PM","02:00 PM","02:30 PM","03:00 PM","03:30 PM","04:00 PM","04:30 PM","05:00 PM","05:30 PM"];
const MORNING   = ["09:00 AM","09:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM"];
const AFTERNOON = ["12:00 PM","12:30 PM","02:00 PM","02:30 PM","03:00 PM","03:30 PM"];
const EVENING   = ["04:00 PM","04:30 PM","05:00 PM","05:30 PM"];

const API = API_BASE;
const authHeader = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });
const getTodayStr = () => new Date().toISOString().split("T")[0];

// ── Booking Modal ─────────────────────────────────────────────────────────
function BookingModal({ doctor, onClose, onBooked }: { doctor: any; onClose: () => void; onBooked: (msg: string) => void }) {
  const [step, setStep]             = useState(1);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const confirmBooking = async () => {
    const token = localStorage.getItem("token");
    if (!token) { alert("Please sign in first"); return; }
    const [year,month,day] = bookingDate.split("-");
    const timeStr = bookingTime.replace(" AM","").replace(" PM","");
    let [hours,minutes] = timeStr.split(":").map(Number);
    if (bookingTime.includes("PM") && hours !== 12) hours += 12;
    if (bookingTime.includes("AM") && hours === 12) hours = 0;
    const appointmentDate = new Date(parseInt(year),parseInt(month)-1,parseInt(day),hours,minutes).toISOString();
    setIsSubmitting(true);
    try {
      const res  = await fetch(`${API}/appointments`, { method:"POST", headers: authHeader(), body: JSON.stringify({ doctor_id: doctor.id, appointment_date: appointmentDate, appointment_type: "video", notes: bookingNotes || "Booked from doctors list" }) });
      const data = await res.json();
      if (data.id || data.success) { onBooked(`✅ Appointment confirmed with ${doctor.name}!`); onClose(); }
      else { onBooked("❌ " + (data.error || "Booking failed")); onClose(); }
    } catch { onBooked("❌ Could not connect to server"); onClose(); }
    setIsSubmitting(false);
  };

  const SlotGroup = ({ label, slots }: { label: string; slots: string[] }) => (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => (
          <button key={slot} onClick={() => setBookingTime(slot)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${bookingTime === slot ? "bg-[#008080] text-white border-[#008080]" : "bg-white text-gray-600 border-gray-200 hover:border-[#008080] hover:text-[#008080]"}`}>{slot}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity:0, y:30, scale:0.97 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:20, scale:0.97 }} transition={{ duration:0.25 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10"><AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${doctor.name}`} /><AvatarFallback className="bg-[#008080] text-white text-sm font-bold">DR</AvatarFallback></Avatar>
            <div><p className="font-semibold text-gray-900 text-sm">{doctor.name}</p><p className="text-xs text-gray-500">{doctor.specialty}</p></div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">{[1,2,3].map((s) => <div key={s} className={`w-2 h-2 rounded-full transition-all ${step >= s ? "bg-[#008080]" : "bg-gray-200"}`} />)}</div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full p-1.5"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="p-6 space-y-5">
            <div><h3 className="text-lg font-semibold text-gray-900">Select Date & Time</h3><p className="text-sm text-gray-500 mt-0.5">Choose your preferred appointment slot</p></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label><input type="date" min={getTodayStr()} value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#008080] bg-gray-50" /></div>
            <div className="space-y-4"><label className="block text-sm font-medium text-gray-700">Available Time Slots</label><SlotGroup label="Morning" slots={MORNING} /><SlotGroup label="Afternoon" slots={AFTERNOON} /><SlotGroup label="Evening" slots={EVENING} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Reason for Visit <span className="text-gray-400 font-normal">(optional)</span></label><textarea value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} placeholder="e.g. Chest pain, follow-up checkup..." rows={2} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#008080] bg-gray-50 resize-none" /></div>
          </div>
        )}

        {/* Step 2 — Confirm */}
        {step === 2 && (
          <div className="p-6 space-y-4">
            <div><h3 className="text-lg font-semibold text-gray-900">Confirm Appointment</h3><p className="text-sm text-gray-500 mt-0.5">Please review your booking details</p></div>
            <div className="bg-gradient-to-br from-[#008080]/5 to-[#00BFFF]/5 border border-[#008080]/20 rounded-2xl p-5 space-y-4">
              <div className="flex items-center space-x-3 pb-4 border-b border-[#008080]/10">
                <Avatar className="w-12 h-12"><AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${doctor.name}`} /><AvatarFallback className="bg-[#008080] text-white font-bold">DR</AvatarFallback></Avatar>
                <div><p className="font-semibold text-gray-900">{doctor.name}</p><p className="text-sm text-gray-500">{doctor.specialty}</p><div className="flex items-center space-x-1 mt-0.5"><Star className="w-3 h-3 text-yellow-400 fill-yellow-400" /><span className="text-xs text-gray-500">{doctor.rating}</span></div></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-3"><p className="text-xs text-gray-400 mb-1">Date</p><p className="text-sm font-semibold text-gray-800">{new Date(bookingDate).toDateString()}</p></div>
                <div className="bg-white rounded-xl p-3"><p className="text-xs text-gray-400 mb-1">Time</p><p className="text-sm font-semibold text-gray-800">{bookingTime}</p></div>
                <div className="bg-white rounded-xl p-3"><p className="text-xs text-gray-400 mb-1">Type</p><p className="text-sm font-semibold text-gray-800">🎥 Video Call</p></div>
                <div className="bg-white rounded-xl p-3"><p className="text-xs text-gray-400 mb-1">Status</p><p className="text-sm font-semibold text-[#008080]">Pending Confirmation</p></div>
              </div>
              {bookingNotes && <div className="bg-white rounded-xl p-3"><p className="text-xs text-gray-400 mb-1">Notes</p><p className="text-sm text-gray-700">{bookingNotes}</p></div>}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <Button variant="ghost" className="text-gray-500" onClick={() => step === 1 ? onClose() : setStep(1)}>{step === 1 ? "Cancel" : "← Back"}</Button>
          {step < 2 ? (
            <Button className="bg-[#008080] hover:bg-[#008080]/90 px-6" disabled={!bookingDate || !bookingTime} onClick={() => setStep(2)}>Continue →</Button>
          ) : (
            <Button className="bg-[#008080] hover:bg-[#008080]/90 px-6" onClick={confirmBooking} disabled={isSubmitting}>{isSubmitting ? "Booking..." : "✅ Confirm Booking"}</Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
export function DoctorsListPage({ onBack, onBookAppointment, onJoinCall, onViewDetails }: DoctorsListPageProps) {
  const [currentPage, setCurrentPage]           = useState(1);
  const [searchQuery, setSearchQuery]           = useState("");
  const [specialtyFilter, setSpecialtyFilter]   = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [sortBy, setSortBy]                     = useState("rating");
  const [doctors, setDoctors]                   = useState<any[]>(MOCK_DOCTORS);
  const [specialties, setSpecialties]           = useState<string[]>([]);
  const [selectedDoctor, setSelectedDoctor]     = useState<any>(null);
  const [toastMsg, setToastMsg]                 = useState("");
  const doctorsPerPage = 12;

  useEffect(() => {
    const load = async () => {
      try {
        const [docRes, specRes] = await Promise.all([
          fetch(`${API}/doctors`),
          fetch(`${API}/doctors/specialties`),
        ]);
        const docData  = await docRes.json();
        const specData = await specRes.json();

        if (Array.isArray(docData) && docData.length > 0) {
          setDoctors(docData.map((d: any) => ({
            id:               d.id,
            name:             d.full_name,
            specialty:        d.specialty,
            experience:       d.experience        || 0,
            rating:           parseFloat(d.rating) || 4.5,
            reviews:          d.review_count       || 0,
            location:         d.location           || "India",
            image:            d.avatar_url         || `https://api.dicebear.com/7.x/avataaars/svg?seed=${d.full_name}`,
            available:        d.available,
            price:            d.consultation_fee   || 0,
            availableSlots:   d.available ? ["Available Now"] : [],
            consultationTypes:["Video Call"],
            qualification:    d.qualification      || "",
            hospital:         d.hospital           || "",
          })));
        }
        if (Array.isArray(specData)) setSpecialties(specData);
      } catch {
        // keep mock
      }
    };
    load();
  }, []);

  const handleBooked = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 5000);
  };

  const filteredDoctors = doctors
    .filter((d) => {
      const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            d.specialty.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSpecialty = specialtyFilter === "all" ||
                               d.specialty.toLowerCase().includes(specialtyFilter.toLowerCase());
      const matchesAvail = availabilityFilter === "all" ||
                           (availabilityFilter === "available" && d.available) ||
                           (availabilityFilter === "unavailable" && !d.available);
      return matchesSearch && matchesSpecialty && matchesAvail;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "rating":     return b.rating - a.rating;
        case "experience": return b.experience - a.experience;
        case "price-low":  return a.price - b.price;
        case "price-high": return b.price - a.price;
        case "reviews":    return b.reviews - a.reviews;
        default: return 0;
      }
    });

  const totalPages     = Math.ceil(filteredDoctors.length / doctorsPerPage);
  const startIndex     = (currentPage - 1) * doctorsPerPage;
  const currentDoctors = filteredDoctors.slice(startIndex, startIndex + doctorsPerPage);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <AnimatePresence>
        {selectedDoctor && (
          <BookingModal
            doctor={selectedDoctor}
            onClose={() => setSelectedDoctor(null)}
            onBooked={handleBooked}
          />
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-7xl mx-auto">

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
              <h1 className="text-3xl font-bold text-gray-900">Find a Doctor</h1>
              <p className="text-gray-600">Browse our network of certified healthcare providers</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input placeholder="Search doctors..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="pl-10" />
              </div>

              <Select value={specialtyFilter} onValueChange={(v) => { setSpecialtyFilter(v); setCurrentPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Specialty" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Specialties</SelectItem>
                  {specialties.map((s) => <SelectItem key={s} value={s.toLowerCase()}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={availabilityFilter} onValueChange={(v) => { setAvailabilityFilter(v); setCurrentPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Availability" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Doctors</SelectItem>
                  <SelectItem value="available">Available Now</SelectItem>
                  <SelectItem value="unavailable">Schedule Later</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="experience">Most Experienced</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="reviews">Most Reviews</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">{filteredDoctors.length} doctors found</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Doctors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          {currentDoctors.map((doctor, index) => (
            <motion.div key={doctor.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }}>
              <Card className="h-full hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  {/* Doctor Image */}
                  <div className="relative mb-4">
                    <Avatar className="w-20 h-20 mx-auto">
                      <AvatarFallback className="bg-[#008080] text-white text-xl font-bold">{doctor.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {doctor.available && (
                      <div className="absolute bottom-0 right-1/2 transform translate-x-10 translate-y-2">
                        <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                      </div>
                    )}
                  </div>

                  {/* Doctor Info */}
                  <div className="text-center space-y-3">
                    <h3 className="font-semibold text-gray-900">{doctor.name}</h3>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">{doctor.specialty}</Badge>

                    <div className="flex items-center justify-center space-x-1">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={14} className={i < Math.floor(doctor.rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} />
                        ))}
                      </div>
                      <span className="text-gray-700 text-sm">{doctor.rating}</span>
                      <span className="text-gray-500 text-sm">({doctor.reviews})</span>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center justify-center space-x-1">
                        <Award className="w-4 h-4" />
                        <span>{doctor.experience} yrs experience</span>
                      </div>
                      <div className="flex items-center justify-center space-x-1">
                        <MapPin className="w-4 h-4" />
                        <span>{doctor.location}</span>
                      </div>
                    </div>

                    {doctor.available && (
                      <div className="text-xs text-green-600 bg-green-50 rounded p-2">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Available Now
                      </div>
                    )}

                    <div className="flex justify-center space-x-1">
                      <Video className="w-3 h-3 text-gray-500" />
                      <span className="text-xs text-gray-500">Video Call</span>
                    </div>

                    <div className="pt-3 space-y-2">
                      <div className="text-2xl font-bold text-[#008080]">
                        {doctor.price > 0 ? `₹${doctor.price}` : "Free"}
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <Button variant="outline" className="w-full text-[#008080] border-[#008080] hover:bg-[#008080] hover:text-white" onClick={() => onViewDetails?.(doctor.id)}>
                          View Details
                        </Button>
                        <Button
                          className="w-full bg-gradient-to-r from-[#008080] to-[#00BFFF] hover:from-[#008080]/90 hover:to-[#00BFFF]/90 text-white"
                          onClick={() => setSelectedDoctor(doctor)}
                        >
                          {doctor.available ? "Book Appointment" : "Schedule Appointment"}
                        </Button>
                        {doctor.available && (
                          <Button variant="outline" className="w-full text-green-600 border-green-600 hover:bg-green-600 hover:text-white" onClick={() => onJoinCall?.()}>
                            Join Call
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1} to {Math.min(startIndex + doctorsPerPage, filteredDoctors.length)} of {filteredDoctors.length} doctors
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="w-4 h-4 mr-1" />Previous
                  </Button>
                  <div className="flex space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let page = totalPages <= 5 ? i+1 : currentPage <= 3 ? i+1 : currentPage >= totalPages-2 ? totalPages-4+i : currentPage-2+i;
                      return (
                        <Button key={page} variant={currentPage === page ? "default" : "outline"} size="sm" onClick={() => setCurrentPage(page)} className={`w-8 h-8 p-0 ${currentPage === page ? "bg-[#008080] hover:bg-[#008080]/90 text-white" : ""}`}>{page}</Button>
                      );
                    })}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
                    Next<ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}