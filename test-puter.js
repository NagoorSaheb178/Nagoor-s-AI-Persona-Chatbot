import puter from '@heyputer/puter.js';

async function testPuter() {
  try {
    const messages = [
      { role: "user", content: "What is 2+2? Can you call a tool to calculate it?" }
    ];

    const options = {
      model: "gpt-4o-mini", // or whatever model
      tools: [
        {
          type: "function",
          function: {
            name: "calculate",
            description: "Calculates the result",
            parameters: {
              type: "object",
              properties: {
                expression: { type: "string" }
              }
            }
          }
        }
      ],
      stream: false
    };

    const response = await puter.ai.chat(messages, options);
    console.log(JSON.stringify(response, null, 2));
  } catch (err) {
    console.error(err);
  }
}

testPuter();
