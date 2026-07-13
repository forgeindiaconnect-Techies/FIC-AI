import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  storedName:   { type: String, required: true },
  mime:         { type: String, required: true },
  size:         { type: Number, required: true },
  uploadedAt:   { type: Date, default: Date.now },
  content:      { type: String }, // extracted text content
  summary:      { type: String }  // auto‑generated summary
});

export default mongoose.model('File', fileSchema);
