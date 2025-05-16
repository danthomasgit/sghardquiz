import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Question } from '@/app/types';

// Add more detailed API key validation
const apiKey = process.env.OPENAI_API_KEY;
console.log('Environment check:', {
  hasApiKey: !!apiKey,
  keyLength: apiKey?.length,
  keyPrefix: apiKey?.substring(0, 10),
  allEnvVars: Object.keys(process.env).filter(key => key.includes('OPENAI'))
});

if (!apiKey) {
  console.error('OPENAI_API_KEY is not set in environment variables');
} else {
  // Log the first few characters of the API key for debugging (safely)
  console.log('API Key format check:', {
    length: apiKey.length,
    startsWith: apiKey.substring(0, 3),
    isValidFormat: apiKey.startsWith('sk-')
  });
}

// Extract project ID from the API key if it's in the format sk-proj-{projectId}-{key}
const extractProjectId = (key: string) => {
  if (key.startsWith('sk-proj-')) {
    const parts = key.split('-');
    if (parts.length >= 3) {
      return parts[2];
    }
  }
  return null;
};

const projectId = extractProjectId(apiKey || '');
console.log('Extracted project ID:', projectId);

const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: 'https://api.openai.com/v1',
  defaultHeaders: {
    'OpenAI-Project': projectId || '',
  },
});

export async function POST(request: Request) {
  try {
    // Verify API key is available before proceeding
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const { subject, count = 5 } = await request.json();
    console.log(`[API] Starting question generation for subject: ${subject}, count: ${count}`);

    const prompt = `Generate ${count} trivia questions about ${subject}. 
    Requirements:
    - Questions should be challenging but fair
    - All questions should be medium to hard difficulty
    - Questions should be specific to ${subject}
    - Include one correct answer for each question
    - Format as JSON array with question, answer, and difficulty fields
    - Difficulty should be either 'medium' or 'hard'
    - Return ONLY the JSON array, no other text
    
    Example format:
    [
      {
        "question": "What is the name of the process by which plants convert light energy into chemical energy?",
        "answer": "Photosynthesis",
        "difficulty": "medium"
      }
    ]`;

    console.log('[API] Sending request to OpenAI...');
    try {
      console.log('[API] OpenAI configuration:', {
        hasApiKey: !!apiKey,
        projectId: projectId,
        baseURL: openai.baseURL,
        model: 'gpt-4'
      });

      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a trivia question generator. Generate high-quality, challenging trivia questions. Return ONLY a JSON array of questions, no other text."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: "gpt-4",
        temperature: 0.7,
      });

      console.log('[API] Received response from OpenAI');
      const response = completion.choices[0].message.content;
      if (!response) {
        console.error('[API] No response content from OpenAI');
        throw new Error('No response from OpenAI');
      }

      console.log('[API] Cleaning and parsing response...');
      // Clean the response to ensure it's valid JSON
      const cleanedResponse = response.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      
      try {
        const parsedResponse = JSON.parse(cleanedResponse);
        console.log('[API] Successfully parsed JSON response');
        const questions = Array.isArray(parsedResponse) ? parsedResponse : parsedResponse.questions;

        // Validate and transform the questions
        const formattedQuestions = questions.map((q: any) => ({
          question: q.question,
          answer: q.answer,
          difficulty: q.difficulty === 'medium' || q.difficulty === 'hard' ? q.difficulty : 'medium'
        }));

        console.log(`[API] Successfully generated ${formattedQuestions.length} questions`);
        return NextResponse.json({ questions: formattedQuestions });
      } catch (parseError) {
        console.error('[API] Error parsing OpenAI response:', parseError);
        console.error('[API] Raw response:', response);
        throw new Error('Failed to parse questions from OpenAI response');
      }
    } catch (openaiError: any) {
      console.error('[API] OpenAI API Error:', {
        message: openaiError.message,
        status: openaiError.status,
        type: openaiError.type,
        code: openaiError.code,
        projectId: projectId,
        baseURL: openai.baseURL
      });
      throw openaiError;
    }
  } catch (error) {
    console.error('[API] Error in question generation:', error);
    // Return more detailed error information
    return NextResponse.json(
      { 
        error: 'Failed to generate questions',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 