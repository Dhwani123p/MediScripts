import { Star, Quote } from "lucide-react";
import { motion } from "motion/react";

const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Working Professional",
    rating: 5,
    comment: "The convenience of consulting with doctors from home is incredible. I got my prescription within 15 minutes and the doctor was very thorough.",
    avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b002?w=150"
  },
  {
    name: "Michael Chen",
    role: "Father of 2",
    rating: 5,
    comment: "When my daughter had fever at night, the 24/7 availability was a lifesaver. The pediatrician was amazing and gave us peace of mind.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"
  },
  {
    name: "Emily Rodriguez",
    role: "Senior Citizen",
    rating: 5,
    comment: "As someone with mobility issues, this platform has been revolutionary. The doctors are patient and the technology is surprisingly easy to use.",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150"
  }
];

const partners = [
  "MedCenter Hospital",
  "HealthFirst Clinic",
  "City Medical Center",
  "WellCare Partners",
  "Prime Healthcare"
];

export function TestimonialsSection() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        {/* Testimonials */}
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl lg:text-5xl text-gray-900 mb-4">
            What Our Patients Say
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Real stories from thousands of satisfied patients who trust us with their health
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              className="bg-gradient-to-br from-blue-50 to-teal-50 rounded-2xl p-8 relative"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Quote className="absolute top-4 right-4 text-blue-200" size={24} />
              
              {/* Rating */}
              <div className="flex items-center space-x-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} size={16} className="fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              {/* Comment */}
              <p className="text-gray-700 mb-6 leading-relaxed">
                "{testimonial.comment}"
              </p>

              {/* Author */}
              <div className="flex items-center space-x-4">
                <img
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <div className="text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-600">{testimonial.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Partner Hospitals */}
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >


        </motion.div>
      </div>
    </section>
  );
}