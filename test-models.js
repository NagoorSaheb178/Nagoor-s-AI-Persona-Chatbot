const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');

function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = val;
      }
    });
  }
}

async function testModel(modelName) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  console.log(`Testing model: ${modelName}...`);
  try {
    const res = await groq.chat.completions.create({
      model: modelName,
      messages: [{ role: 'user', content: 'Say OK' }],
      max_tokens: 10,
    });
    console.log(`  Success! Response: "${res.choices[0]?.message?.content?.trim()}"`);
    return true;
  } catch (err) {
    console.log(`  Failed: ${err.message}`);
    return false;
  }
}

async function main() {
  loadEnv();
  const models = [
    'llama3-8b-8192',
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    'mixtral-8x7b-32768',
    'gemma2-9b-it'
  ];
  for (const model of models) {
    await testModel(model);
    console.log('---');
  }
}

main();
