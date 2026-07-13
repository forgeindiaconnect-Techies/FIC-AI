// server/test_category_engine.js
import dotenv from 'dotenv';
dotenv.config();

import { detectCategoryAndTemplate } from './utils/categoryDetectionEngine.js';
import { generatePosterMetadata } from './utils/posterGeneratorHelper.js';

const testPrompts = [
  {
    prompt: "Grand Opening of Forge India Connect",
    expectedCategory: "Grand Opening",
    shouldNotBeHiring: true
  },
  {
    prompt: "We are hiring MERN Stack Developers",
    expectedCategory: "Hiring",
    shouldNotBeHiring: false
  },
  {
    prompt: "Happy Diwali",
    expectedCategory: "Festival",
    shouldNotBeHiring: true
  },
  {
    prompt: "50% discount on all courses today",
    expectedCategory: "Sale / Offer",
    shouldNotBeHiring: true
  },
  {
    prompt: "Exclusive Restaurant grand opening",
    expectedCategory: "Restaurant",
    shouldNotBeHiring: true
  }
];

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING AI CATEGORY DETECTION ENGINE TEST SUITE");
  console.log("==================================================");

  let successCount = 0;

  for (const item of testPrompts) {
    console.log(`\n--- Test Prompt: "${item.prompt}" ---`);
    try {
      // 1. Test Category and Template Detection
      const detection = await detectCategoryAndTemplate(item.prompt);
      console.log("Detection Output:", JSON.stringify(detection, null, 2));

      let pass = true;

      if (item.shouldNotBeHiring && detection.template === 'hiring') {
        console.error(`❌ FAIL: Prompt should not use "hiring" template, but got: "${detection.template}"`);
        pass = false;
      }

      if (item.shouldNotBeHiring && detection.category === 'Hiring') {
        console.error(`❌ FAIL: Prompt should not use "Hiring" category, but got: "${detection.category}"`);
        pass = false;
      }

      // 2. Test metadata generation layout types
      const metadata = await generatePosterMetadata(item.prompt);
      console.log("Metadata generated with LayoutType:", metadata.layoutType);

      if (item.shouldNotBeHiring && (metadata.layoutType === 'hiring-poster' || metadata.layoutType === 'split-hero')) {
        console.error(`❌ FAIL: Non-hiring category "${detection.category}" generated a hiring layoutType: "${metadata.layoutType}"`);
        pass = false;
      }

      if (pass) {
        console.log("✅ PASS");
        successCount++;
      }
    } catch (err) {
      console.error("❌ ERROR during test execution:", err.message);
    }
  }

  console.log("\n==================================================");
  console.log(`RESULTS: ${successCount}/${testPrompts.length} tests passed successfully.`);
  console.log("==================================================");
}

runTests();
