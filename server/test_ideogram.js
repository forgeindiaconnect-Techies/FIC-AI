// test_ideogram.js
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

async function test() {
  console.log("Using IDEOGRAM_API_KEY:", process.env.IDEOGRAM_API_KEY ? "Present (Starts with " + process.env.IDEOGRAM_API_KEY.slice(0, 8) + ")" : "Missing");
  try {
    const response = await axios.post('https://api.ideogram.ai/v1/generate', {
      image_request: {
        prompt: "A beautiful Diwali greeting card background design, vibrant colors, clean and minimal, absolutely no text.",
        aspect_ratio: 'ASPECT_3_4',
        model: 'V_2',
        magic_prompt_option: 'AUTO'
      }
    }, {
      headers: {
        'Api-Key': process.env.IDEOGRAM_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });
    console.log("IDEOGRAM API RESPONSE SUCCESS:");
    console.log(JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error("IDEOGRAM API ERROR:", err.response?.data || err.message || err);
  }
}

test();
