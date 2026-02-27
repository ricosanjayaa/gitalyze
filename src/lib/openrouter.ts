import { ScoreBreakdown } from "./scoring";
import { GitHubUser, GitHubRepo } from "./github";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = 'stepfun/step-3.5-flash:free';

export async function getAIRecoomendations(
  breakdown: ScoreBreakdown, 
  user: GitHubUser, 
  repos: GitHubRepo[]
): Promise<string[]> {
  const prompt = `
    You are a strict GitHub profile evaluator and optimization expert.

    Your task is to generate improvement recommendations ONLY for weak areas based on the provided data.

    CRITICAL RULES:

    1. Only recommend improvements for sections with LOW scores.
      - If a score is >= 70% of its maximum, DO NOT suggest improvements for it.
      - If a profile field already exists, DO NOT suggest adding it.

    2. Never give generic advice.
      - Every recommendation must directly relate to the provided data.
      - Do not assume missing information unless explicitly stated.

    3. If all sections are strong, return:
      []

    4. Generate 3–4 recommendations maximum.

    5. Each recommendation:
      - One sentence only
      - Maximum 20 words
      - Start with a strong verb (Add, Improve, Increase, Pin, Enhance, Expand, Strengthen, Optimize, Document, Engage)
      - Professional, concise, and constructive tone
      - No criticism, only forward-looking advice

    6. Output format:
      - Return ONLY a valid JSON array of strings
      - No explanation
      - No markdown
      - No extra text

    --------------------------------------------------

    USER DATA:

    Name: ${user.name || user.login}
    Bio: ${user.bio || 'Not provided'}
    Location: ${user.location || 'Not provided'}
    Website: ${user.blog || 'Not provided'}
    Followers: ${user.followers}
    Public Repos: ${user.public_repos}

    SCORES:
    Activity: ${breakdown.activity.toFixed(0)} / 25
    Quality: ${breakdown.quality.toFixed(0)} / 30
    Volume: ${breakdown.volume.toFixed(0)} / 15
    Diversity: ${breakdown.diversity.toFixed(0)} / 10
    Completeness: ${breakdown.completeness.toFixed(0)} / 10

    TOP REPOSITORIES:
    ${repos.sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 3).map(r => `- ${r.name} (${r.stargazers_count} stars): ${r.description || 'No description'}`).join('\n')}

    --------------------------------------------------

    Return the JSON array now.
  `;

  try {
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not defined.');
    }

    const response = await fetch(OPENROUTER_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: 'You are a strict GitHub profile evaluator and optimization expert. Your task is to generate improvement recommendations ONLY for weak areas based on the provided data. Return ONLY a valid JSON array of strings. No explanation, no markdown, no extra text.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown OpenRouter API error' }));
      throw new Error(`OpenRouter API error: ${response.status} - ${errorData.message || JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content?.trim();

    if (!text) {
      throw new Error('OpenRouter API returned an empty or malformed response.');
    }

    const recommendations = JSON.parse(text);
    return recommendations as string[];

  } catch (error) {
    console.error("Error fetching AI recommendations:", error);
    // Fallback to static recommendations on error
    return [
      "Consider contributing to an open-source project that uses your top languages.",
      "Engage with the community by opening issues or pull requests.",
      "Make sure your top repositories have descriptive README files."
    ];
  }
}
