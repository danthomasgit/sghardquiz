import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Question } from '@/app/types';

console.log('=== API ROUTE STARTED ===');
console.log('=== ENVIRONMENT CHECK ===');

// Add more detailed API key validation
const apiKey = process.env.OPENAI_API_KEY;
console.log('Raw API Key from environment:', {
  exists: !!apiKey,
  length: apiKey?.length,
  first10Chars: apiKey?.substring(0, 10),
  last10Chars: apiKey?.substring(-10),
  containsSkProj: apiKey?.includes('sk-proj-'),
  containsKProj: apiKey?.includes('k-proj-'),
  // Log each character of the prefix for debugging
  prefixChars: apiKey?.substring(0, 7).split('').map(c => c.charCodeAt(0))
});

// Clean the API key by removing any whitespace or newlines
const cleanApiKey = apiKey?.trim().replace(/\s+/g, '');
console.log('Cleaned API Key:', {
  length: cleanApiKey?.length,
  first10Chars: cleanApiKey?.substring(0, 10),
  last10Chars: cleanApiKey?.substring(-10),
  containsSkProj: cleanApiKey?.includes('sk-proj-'),
  containsKProj: cleanApiKey?.includes('k-proj-'),
  // Log each character of the prefix for debugging
  prefixChars: cleanApiKey?.substring(0, 7).split('').map(c => c.charCodeAt(0))
});

if (!apiKey) {
  console.error('OPENAI_API_KEY is not set in environment variables');
} else {
  // Log the first few characters of the API key for debugging (safely)
  console.log('API Key format check:', {
    length: apiKey.length,
    startsWith: apiKey.substring(0, 3),
    isValidFormat: apiKey.startsWith('sk-') || apiKey.startsWith('sk-proj-'),
    // Log the exact prefix
    prefix: apiKey.substring(0, 7)
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

const projectId = extractProjectId(cleanApiKey || '');
console.log('Extracted project ID:', projectId);

const openai = new OpenAI({
  apiKey: cleanApiKey,
  baseURL: 'https://api.openai.com/v1',
  defaultHeaders: projectId ? {
    'OpenAI-Project': projectId,
  } : undefined,
});

export async function POST(request: Request) {
  console.log('=== POST REQUEST RECEIVED ===');
  try {
    // Verify API key is available before proceeding
    if (!apiKey) {
      console.error('=== API KEY MISSING ===');
      throw new Error('OpenAI API key is not configured');
    }

    const { subject, count = 5 } = await request.json();
    console.log(`=== GENERATING QUESTIONS ===`);
    console.log(`Subject: ${subject}, Count: ${count}`);

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

    console.log('=== SENDING REQUEST TO OPENAI ===');
    try {
      console.log('OpenAI configuration:', {
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

      console.log('=== RECEIVED RESPONSE FROM OPENAI ===');
      const response = completion.choices[0].message.content;
      if (!response) {
        console.error('=== NO RESPONSE CONTENT ===');
        throw new Error('No response from OpenAI');
      }

      console.log('=== PARSING RESPONSE ===');
      // Clean the response to ensure it's valid JSON
      const cleanedResponse = response.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      
      try {
        const parsedResponse = JSON.parse(cleanedResponse);
        console.log('=== SUCCESSFULLY PARSED JSON ===');
        const questions = Array.isArray(parsedResponse) ? parsedResponse : parsedResponse.questions;

        // Validate and transform the questions
        const formattedQuestions = questions.map((q: any) => ({
          question: q.question,
          answer: q.answer,
          difficulty: q.difficulty === 'medium' || q.difficulty === 'hard' ? q.difficulty : 'medium'
        }));

        console.log(`=== SUCCESSFULLY GENERATED ${formattedQuestions.length} QUESTIONS ===`);
        return NextResponse.json({ questions: formattedQuestions });
      } catch (parseError) {
        console.error('=== ERROR PARSING RESPONSE ===', parseError);
        console.error('Raw response:', response);
        throw new Error('Failed to parse questions from OpenAI response');
      }
    } catch (openaiError: any) {
      console.error('=== OPENAI API ERROR ===', {
        message: openaiError.message,
        status: openaiError.status,
        type: openaiError.type,
        code: openaiError.code,
        projectId: projectId,
        baseURL: openai.baseURL,
        stack: openaiError.stack
      });
      
      // Return a more detailed error response
      return NextResponse.json(
        {
          error: 'OpenAI API Error',
          details: {
            message: openaiError.message,
            status: openaiError.status,
            type: openaiError.type,
            code: openaiError.code
          },
          timestamp: new Date().toISOString()
        },
        { status: openaiError.status || 500 }
      );
    }
  } catch (error: any) {
    console.error('=== GENERAL ERROR ===', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Return more detailed error information
    return NextResponse.json(
      { 
        error: 'Failed to generate questions',
        details: {
          message: error.message,
          name: error.name,
          stack: error.stack
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 