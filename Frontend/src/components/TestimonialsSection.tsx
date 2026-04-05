import { Star, Quote } from "lucide-react";
import { motion } from "motion/react";

const testimonials = [
  {
    name: "Riya Desai",
    role: "Beta Tester · Student",
    rating: 5,
    comment: "The AI prescription feature is impressive — it extracted all medicines from the doctor's dictation accurately. A huge step forward for digital healthcare in India.",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Riya"
  },
  {
    name: "Arjun Nair",
    role: "Beta Tester · Software Engineer",
    rating: 5,
    comment: "Booking an appointment and joining a video call was seamless. The drug interaction warnings gave real confidence that the platform takes patient safety seriously.",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Arjun"
  },
  {
    name: "Sunita Verma",
    role: "Beta Tester · Teacher",
    rating: 5,
    comment: "Even for someone not very tech-savvy, the interface was easy to use. The doctor could write and share a prescription with me instantly after the video call.",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sunita"
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
            Feedback from our beta testers who helped shape MediScript
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