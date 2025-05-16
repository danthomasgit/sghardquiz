import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Question } from '@/app/types';

// Add logging to check if API key is present
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set in environment variables');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { subject, count = 5 } = await request.json();
    console.log(`Generating ${count} questions for subject: ${subject}`);

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

    console.log('Sending request to OpenAI...');
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

    const response = completion.choices[0].message.content;
    if (!response) {
      console.error('No response content from OpenAI');
      throw new Error('No response from OpenAI');
    }

    console.log('Received response from OpenAI, cleaning and parsing...');
    // Clean the response to ensure it's valid JSON
    const cleanedResponse = response.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    
    try {
      const parsedResponse = JSON.parse(cleanedResponse);
      const questions = Array.isArray(parsedResponse) ? parsedResponse : parsedResponse.questions;

      // Validate and transform the questions
      const formattedQuestions = questions.map((q: any) => ({
        question: q.question,
        answer: q.answer,
        difficulty: q.difficulty === 'medium' || q.difficulty === 'hard' ? q.difficulty : 'medium'
      }));

      console.log(`Successfully generated ${formattedQuestions.length} questions`);
      return NextResponse.json({ questions: formattedQuestions });
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      console.error('Raw response:', response);
      throw new Error('Failed to parse questions from OpenAI response');
    }
  } catch (error) {
    console.error('Error in question generation:', error);
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