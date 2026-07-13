// server/test_generate.js
import dotenv from 'dotenv';
dotenv.config();

import { generatePosterMetadata } from './utils/posterGeneratorHelper.js';

async function test() {
  try {
    const prompt = "Node.js Developer Roadmap infographic";
    console.log("Generating poster metadata for:", prompt);
    const poster = await generatePosterMetadata(prompt);
    console.log("GENERATED POSTER JSON:");
    console.log(JSON.stringify(poster, null, 2));
  } catch (err) {
    console.error("Error running generator:", err);
  }
}

test();
