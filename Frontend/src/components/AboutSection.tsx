import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Shield, Heart, AlertTriangle, Globe, Pill, Mic, FileText, Video } from "lucide-react";
import { motion } from "motion/react";

export function AboutSection() {
  const features = [
    { number: "Drug–Drug", label: "Interaction Detection", icon: AlertTriangle },
    { number: "Dose", label: "WHO Limit Validation", icon: Shield },
    { number: "Drug", label: "Name Mapping (9 Countries)", icon: Globe },
    { number: "Voice", label: "AI Dictation & Transcription", icon: Mic },
    { number: "NER", label: "Medicine Extraction from Text", icon: Pill },
    { number: "Auto", label: "Digital Prescription Generation", icon: FileText },
    { number: "Live", label: "Video Consultation", icon: Video },
    { number: "24/7", label: "Doctor Support System", icon: Heart }
  ];

  return (
    <section id="about" className="py-20 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge variant="outline" className="mb-4 px-4 py-2 text-[#008080] border-[#008080]">
            About MediScript
          </Badge>
          <h2 className="text-4xl lg:text-5xl mb-6 text-gray-900">
            AI-Powered Doctor Support System
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            MediScript is a smart doctor support system built on top of a telemedicine platform. It assists doctors during live consultations with AI-driven prescription generation, real-time drug safety checks, and multilingual drug name mapping — all powered by a custom ML model.
          </p>
        </motion.div>

        {/* ML Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-20"
        >
          {features.map((feat, index) => (
            <Card key={index} className="text-center border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow">
              <CardContent className="pt-8 pb-6">
                <feat.icon className="w-8 h-8 text-[#008080] mx-auto mb-4" />
                <div className="text-xl font-bold text-gray-900 mb-2">{feat.number}</div>
                <div className="text-sm text-gray-600">{feat.label}</div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
