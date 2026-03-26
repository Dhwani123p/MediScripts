import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Star, MapPin } from "lucide-react";
import { motion } from "motion/react";

interface DoctorsSectionProps {
  onViewAllDoctors?: () => void;
}

const doctors = [
  {
    id: 1,
    name: "Dr. Sarah Mitchell",
    specialization: "Cardiologist",
    experience: "12 years",
    rating: 4.9,
    reviews: 245,
    location: "New York, NY",
    image: "https://images.unsplash.com/photo-1706565029539-d09af5896340?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmZW1hbGUlMjBkb2N0b3IlMjBwb3J0cmFpdCUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NTg5OTM1MTh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    available: true,
    price: "$80"
  },
  {
    id: 2,
    name: "Dr. James Rodriguez",
    specialization: "General Physician",
    experience: "8 years",
    rating: 4.8,
    reviews: 189,
    location: "Los Angeles, CA",
    image: "https://images.unsplash.com/photo-1632054224659-280be3239aff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYWxlJTIwZG9jdG9yJTIwcHJvZmVzc2lvbmFsJTIwaGVhZHNob3R8ZW58MXx8fHwxNzU5MDY4OTcxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    available: true,
    price: "$60"
  },
  {
    id: 3,
    name: "Dr. Emily Chen",
    specialization: "Pediatrician",
    experience: "15 years",
    rating: 5.0,
    reviews: 312,
    location: "Chicago, IL",
    image: "https://images.unsplash.com/photo-1666886573230-2b730505f298?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpY2FsJTIwc3BlY2lhbGlzdCUyMHBoeXNpY2lhbnxlbnwxfHx8fDE3NTkwNjg5NzJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    available: false,
    price: "$70"
  },
  {
    id: 4,
    name: "Dr. Michael Thompson",
    specialization: "Dermatologist",
    experience: "10 years",
    rating: 4.7,
    reviews: 156,
    location: "Miami, FL",
    image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300",
    available: true,
    price: "$90"
  },
  {
    id: 5,
    name: "Dr. Lisa Wang",
    specialization: "Psychiatrist",
    experience: "9 years",
    rating: 4.9,
    reviews: 203,
    location: "Seattle, WA",
    image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300",
    available: true,
    price: "$100"
  },
  {
    id: 6,
    name: "Dr. Robert Davis",
    specialization: "Orthopedist",
    experience: "18 years",
    rating: 4.8,
    reviews: 278,
    location: "Boston, MA",
    image: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=300",
    available: false,
    price: "$85"
  }
];

export function DoctorsSection({ onViewAllDoctors }: DoctorsSectionProps) {
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
                  src={doctor.image}
                  alt={doctor.name}
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
                <h3 className="text-xl text-gray-900">
                  {doctor.name}
                </h3>
                
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  {doctor.specialization}
                </Badge>

                <div className="flex items-center justify-center space-x-1">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        size={14} 
                        className={`${
                          i < Math.floor(doctor.rating) 
                            ? 'fill-yellow-400 text-yellow-400' 
                            : 'text-gray-300'
                        }`} 
                      />
                    ))}
                  </div>
                  <span className="text-gray-700 text-sm">{doctor.rating}</span>
                  <span className="text-gray-500 text-sm">({doctor.reviews} reviews)</span>
                </div>

                <div className="flex items-center justify-center space-x-1 text-gray-600">
                  <MapPin size={14} />
                  <span className="text-sm">{doctor.location}</span>
                </div>

                <div className="text-gray-600 text-sm">
                  {doctor.experience} experience
                </div>

                <div className="pt-4">
                  <Button 
                    className="w-full bg-gradient-to-r from-[#008080] to-[#00BFFF] hover:from-[#008080]/90 hover:to-[#00BFFF]/90 text-white"
                    onClick={onViewAllDoctors}
                  >
                    Book Now
                  </Button>
                </div>

                {doctor.available && (
                  <div className="text-sm text-green-600">
                    ✓ Available for consultation
                  </div>
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