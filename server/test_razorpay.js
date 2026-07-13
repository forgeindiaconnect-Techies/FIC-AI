import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

console.log('Testing Razorpay keys...');
console.log('Key ID:', keyId);
console.log('Key Secret: (hidden)', keySecret ? 'Yes' : 'No');

async function testRazorpay() {
  try {
    const res = await axios.post(
      'https://api.razorpay.com/v1/orders',
      {
        amount: 50000, // 500 INR in paise
        currency: 'INR',
        receipt: 'receipt_test_123'
      },
      {
        auth: {
          username: keyId,
          password: keySecret
        }
      }
    );
    console.log('✅ Success! Order created:', res.data);
  } catch (err) {
    console.log('❌ Error from Razorpay:');
    if (err.response) {
      console.log('Status Code:', err.response.status);
      console.log('Error Details:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.log(err.message);
    }
  }
}

testRazorpay();
