import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Star, MapPin } from "lucide-react";
import { motion } from "motion/react";
import { API_BASE } from "../lib/config";

interface DoctorsSectionProps {
  onViewAllDoctors?: () => void;
}

export function DoctorsSection({ onViewAllDoctors }: DoctorsSectionProps) {
  const [doctors, setDoctors] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/doctors`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setDoctors(data.slice(0, 6)); })
      .catch(() => {});
  }, []);

  if (doctors.length === 0) return null;

  return (
    <section id="doctors" className="py-20 bg-gradient-to-br from-blue-50 to-teal-50">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl lg:text-5xl text-gray-900 mb-4">
            Meet Our Expert Doctors
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Connect with board-certified physicians across various specializations
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {doctors.map((doctor, index) => (
            <motion.div
              key={doctor.id}
              className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              {/* Doctor Image */}
              <div className="relative mb-4">
                <img
                  src={doctor.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(doctor.full_name)}&background=008080&color=fff&size=96`}
                  alt={doctor.full_name}
                  className="w-24 h-24 rounded-full object-cover mx-auto"
                />
                {doctor.available && (
                  <div className="absolute bottom-0 right-1/2 transform translate-x-12 translate-y-2">
                    <div className="w-6 h-6 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>
                )}
              </div>

              {/* Doctor Info */}
              <div className="text-center space-y-3">
                <h3 className="text-xl text-gray-900">{doctor.full_name}</h3>

                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  {doctor.specialty || "General Physician"}
                </Badge>

                <div className="flex items-center justify-center space-x-1">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={i < Math.floor(doctor.rating || 4.5) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                      />
                    ))}
                  </div>
                  <span className="text-gray-700 text-sm">{(doctor.rating || 4.5).toFixed(1)}</span>
                </div>

                {doctor.location && (
                  <div className="flex items-center justify-center space-x-1 text-gray-600">
                    <MapPin size={14} />
                    <span className="text-sm">{doctor.location}</span>
                  </div>
                )}

                {doctor.experience > 0 && (
                  <div className="text-gray-600 text-sm">{doctor.experience} years experience</div>
                )}

                <div className="pt-4">
                  <Button
                    className="w-full bg-gradient-to-r from-[#008080] to-[#00BFFF] hover:from-[#008080]/90 hover:to-[#00BFFF]/90 text-white"
                    onClick={onViewAllDoctors}
                  >
                    Book Now
                  </Button>
                </div>

                {doctor.available && (
                  <div className="text-sm text-green-600">✓ Available for consultation</div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <Button
            size="lg"
            variant="outline"
            className="border-[#008080] text-[#008080] hover:bg-[#008080]/10"
            onClick={onViewAllDoctors}
          >
            View All Doctors
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
