import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

async function run() {
    const schema = {
        type: SchemaType.OBJECT,
        properties: {
            banks: {
                type: SchemaType.ARRAY,
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        bank_name: { type: SchemaType.STRING, description: 'Bank Name' },
                        theme: { type: SchemaType.STRING, description: 'Theme' },
                        threat_level: { type: SchemaType.STRING, description: 'Threat', enum: ['Threat', 'Opportunity', 'Monitor'] },
                        confidence: { type: SchemaType.STRING, description: 'Conf', enum: ['High', 'Medium', 'Low'] },
                        what_changed: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    insight: { type: SchemaType.STRING },
                                    evidence: { type: SchemaType.STRING }
                                },
                                required: ['insight', 'evidence']
                            }
                        },
                        so_what: { type: SchemaType.STRING },
                        actions: {
                            type: SchemaType.OBJECT,
                            properties: {
                                defend: { type: SchemaType.STRING },
                                attack: { type: SchemaType.STRING },
                                monitor: { type: SchemaType.STRING }
                            },
                            required: ['defend', 'attack', 'monitor']
                        },
                        watch_next_quarter: { type: SchemaType.STRING }
                    },
                    required: ['bank_name', 'theme', 'threat_level', 'confidence', 'what_changed', 'so_what', 'actions', 'watch_next_quarter']
                }
            }
        },
        required: ['banks']
    };

    try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: 'Write a 1 item array of test bank.' }] }],
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: schema,
            }
        });
        console.log('SUCCESS', result.response.text());
    } catch (e) {
        console.error('ERROR', e);
    }
}
run();
