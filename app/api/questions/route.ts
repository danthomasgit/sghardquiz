import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Question } from '@/app/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { subject, count = 5 } = await request.json();

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
      throw new Error('No response from OpenAI');
    }

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

      return NextResponse.json({ questions: formattedQuestions });
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      console.error('Raw response:', response);
      throw new Error('Failed to parse questions from OpenAI response');
    }
  } catch (error) {
    console.error('Error generating questions:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
} 